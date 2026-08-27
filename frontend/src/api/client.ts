import type {
  ApiResult,
  LlmMeta,
  NotesRequest,
  NotesResponse,
  PyqRequest,
  PyqResponse,
  StudyPlanRequest,
  StudyPlanResponse,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** FastAPI errors are either a plain string (our own HTTPException) or a
 * pydantic validation error array — normalize both into one readable string. */
export function extractErrorMessage(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            const loc = "loc" in item && Array.isArray(item.loc) ? item.loc.join(".") : "";
            return loc ? `${loc}: ${(item as { msg: string }).msg}` : String((item as { msg: string }).msg);
          }
          return JSON.stringify(item);
        })
        .join("; ");
    }
  }
  return "Request failed";
}

function parseLlmMeta(headers: Headers, elapsedMs: number): LlmMeta | null {
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

async function postJson<TResponse>(
  baseUrl: string,
  path: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<ApiResult<TResponse>> {
  const start = performance.now();
  let response: Response;
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
    throw new ApiError(0, `Couldn't reach ${baseUrl} — is the backend running? (${(err as Error).message})`);
  }
  const elapsedMs = performance.now() - start;

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // non-JSON error body — fall through with body=null
    }
    throw new ApiError(response.status, extractErrorMessage(body));
  }

  const data = (await response.json()) as TResponse;
  return { data, llm: parseLlmMeta(response.headers, elapsedMs) };
}

export function checkHealth(baseUrl: string): Promise<{ status: string }> {
  return fetch(`${baseUrl}/health`, { method: "GET" }).then((r) => {
    if (!r.ok) throw new ApiError(r.status, "Health check failed");
    return r.json();
  });
}

export function generateStudyPlan(
  baseUrl: string,
  request: StudyPlanRequest,
  signal?: AbortSignal,
): Promise<ApiResult<StudyPlanResponse>> {
  return postJson<StudyPlanResponse>(baseUrl, "/generate-study-plan", request, signal);
}

export function analyzePyqs(
  baseUrl: string,
  request: PyqRequest,
  signal?: AbortSignal,
): Promise<ApiResult<PyqResponse>> {
  return postJson<PyqResponse>(baseUrl, "/analyze-pyqs", request, signal);
}

export function summarizeNotes(
  baseUrl: string,
  request: NotesRequest,
  signal?: AbortSignal,
): Promise<ApiResult<NotesResponse>> {
  return postJson<NotesResponse>(baseUrl, "/summarize-notes", request, signal);
}
