// Talks to the FastAPI backend (see backend/app/routers/*.py and
// backend/app/schemas.py for the source of truth this mirrors). Every tab
// component passes its own UI-shaped state in here; this module owns
// translating that into the backend's JSON contract and back.

export const GRADE_LEVELS = [
  "Secondary — Grade 5",
  "Secondary — Grade 6",
  "Secondary — Grade 7",
  "Secondary — Grade 8",
  "Secondary — Grade 9",
  "Secondary — Grade 10",
  "Higher Secondary — Grade 11",
  "Higher Secondary — Grade 12",
  "Undergraduate",
  "Other",
];

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** FastAPI errors are either a plain string (our own HTTPException) or a
 * pydantic validation error array — normalize both into one readable string. */
export function extractErrorMessage(body) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = body.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            const loc = "loc" in item && Array.isArray(item.loc) ? item.loc.join(".") : "";
            return loc ? `${loc}: ${item.msg}` : String(item.msg);
          }
          return JSON.stringify(item);
        })
        .join("; ");
    }
  }
  return "Request failed";
}

function parseLlmMeta(headers, elapsedMs) {
  const provider = headers.get("X-LLM-Provider");
  if (!provider) return null;
  return {
    provider,
    model: headers.get("X-LLM-Model") ?? "?",
    tier: headers.get("X-LLM-Tier") ?? "?",
    insightProvider: headers.get("X-LLM-Insight-Provider") ?? undefined,
    elapsedMs,
  };
}

async function postJson(baseUrl, path, payload, signal) {
  const start = performance.now();
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    // Let an intentional cancellation (AbortController.abort()) propagate
    // as-is so callers can tell "the user stopped this" apart from a real
    // network failure, instead of both looking like the same ApiError.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, `Couldn't reach ${baseUrl} — is the backend running? (${err.message})`);
  }
  const elapsedMs = performance.now() - start;

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      // non-JSON error body — fall through with body=null
    }
    throw new ApiError(response.status, extractErrorMessage(body));
  }

  const data = await response.json();
  return { data, llm: parseLlmMeta(response.headers, elapsedMs) };
}

export async function checkHealth(baseUrl) {
  const start = performance.now();
  try {
    const response = await fetch(`${baseUrl}/health`, { method: "GET" });
    const latencyMs = Math.round(performance.now() - start);
    return { ok: response.ok, latencyMs: response.ok ? latencyMs : null };
  } catch {
    return { ok: false, latencyMs: null };
  }
}

const PRIORITY_TO_NUMBER = { Low: 1, Medium: 3, High: 5 };
const DIFFICULTY_TO_NUMBER = { Easy: 1, Moderate: 3, Difficult: 5 };

export function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

/** subjects: [{ name, topics, priority: "Low"|"Medium"|"High", difficulty: "Easy"|"Moderate"|"Difficult" }] */
export function generateStudyPlan(baseUrl, { gradeLevel, totalDays, hoursPerDay, subjects }, signal) {
  const payload = {
    grade_level: gradeLevel,
    total_days: totalDays,
    hours_per_day: hoursPerDay,
    subjects: subjects
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        topics_or_syllabus: s.topics,
        priority: PRIORITY_TO_NUMBER[s.priority] ?? 3,
        difficulty: DIFFICULTY_TO_NUMBER[s.difficulty] ?? 3,
      })),
  };
  return postJson(baseUrl, "/generate-study-plan", payload, signal);
}

export function analyzePyqs(baseUrl, { subject, gradeLevel, questionsText }, signal) {
  const payload = { subject, grade_level: gradeLevel, questions_text: questionsText };
  return postJson(baseUrl, "/analyze-pyqs", payload, signal);
}

export function summarizeNotes(baseUrl, { subject, gradeLevel, style, notesText }, signal) {
  const payload = { subject, grade_level: gradeLevel, notes_text: notesText, style: style.toLowerCase() };
  return postJson(baseUrl, "/summarize-notes", payload, signal);
}
