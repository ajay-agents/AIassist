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

---

## Quickstart

Two terminals: one for the API, one for the test dashboard.

```bash
# clone / cd into the repo, then:
python -m venv .venv && .venv\Scripts\activate     # Windows; use .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
copy .env.example .env                              # then paste in GEMINI_API_KEY

cd backend
uvicorn app.main:app --reload                        # terminal 1 — API on http://localhost:8000
```

```bash
cd streamlit_app
pip install -r requirements.txt
streamlit run app.py                                  # terminal 2 — dashboard on http://localhost:8501
```

Open the dashboard, click **Check health** in the sidebar, then try each of
the three tabs. See [Troubleshooting](#troubleshooting) if either side
won't start.

---

## Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React (Vite) — not in this repo yet | Forms + results for the three tools; talks to the backend only |
| Test console | Streamlit (`streamlit_app/`) | Manual harness for testers ahead of the real frontend |
| Backend | FastAPI (`backend/`) | Validation, orchestration, deterministic computation |
| LLM layer | Gemini API (`google-genai`), Groq as fallback | Content understanding, classification, generation |
| Deterministic layer | Plain Python | Scheduling math and frequency tallying — never the model |

**Fallback:** every router calls `backend/app/services/llm_client.py`, which
tries Gemini first (including Gemini's own bounded retry-with-backoff) and
only falls back to Groq if Gemini fails outright. Groq has no native
`response_schema`, so its schema is embedded in the prompt and JSON mode
forces valid syntax; pydantic then validates the shape, giving callers the
same contract regardless of which provider answered. If both providers
fail, the caller gets one clear error naming both failures. Which provider
and model actually answered is exposed via response headers (see
[Response headers](#response-headers)) — not the JSON body, so the contract
the eventual React frontend depends on never changes shape.

**Model tiers (GEM-3):** Study Plan and PYQ classification always use the
flash tier. Notes Summarizer picks flash or pro per request: pastes longer
than `NOTES_PRO_TIER_CHAR_THRESHOLD` characters (default 4000) get the pro
tier for stronger reasoning; shorter pastes stay on flash.

---

## Project structure

```
backend/
  app/
    main.py                  FastAPI app, CORS, router wiring
    config.py                 Env-driven settings (keys, models, thresholds)
    schemas.py                 Pydantic request/response models for all 3 endpoints
    routers/
      study_plan.py             POST /generate-study-plan
      pyq.py                     POST /analyze-pyqs
      notes.py                   POST /summarize-notes
    services/
      llm_client.py                Provider fallback: Gemini first, Groq if it fails;
                                    exposes which provider/model answered
      gemini_client.py              google-genai wrapper: structured output, safety
                                     settings, timeout + bounded retry-with-backoff
      groq_client.py                 Groq fallback wrapper: JSON mode + schema validation
      scheduler.py                    Deterministic day-by-day scheduling (Study Plan)
      frequency.py                     Deterministic topic/type frequency tallying (PYQ)
  tests/
    test_scheduler.py                Unit tests for scheduling arithmetic
    test_frequency.py                 Unit tests for frequency arithmetic
    test_llm_client.py                 Unit tests for the Gemini→Groq fallback logic
    test_routers.py                     Route-level tests: headers, tier selection, validation
  pytest.ini
requirements.txt
.env.example
streamlit_app/
  app.py                       Manual test console — not the production frontend
  requirements.txt              Runtime deps (streamlit, requests)
  requirements-dev.txt           + pytest, for the tests below
  tests/
    test_app.py                   Headless UI tests (mocked backend, no API keys needed)
```

---

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
fails. With neither key set, the API still boots and serves `/health`,
`/docs`, and validation errors; only calls that reach the LLM layer fail
(with a clear 502).

## Running the API

```bash
cd backend
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for interactive OpenAPI docs. Pick a
different port with `--port` if 8000 is already in use on your machine —
check first with `netstat -ano | findstr :8000` (Windows) so you don't
collide with something unrelated already listening there.

## Running the test console (Streamlit)

A throwaway UI for manually exercising all three endpoints — not the
production frontend, just for sending this to testers before the real React
UI is wired up.

```bash
cd streamlit_app
pip install -r requirements.txt
streamlit run app.py
```

It defaults to `http://localhost:8000`; point it elsewhere by setting
`STUDY_DESK_API_URL` or editing the "API base URL" field in the sidebar,
which also has a health-check button. Each tab (Study Plan / PYQ Analysis /
Notes Summarizer) posts straight to the matching backend endpoint and
renders the response:

- **Study Plan** — an editable subjects list (add/remove rows) and a
  day-by-day schedule rendered as markdown tables.
- **PYQ Analysis** — paste questions, get topic/type frequency as progress
  bars plus the high-yield topics and strategy insight.
- **Notes Summarizer** — paste notes, pick a style, get the rendered
  markdown summary and key terms. A live character counter hints when the
  pro-tier model will kick in.

After each successful call, a caption shows which provider/model answered
and how long it took (e.g. `provider: gemini · model: gemini-3.6-flash ·
tier: flash · 1.8s`) — pulled from response headers, useful for confirming
the Gemini→Groq fallback and the flash/pro switch are firing as expected.

The console deliberately avoids `st.dataframe`/`st.data_editor`/`st.bar_chart`
— see [Troubleshooting](#troubleshooting) for why.

## Running tests

```bash
cd backend
pip install -r ../requirements.txt
pytest tests/ -v
```

Covers the deterministic layer (scheduler, frequency tallying — no LLM
calls, no API key needed) plus route-level tests that mock the LLM layer to
verify response headers, the notes pro/flash tier switch, and validation
error paths. This matches the FRD's correctness requirement: all arithmetic
must be unit-tested independently of the model.

```bash
cd streamlit_app
pip install -r requirements-dev.txt
pytest tests/ -v
```

Headlessly executes the dashboard script (via Streamlit's `AppTest`) with
`requests.post`/`requests.get` mocked, driving every button and asserting
no exceptions and correct rendering — no live backend or API keys needed.

---

## Endpoints

### `POST /generate-study-plan`
**In:** subjects (topics/syllabus, priority, difficulty), grade level, total
days, hours/day.
**Gemini's role:** break each subject into weighted learning units (effort
1–5). **Code's role:** deterministically schedule units across days —
interleave subjects, place practice the day after learning, space out
revision, never exceed the daily time budget. Always uses the flash tier.

### `POST /analyze-pyqs`
**In:** subject, grade level, pasted previous-year questions (any format).
**Gemini's role:** classify each question by topic, type, and difficulty,
then (a second, best-effort call) write a short strategy insight.
**Code's role:** all frequency counts and percentages, computed in Python.
Always uses the flash tier.

### `POST /summarize-notes`
**In:** subject, grade level, pasted notes, style (structured / bullet /
exam-focused).
**Gemini's role:** summarize and extract key terms in one call per chunk.
**Code's role:** chunk long pastes instead of truncating them, merge
per-chunk results, and reject (422) if the model returns an empty summary
or no key terms. Uses the pro tier automatically once the pasted notes
exceed `NOTES_PRO_TIER_CHAR_THRESHOLD` characters (default 4000);
otherwise flash.

### Response headers

None of the JSON response shapes above change — these are extra headers
only, so the eventual React frontend's contract stays stable:

| Header | Meaning |
|---|---|
| `X-LLM-Provider` | `gemini` or `groq` — whichever actually answered (`mixed` for Notes if chunks split across providers) |
| `X-LLM-Model` | The exact model ID used |
| `X-LLM-Tier` | `flash` or `pro` |
| `X-LLM-Insight-Provider` | PYQ only — provider used for the (best-effort) strategy insight call |

---

## Environment variables

See `.env.example`:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side only, never sent to the frontend |
| `GEMINI_FLASH_MODEL` | Flash-tier model for classification/breakdown tasks |
| `GEMINI_PRO_MODEL` | Pro-tier model, used for longer notes summaries |
| `GROQ_API_KEY` | Fallback provider, only called if Gemini fails |
| `GROQ_FLASH_MODEL` | Groq model used in place of the Gemini flash tier |
| `GROQ_PRO_MODEL` | Groq model used in place of the Gemini pro tier |
| `NOTES_PRO_TIER_CHAR_THRESHOLD` | Notes pastes longer than this (chars) use the pro tier |
| `CORS_ORIGIN` | Restrict API access to the known frontend origin |
| `REQUEST_TIMEOUT_SECONDS` | Per-call timeout |
| `REQUEST_MAX_RETRIES` | Bounded retry-with-backoff on transient failures |

Confirm current Gemini and Groq model names before deploying — both
lineups change fast. Check https://ai.google.dev/gemini-api/docs/models and
https://console.groq.com/docs/models.

---

## Troubleshooting

**`ImportError: DLL load failed ... pyarrow` when running the dashboard.**
Some locked-down Windows machines block `pyarrow`'s native DLL via
Application Control policy. `st.dataframe`, `st.data_editor`, `st.table`,
and `st.bar_chart` all lazily `import pyarrow` the moment they're called,
even though the app never imports it directly. The dashboard avoids all of
these already (subjects are plain widgets backed by `st.session_state`;
results render as markdown tables and `st.progress` bars) — if you hit this
again after pulling changes, check whether a new widget call reintroduced
one of them.

**Dashboard shows "Unreachable" on Check health, or endpoint calls fail to
connect.** The API isn't running, or the "API base URL" in the sidebar
doesn't match. Confirm `uvicorn` is up with
`curl http://localhost:8000/health` and that the port matches
`STUDY_DESK_API_URL` / the sidebar field.

**A request returns `502` mentioning both Gemini and Groq errors.** Both
providers failed — almost always missing/invalid API keys, or no network
access. Check `GEMINI_API_KEY` (and `GROQ_API_KEY` if you rely on the
fallback) in `.env`. Validation errors (missing fields, empty text) return
`422` instead and never reach the LLM layer at all.

**Port 8000 (or whichever port you pick) is already serving something
else.** Before starting `uvicorn`, check what's listening:
`netstat -ano | findstr :8000` (Windows) — if it's an unrelated process,
pick a different `--port` rather than assuming it's safe to kill.

---

## Status

Backend: schemas, routers, deterministic scheduler and frequency logic,
Gemini client (structured output, explicit safety settings, bounded
retries), Groq fallback, and the notes flash/pro tier switch — all
unit- and route-tested. Streamlit test console: all three tools wired up,
headless UI tests included, and pyarrow-safe for locked-down Windows
machines. Not yet done: wiring in the existing React frontend and
end-to-end testing against live Gemini/Groq calls (everything so far has
been verified with mocked LLM responses, since no live API keys are
configured in this environment).
