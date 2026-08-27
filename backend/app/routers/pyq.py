from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.schemas import ClassifiedQuestion, PyqRequest, PyqResponse
from app.services.frequency import compute_frequencies
from app.services.llm_client import generate_structured
from app.services.prompting import chunk_text, wrap_student_content

router = APIRouter()

# Long pastes (e.g. several years of past papers) are chunked rather than
# silently truncated — the same accept criterion Notes already had, now
# applied consistently here too.
_MAX_CHUNK_CHARS = 12_000


class _PyqClassification(BaseModel):
    """Gemini's raw output: each question classified. Frequencies and
    percentages are computed afterwards, in code, from this list."""

    questions: list[ClassifiedQuestion]


class _StrategyInsight(BaseModel):
    strategy_insight: str


def _build_classification_prompt(request: PyqRequest, chunk: str) -> str:
    return (
        "You are analyzing previous-year exam questions. Do not assume any "
        "specific board, country, or textbook — classify only from the content "
        "given.\n\n"
        f"Subject: {request.subject}\n"
        f"Grade level: {request.grade_level}\n\n"
        "Split the pasted text below into individual questions, then classify "
        "each by topic, question type (e.g. MCQ, short-answer, essay, numerical), "
        "and difficulty (easy/medium/hard).\n\n"
        f"{wrap_student_content('Questions', chunk)}"
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
    chunks = chunk_text(request.questions_text, _MAX_CHUNK_CHARS)

    all_questions: list[ClassifiedQuestion] = []
    providers_used: set[str] = set()
    models_used: set[str] = set()

    for chunk in chunks:
        try:
            classification_result = generate_structured(
                model_tier="flash",
                prompt=_build_classification_prompt(request, chunk),
                response_schema=_PyqClassification,
            )
        except Exception as exc:  # noqa: BLE001 — surface as a clean API error
            raise HTTPException(status_code=502, detail=f"PYQ classification failed: {exc}") from exc

        providers_used.add(classification_result.provider)
        models_used.add(classification_result.model)
        classification = classification_result.data
        questions = classification["questions"] if isinstance(classification, dict) else classification.questions
        all_questions.extend(questions)

    response.headers["X-LLM-Provider"] = providers_used.pop() if len(providers_used) == 1 else "mixed"
    response.headers["X-LLM-Model"] = models_used.pop() if len(models_used) == 1 else "mixed"
    response.headers["X-LLM-Tier"] = "flash"

    try:
        topic_frequency, type_frequency, high_yield_topics = compute_frequencies(all_questions)
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
