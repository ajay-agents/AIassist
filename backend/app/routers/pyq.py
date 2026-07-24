from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.schemas import ClassifiedQuestion, PyqRequest, PyqResponse
from app.services.frequency import compute_frequencies
from app.services.llm_client import generate_structured, set_llm_headers

router = APIRouter()


class _PyqClassification(BaseModel):
    """Gemini's raw output: each question classified. Frequencies and
    percentages are computed afterwards, in code, from this list."""

    questions: list[ClassifiedQuestion]


class _StrategyInsight(BaseModel):
    strategy_insight: str


def _build_classification_prompt(request: PyqRequest) -> str:
    return (
        "You are analyzing previous-year exam questions. Do not assume any "
        "specific board, country, or textbook — classify only from the content "
        "given.\n\n"
        f"Subject: {request.subject}\n"
        f"Grade level: {request.grade_level}\n\n"
        "Split the pasted text below into individual questions, then classify "
        "each by topic, question type (e.g. MCQ, short-answer, essay, numerical), "
        "and difficulty (easy/medium/hard).\n\n"
        f"Questions:\n{request.questions_text}"
    )


def _build_insight_prompt(request: PyqRequest, high_yield_topics: list[str]) -> str:
    topics_block = ", ".join(high_yield_topics) or "none identified"
    return (
        f"For a {request.grade_level} student studying {request.subject}, the "
        f"highest-frequency topics in their past-year questions are: {topics_block}. "
        "Write one short (2-3 sentence) strategic insight for how they should "
        "prioritize revision, based only on this frequency pattern."
    )


@router.post("/analyze-pyqs", response_model=PyqResponse)
def analyze_pyqs(request: PyqRequest, response: Response) -> PyqResponse:
    try:
        classification_result = generate_structured(
            model_tier="flash", prompt=_build_classification_prompt(request), response_schema=_PyqClassification
        )
    except Exception as exc:  # noqa: BLE001 — surface as a clean API error
        raise HTTPException(status_code=502, detail=f"PYQ classification failed: {exc}") from exc

    set_llm_headers(response, classification_result, "flash")
    classification = classification_result.data
    questions = classification["questions"] if isinstance(classification, dict) else classification.questions

    try:
        topic_frequency, type_frequency, high_yield_topics = compute_frequencies(questions)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        insight_result = generate_structured(
            model_tier="flash",
            prompt=_build_insight_prompt(request, high_yield_topics),
            response_schema=_StrategyInsight,
        )
        insight = insight_result.data
        strategy_insight = insight["strategy_insight"] if isinstance(insight, dict) else insight.strategy_insight
        response.headers["X-LLM-Insight-Provider"] = insight_result.provider
    except Exception:  # noqa: BLE001 — insight is a nice-to-have, never blocks the result
        strategy_insight = ""

    return PyqResponse(
        topic_frequency=topic_frequency,
        type_frequency=type_frequency,
        high_yield_topics=high_yield_topics,
        strategy_insight=strategy_insight,
    )
