from fastapi import APIRouter, HTTPException, Response

from app.config import settings
from app.schemas import NotesRequest, NotesResponse
from app.services.llm_client import generate_structured, set_llm_headers
from app.services.prompting import chunk_text, wrap_student_content

router = APIRouter()

# Long pastes are chunked rather than truncated (accept criterion in the FRD).
# This is a char budget, not a token count — comfortably under the model's
# context window while keeping each chunk coherent.
_MAX_CHUNK_CHARS = 12_000


_STYLE_GUIDANCE = {
    "structured": (
        "Organize by topic under clear ## headings, with short paragraphs or "
        "sub-bullets under each. Favor a logical flow a student can read "
        "top-to-bottom to build understanding, not just a list of facts."
    ),
    "bullet": (
        "Use nested bullet points throughout, one idea per bullet. Group "
        "related bullets under a ## heading per topic. Keep each bullet "
        "short enough to scan in a few seconds."
    ),
    "exam-focused": (
        "Lead each topic with the single most exam-relevant fact or formula, "
        "bolded. Flag likely-to-be-tested distinctions, common mistakes, and "
        "anything the notes emphasize or repeat. Skip background color that "
        "wouldn't earn marks."
    ),
}


def _build_prompt(request: NotesRequest, chunk: str) -> str:
    style_guidance = _STYLE_GUIDANCE.get(request.style, "")
    return (
        "You are an expert subject-matter tutor turning a student's raw notes "
        "into a summary you would actually want to revise from. Do not assume "
        "any specific board, country, or textbook — work only from the "
        "content given, and never invent facts not present or implied in it.\n\n"
        f"Subject: {request.subject}\n"
        f"Grade level: {request.grade_level}\n"
        f"Requested style: {request.style}\n\n"
        f"{wrap_student_content('Notes', chunk)}\n\n"
        "Write the summary as markdown:\n"
        f"- {style_guidance}\n"
        "- Use precise, plain language — explain any technical term the "
        "first time it appears rather than assuming it's already understood.\n"
        "- Preserve every distinct topic and any numbers, formulas, dates, or "
        "definitions from the notes exactly as given; don't drop content to "
        "save space.\n"
        "- Where the notes imply a relationship (cause/effect, comparison, "
        "sequence), make that relationship explicit rather than leaving the "
        "reader to infer it.\n\n"
        "Then list key terms: each one a term the student needs to know from "
        "this text, paired with a one-sentence, exam-ready definition in your "
        "own words (not just copied from the notes)."
    )


@router.post("/summarize-notes", response_model=NotesResponse)
def summarize_notes(request: NotesRequest, response: Response) -> NotesResponse:
    chunks = chunk_text(request.notes_text, _MAX_CHUNK_CHARS)

    # GEM-3: longer notes get the pro tier for stronger reasoning; short
    # pastes stay on flash. Decided once per request, from the original
    # (unchunked) length, so every chunk of the same request is consistent.
    model_tier = "pro" if len(request.notes_text) > settings.notes_pro_tier_char_threshold else "flash"

    summaries: list[str] = []
    key_terms: list[str] = []
    seen_terms: set[str] = set()
    providers_used: set[str] = set()
    models_used: set[str] = set()

    for chunk in chunks:
        try:
            result = generate_structured(
                model_tier=model_tier, prompt=_build_prompt(request, chunk), response_schema=NotesResponse
            )
        except Exception as exc:  # noqa: BLE001 — surface as a clean API error
            raise HTTPException(status_code=502, detail=f"Notes summarization failed: {exc}") from exc

        providers_used.add(result.provider)
        models_used.add(result.model)
        notes_result = result.data
        summary_markdown = (
            notes_result["summary_markdown"] if isinstance(notes_result, dict) else notes_result.summary_markdown
        )
        chunk_terms = notes_result["key_terms"] if isinstance(notes_result, dict) else notes_result.key_terms

        if summary_markdown and summary_markdown.strip():
            summaries.append(summary_markdown.strip())
        for term in chunk_terms:
            if term not in seen_terms:
                seen_terms.add(term)
                key_terms.append(term)

    # Code's role here is schema and non-empty output validation only (no
    # deterministic transform of the content itself) — GEM's Notes contract.
    if not summaries:
        raise HTTPException(status_code=422, detail="no summary could be generated from the given notes")
    if not key_terms:
        raise HTTPException(status_code=422, detail="no key terms could be extracted from the given notes")

    response.headers["X-LLM-Provider"] = providers_used.pop() if len(providers_used) == 1 else "mixed"
    response.headers["X-LLM-Model"] = models_used.pop() if len(models_used) == 1 else "mixed"
    response.headers["X-LLM-Tier"] = model_tier

    combined_summary = "\n\n---\n\n".join(summaries) if len(summaries) > 1 else summaries[0]
    return NotesResponse(summary_markdown=combined_summary, key_terms=key_terms)
