from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.schemas import LearningUnit, StudyPlanRequest, StudyPlanResponse, SubjectInput
from app.services.llm_client import generate_structured
from app.services.prompting import wrap_student_content
from app.services.scheduler import build_schedule

router = APIRouter()

# A long combined syllabus across many subjects (or one very long single
# syllabus) is chunked rather than silently truncated — the same accept
# criterion Notes and PYQ already have, now applied here too.
_MAX_CHUNK_CHARS = 12_000


class _PlanBreakdown(BaseModel):
    """Gemini's raw output: weighted units + a short summary. Scheduling
    minutes are computed afterwards, in code, from these units."""

    units: list[LearningUnit]
    summary: str


def _chunk_subjects(subjects: list[SubjectInput], max_chars: int) -> list[list[SubjectInput]]:
    """Groups subjects into batches whose combined syllabus text stays under
    max_chars, so a long combined paste across many subjects doesn't get
    silently truncated in a single prompt."""
    chunks: list[list[SubjectInput]] = []
    current: list[SubjectInput] = []
    current_len = 0
    for subject in subjects:
        subject_len = len(subject.topics_or_syllabus) + len(subject.name) + 50  # rough per-entry overhead
        if current and current_len + subject_len > max_chars:
            chunks.append(current)
            current = []
            current_len = 0
        current.append(subject)
        current_len += subject_len
    if current:
        chunks.append(current)
    return chunks or [subjects]


def _build_prompt(request: StudyPlanRequest, subjects: list[SubjectInput]) -> str:
    subjects_block = "\n".join(
        f"- {s.name} (priority {s.priority}/5, difficulty {s.difficulty}/5): {s.topics_or_syllabus}"
        for s in subjects
    )
    return (
        "You are breaking a student's subjects into learning units for a study "
        "planner. Do not assume any specific board, country, or textbook — work "
        "only from the content given.\n\n"
        f"Grade level: {request.grade_level}\n"
        f"Total days available: {request.total_days}\n"
        f"Hours per day: {request.hours_per_day}\n\n"
        f"{wrap_student_content('Subjects', subjects_block)}\n\n"
        "For each subject, split its topics or syllabus text into learning units. "
        "Assign each unit an effort weight from 1 (quick) to 5 (heavy). Also write "
        "a two-sentence summary of the overall plan's focus."
    )


@router.post("/generate-study-plan", response_model=StudyPlanResponse)
def generate_study_plan(request: StudyPlanRequest, response: Response) -> StudyPlanResponse:
    subject_groups = _chunk_subjects(request.subjects, _MAX_CHUNK_CHARS)

    all_units: list[LearningUnit] = []
    summaries: list[str] = []
    providers_used: set[str] = set()
    models_used: set[str] = set()

    for group in subject_groups:
        try:
            result = generate_structured(
                model_tier="flash", prompt=_build_prompt(request, group), response_schema=_PlanBreakdown
            )
        except Exception as exc:  # noqa: BLE001 — surface as a clean API error
            raise HTTPException(status_code=502, detail=f"Study plan breakdown failed: {exc}") from exc

        providers_used.add(result.provider)
        models_used.add(result.model)
        breakdown = result.data
        units = breakdown["units"] if isinstance(breakdown, dict) else breakdown.units
        summary = breakdown["summary"] if isinstance(breakdown, dict) else breakdown.summary
        all_units.extend(units)
        if summary and summary.strip():
            summaries.append(summary.strip())

    response.headers["X-LLM-Provider"] = providers_used.pop() if len(providers_used) == 1 else "mixed"
    response.headers["X-LLM-Model"] = models_used.pop() if len(models_used) == 1 else "mixed"
    response.headers["X-LLM-Tier"] = "flash"

    try:
        days = build_schedule(units=all_units, total_days=request.total_days, hours_per_day=request.hours_per_day)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return StudyPlanResponse(days=days, summary=" ".join(summaries))
