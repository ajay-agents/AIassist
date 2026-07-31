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

Two terminals: one for the API, one for the React app.

```bash
# clone / cd into the repo, then:
python -m venv .venv && .venv\Scripts\activate     # Windows; use .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
copy .env.example .env                              # then paste in GEMINI_API_KEY

cd backend
python -m uvicorn app.main:app --reload               # terminal 1 — API on http://localhost:8000
```

```bash
cd frontend
npm install
npm run dev                                            # terminal 2 — React app on http://localhost:5173
```

Open the app, click **Check health**, then try each of the three tabs. See
[Troubleshooting](#troubleshooting) if it won't start. A Streamlit test
console also exists (`streamlit_app/`) as a lighter-weight alternative —
see [Running the Streamlit test console](#running-the-streamlit-test-console).

---

## Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind (`frontend/`) | Polished UI for the three tools; PDF upload, talks to the backend only |
| Test console | Streamlit (`streamlit_app/`) | Lighter-weight manual harness, alternative to the React app |
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
both frontends depend on never changes shape.

**PDF upload:** both the React app and the Streamlit console let a tester
upload a PDF instead of pasting text. Extraction happens entirely
client-side (`pdfjs-dist` in React, `pypdf` in Streamlit) — the backend
never sees a PDF or knows they exist; it only ever receives plain text in
the same JSON fields a pasted-text request would use.

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
frontend/
  src/
    App.tsx                       Tab shell: API base URL config, health check, the 3 tools
    api/
      types.ts                      TypeScript mirror of backend/app/schemas.py
      client.ts                      fetch wrapper: typed errors, X-LLM-* header parsing
    lib/
      pdfText.ts                     Client-side PDF extraction (pdfjs-dist) — lazy-loaded
      pdfExtractionError.ts           Error class, split out so importing it doesn't pull in pdfjs-dist
    components/
      PdfUpload.tsx                   Reusable "or upload a PDF" control, used by all 3 tools
      ui/Primitives.tsx                Shared Tailwind building blocks (Card, Chip, FrequencyBar, ...)
    hooks/
      useApiBaseUrl.ts                 localStorage-persisted API base URL
    features/
      studyPlan/StudyPlanTool.tsx       Subjects form + collapsible day-by-day roadmap
      pyq/PyqTool.tsx                    Questions form + frequency bars/chips/insight
      notes/NotesTool.tsx                Notes form + rendered markdown summary + glossary
  package.json
  .env.example                    VITE_API_BASE_URL
streamlit_app/
  app.py                       Lighter-weight test console — alternative to the React app
  pdf_utils.py                  PDF→text extraction (client-side, no backend change)
  html_render.py                 Renders each tool's JSON result as a polished, sanitized HTML report
  requirements.txt              Runtime deps (streamlit, requests, pypdf, markdown, bleach)
  requirements-dev.txt           + pytest, for the tests below
  tests/
    test_app.py                   Headless UI tests (mocked backend, no API keys needed)
    test_pdf_utils.py               PDF extraction error-handling tests (mocked PdfReader)
    test_html_render.py              HTML rendering tests, incl. XSS-sanitization checks
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
python -m uvicorn app.main:app --reload
```

Use `python -m uvicorn ...` rather than the bare `uvicorn` command — see
[Troubleshooting](#troubleshooting) if the bare command fails with an
Application Control policy error.

Visit `http://localhost:8000/docs` for interactive OpenAPI docs. Pick a
different port with `--port` if 8000 is already in use on your machine —
check first with `netstat -ano | findstr :8000` (Windows) so you don't
collide with something unrelated already listening there.

## Running the frontend (React)

The primary, polished UI for testers and users.

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173` by default (Vite's default port, which is
also what `CORS_ORIGIN` defaults to in `.env` — see
[Troubleshooting](#troubleshooting) if you change either one without the
other). Point it at a different backend by setting `VITE_API_BASE_URL`
(copy `frontend/.env.example` to `frontend/.env`) or editing the "API base
URL" field in the header, which persists to `localStorage` and has a
health-check button.

Every text input can also be filled by uploading a PDF instead of pasting —
extraction happens client-side via `pdfjs-dist` (`src/lib/pdfText.ts`),
dynamically imported only once a file is actually chosen so the ~1MB
library never bloats the initial page load. Each tab posts to the matching
backend endpoint and renders the result with Tailwind:

- **Study Plan** — an editable subjects list (add/remove rows, or upload a
  syllabus PDF to add one automatically) rendered as a collapsible
  day-by-day roadmap with time-budget usage bars.
- **PYQ Analysis** — paste questions or upload a PDF of past papers; get
  topic/type frequency as percentage bars, high-yield topic chips, and the
  strategy insight.
- **Notes Summarizer** — paste notes or upload a PDF, pick a style, get an
  expert-tutor-quality markdown summary (rendered via `react-markdown`,
  which never executes raw HTML) plus a key-terms glossary. A live
  character counter hints when the pro-tier model will kick in.

After each successful call, a line shows which provider/model answered and
how long it took — pulled from the `X-LLM-*` response headers, useful for
confirming the Gemini→Groq fallback and the flash/pro switch are firing as
expected.

### Running the Streamlit test console

A lighter-weight alternative to the React app — same three tools, same PDF
upload and provider/tier visibility, rendered as a downloadable standalone
HTML report instead of a full SPA. Useful when you just want a quick
backend sanity check without an npm install.

```bash
cd streamlit_app
pip install -r requirements.txt
python -m streamlit run app.py
```

(Use `python -m streamlit run app.py` rather than the bare `streamlit`
command — see [Troubleshooting](#troubleshooting).) It defaults to
`http://localhost:8000`; point it elsewhere via `STUDY_DESK_API_URL` or the
sidebar's "API base URL" field.

## Running tests

```bash
cd backend
pip install -r ../requirements.txt
python -m pytest tests/ -v
```

Covers the deterministic layer (scheduler, frequency tallying — no LLM
calls, no API key needed) plus route-level tests that mock the LLM layer to
verify response headers, the notes pro/flash tier switch, and validation
error paths. This matches the FRD's correctness requirement: all arithmetic
must be unit-tested independently of the model.

```bash
cd frontend
npm install
npm run test
```

Vitest + React Testing Library: the API client (error parsing, header
parsing), the PDF extraction lib and upload component (mocked pdfjs-dist —
real PDF parsing needs a browser, so these test our own error-handling and
text-joining logic instead), and each tool component's happy-path and
error-path rendering (mocked API client, no live backend needed).

```bash
cd streamlit_app
pip install -r requirements-dev.txt
python -m pytest tests/ -v
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
only, so both frontends' contract stays stable:

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

See `frontend/.env.example` for the frontend's one variable:

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Default backend URL, baked in at build time (overridable at runtime in the header) |

---

## Troubleshooting

**`Program 'uvicorn.exe' failed to run: An Application Control policy has
blocked this file` (or the same for `streamlit.exe` / `pytest.exe`).** pip
installs a small standalone launcher executable for each
(`venv\Scripts\uvicorn.exe`, `streamlit.exe`, `pytest.exe`...), separate
from `python.exe`. On machines with an Application Control policy
(WDAC/AppLocker), those stubs often aren't allowlisted even though
`python.exe` itself is (it's what ran your `pip install`). Fix: invoke the
module through Python instead of the stub — `python -m uvicorn
app.main:app --reload`, `python -m streamlit run app.py`, `python -m
pytest tests/ -v` — which is what every command in this README already
uses.

**`ImportError: DLL load failed ... pyarrow` when running the dashboard.**
Some locked-down Windows machines block `pyarrow`'s native DLL via
Application Control policy. `st.dataframe`, `st.data_editor`, `st.table`,
and `st.bar_chart` all lazily `import pyarrow` the moment they're called,
even though the app never imports it directly. The dashboard avoids all of
these already (subjects are plain widgets backed by `st.session_state`;
results render as markdown tables and `st.progress` bars) — if you hit this
again after pulling changes, check whether a new widget call reintroduced
one of them.

**The app (React or Streamlit) shows "Unreachable" on Check health, or
endpoint calls fail to connect.** The API isn't running, or the "API base
URL" field doesn't match. Confirm `uvicorn` is up with
`curl http://localhost:8000/health` and that the port matches
`VITE_API_BASE_URL` / `STUDY_DESK_API_URL` / the header or sidebar field.

**React app's requests fail in the browser console with a CORS error, even
though `curl` against the same endpoint works fine.** `curl` doesn't
enforce CORS, so it can't catch this — only a real browser does.
`CORS_ORIGIN` in `.env` must exactly match the origin the frontend is
actually served from (scheme + host + port). The default `.env`
(`http://localhost:5173`) matches Vite's default port; if you run
`npm run dev -- --port <other>` or deploy the frontend elsewhere, update
`CORS_ORIGIN` (and restart the backend — it's read once at startup) to
match.

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
unit- and route-tested. React frontend: all three tools built with Tailwind,
PDF upload (lazy-loaded, ~1MB `pdfjs-dist` kept out of the initial bundle),
provider/tier visibility, 25 passing tests (API client, PDF extraction,
component rendering), production build verified. Streamlit test console:
same three tools, headless UI tests included, pyarrow-safe for locked-down
Windows machines. End-to-end request/response flow (including CORS between
the React dev server and the backend) verified against a live backend
process. Not yet done: testing against live Gemini/Groq calls with real API
keys (everything so far has been verified with mocked LLM responses).
