# Study Desk — Gemini API Edition (Phase 1)

A curriculum-neutral study companion. A student pastes in whatever they
actually have — syllabus, notes, previous-year questions — and the product
reasons about that content directly, without assuming any specific board,
country, or textbook.

Phase 1 scope covers three tools:

- **Study Plan Generator** — topics/syllabus in, day-by-day schedule out.
- **PYQ Analysis** — pasted previous-year questions in, topic/type frequency
  patterns out.
- **Notes Summarizer** — pasted notes in, structured summary + key terms out.

Out of scope for this phase: doubt-solving chat, flashcards, persistence,
accounts, billing.

This is a rebuild of an existing Claude API prototype onto the **Gemini
API**, adopting Gemini's native structured output (`response_schema`) in
place of manual JSON parsing.

## Design principle

The LLM reasons about content — what topic is this, how should it be
classified. Plain code computes anything that must be exactly right —
schedule minutes, frequency percentages. **No arithmetic is ever delegated
to the model.** Every deterministic computation lives in
`backend/app/services/` and is unit-tested independently of any LLM call.

## Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React (Vite) | Forms + results for the three tools; talks to the backend only |
| Backend | FastAPI (Python) | Validation, orchestration, deterministic computation |
| LLM layer | Gemini API (`google-genai`), Groq as fallback | Content understanding, classification, generation |
| Deterministic layer | Plain Python | Scheduling math and frequency tallying — never the model |

**Fallback:** every router calls `app/services/llm_client.py`, which tries
Gemini first (including Gemini's own bounded retry-with-backoff) and only
falls back to Groq if Gemini fails outright. Groq has no native
`response_schema`, so its schema is embedded in the prompt and JSON mode
forces valid syntax; pydantic then validates the shape, giving callers the
same contract regardless of which provider answered. If both providers
fail, the caller gets one clear error naming both failures.

The frontend is not part of this repo yet (it's being repointed from an
existing prototype at a later step). This repo currently holds the backend.

## Project structure

```
backend/
  app/
    main.py              FastAPI app, CORS, router wiring
    config.py             Env-driven settings (API key, models, CORS origin)
    schemas.py             Pydantic request/response models for all 3 endpoints
    routers/
      study_plan.py        POST /generate-study-plan
      pyq.py                POST /analyze-pyqs
      notes.py              POST /summarize-notes
    services/
      llm_client.py          Provider fallback: Gemini first, Groq if it fails
      gemini_client.py     google-genai wrapper: structured output, safety
                            settings, timeout + bounded retry-with-backoff
      groq_client.py         Groq fallback wrapper: JSON mode + schema validation
      scheduler.py          Deterministic day-by-day scheduling (Study Plan)
      frequency.py           Deterministic topic/type frequency tallying (PYQ)
  tests/
    test_scheduler.py       Unit tests for scheduling arithmetic
    test_frequency.py        Unit tests for frequency arithmetic
    test_llm_client.py        Unit tests for the Gemini→Groq fallback logic
requirements.txt
.env.example
```

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
copy .env.example .env            # then fill in GEMINI_API_KEY
```

Get a Gemini API key at https://ai.google.dev/gemini-api/docs/api-key, and
(optionally, for the fallback) a Groq API key at https://console.groq.com/keys.
The app works with only `GEMINI_API_KEY` set — Groq is only used if Gemini
fails.

## Running the API

```bash
cd backend
uvicorn app.main:app --reload
```

The app boots and serves `/health`, `/docs`, and `/openapi.json` even
without a `GEMINI_API_KEY` set — the key is only required when an endpoint
actually calls Gemini.

## Running tests

```bash
cd backend
pytest tests/ -v
```

Tests cover only the deterministic layer (scheduler, frequency tallying) —
no LLM calls, no API key required. This matches the FRD's correctness
requirement: all arithmetic must be unit-tested independently of the model.

## Endpoints

### `POST /generate-study-plan`
**In:** subjects (topics/syllabus, priority, difficulty), grade level, total
days, hours/day.
**Gemini's role:** break each subject into weighted learning units (effort
1–5). **Code's role:** deterministically schedule units across days —
interleave subjects, place practice the day after learning, space out
revision, never exceed the daily time budget.

### `POST /analyze-pyqs`
**In:** subject, grade level, pasted previous-year questions (any format).
**Gemini's role:** classify each question by topic, type, and difficulty.
**Code's role:** all frequency counts and percentages, computed in Python.

### `POST /summarize-notes`
**In:** subject, grade level, pasted notes, style (structured / bullet /
exam-focused).
**Gemini's role:** summarize and extract key terms in one call. Long pastes
are chunked (not truncated) and merged.

## Environment variables

See `.env.example`:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side only, never sent to the frontend |
| `GEMINI_FLASH_MODEL` | Flash-tier model for classification/breakdown tasks |
| `GEMINI_PRO_MODEL` | Pro-tier model, reserved for longer notes summaries |
| `GROQ_API_KEY` | Fallback provider, only called if Gemini fails |
| `GROQ_FLASH_MODEL` | Groq model used in place of the Gemini flash tier |
| `GROQ_PRO_MODEL` | Groq model used in place of the Gemini pro tier |
| `CORS_ORIGIN` | Restrict API access to the known frontend origin |
| `REQUEST_TIMEOUT_SECONDS` | Per-call timeout |
| `REQUEST_MAX_RETRIES` | Bounded retry-with-backoff on transient failures |

Confirm current Gemini model names at https://ai.google.dev before
deploying — the lineup changes fast.

## Status

Backend scaffold complete: schemas, routers, deterministic scheduler and
frequency logic (unit-tested), and a Gemini client wrapper with structured
output, explicit safety settings, and bounded retries. Not yet done:
wiring in the existing React frontend, end-to-end testing against live
Gemini calls, and confirming exact model names at implementation time.
