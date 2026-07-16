from fastapi import APIRouter, HTTPException

from app.schemas import NotesRequest, NotesResponse
from app.services.llm_client import generate_structured

router = APIRouter()

# Long pastes are chunked rather than truncated (accept criterion in the FRD).
# This is a char budget, not a token count — comfortably under the model's
# context window while keeping each chunk coherent.
_MAX_CHUNK_CHARS = 12_000


def _chunk_notes(notes_text: str) -> list[str]:
    paragraphs = notes_text.split("\n\n")
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(current) + len(paragraph) + 2 > _MAX_CHUNK_CHARS and current:
            chunks.append(current)
            current = paragraph
        else:
            current = f"{current}\n\n{paragraph}" if current else paragraph
    if current:
        chunks.append(current)
    return chunks or [notes_text]


def _build_prompt(request: NotesRequest, chunk: str) -> str:
    return (
        "You are summarizing a student's notes. Do not assume any specific "
        "board, country, or textbook — work only from the content given.\n\n"
        f"Subject: {request.subject}\n"
        f"Grade level: {request.grade_level}\n"
        f"Requested style: {request.style}\n\n"
        f"Notes:\n{chunk}\n\n"
        f"Produce a {request.style} markdown summary and a list of key terms "
        "with brief definitions drawn only from this text."
    )


@router.post("/summarize-notes", response_model=NotesResponse)
def summarize_notes(request: NotesRequest) -> NotesResponse:
    chunks = _chunk_notes(request.notes_text)

    summaries: list[str] = []
    key_terms: list[str] = []
    seen_terms: set[str] = set()

    for chunk in chunks:
        try:
            result = generate_structured(
                model_tier="flash", prompt=_build_prompt(request, chunk), response_schema=NotesResponse
            )
        except Exception as exc:  # noqa: BLE001 — surface as a clean API error
            raise HTTPException(status_code=502, detail=f"Notes summarization failed: {exc}") from exc

        summary_markdown = result["summary_markdown"] if isinstance(result, dict) else result.summary_markdown
        chunk_terms = result["key_terms"] if isinstance(result, dict) else result.key_terms

        summaries.append(summary_markdown)
        for term in chunk_terms:
            if term not in seen_terms:
                seen_terms.add(term)
                key_terms.append(term)

    if not key_terms:
        raise HTTPException(status_code=422, detail="no key terms could be extracted from the given notes")

    combined_summary = "\n\n---\n\n".join(summaries) if len(summaries) > 1 else summaries[0]
    return NotesResponse(summary_markdown=combined_summary, key_terms=key_terms)
