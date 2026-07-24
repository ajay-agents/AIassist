from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.schemas import LearningUnit, StudyPlanRequest, StudyPlanResponse
from app.services.llm_client import generate_structured, set_llm_headers
from app.services.scheduler import build_schedule

router = APIRouter()


class _PlanBreakdown(BaseModel):
    """Gemini's raw output: weighted units + a short summary. Scheduling
    minutes are computed afterwards, in code, from these units."""

    units: list[LearningUnit]
    summary: str


def _build_prompt(request: StudyPlanRequest) -> str:
    subjects_block = "\n".join(
        f"- {s.name} (priority {s.priority}/5, difficulty {s.difficulty}/5): {s.topics_or_syllabus}"
        for s in request.subjects
    )
    return (
        "You are breaking a student's subjects into learning units for a study "
        "planner. Do not assume any specific board, country, or textbook — work "
        "only from the content given.\n\n"
        f"Grade level: {request.grade_level}\n"
        f"Total days available: {request.total_days}\n"
        f"Hours per day: {request.hours_per_day}\n\n"
        f"Subjects:\n{subjects_block}\n\n"
        "For each subject, split its topics or syllabus text into learning units. "
        "Assign each unit an effort weight from 1 (quick) to 5 (heavy). Also write "
        "a two-sentence summary of the overall plan's focus."
    )


@router.post("/generate-study-plan", response_model=StudyPlanResponse)
def generate_study_plan(request: StudyPlanRequest, response: Response) -> StudyPlanResponse:
    prompt = _build_prompt(request)

    try:
        result = generate_structured(model_tier="flash", prompt=prompt, response_schema=_PlanBreakdown)
    except Exception as exc:  # noqa: BLE001 — surface as a clean API error
        raise HTTPException(status_code=502, detail=f"Study plan breakdown failed: {exc}") from exc

    set_llm_headers(response, result, "flash")
    breakdown = result.data
    units = breakdown["units"] if isinstance(breakdown, dict) else breakdown.units
    summary = breakdown["summary"] if isinstance(breakdown, dict) else breakdown.summary

    try:
        days = build_schedule(units=units, total_days=request.total_days, hours_per_day=request.hours_per_day)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return StudyPlanResponse(days=days, summary=summary)
