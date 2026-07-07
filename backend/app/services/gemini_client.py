"""Thin wrapper around google-genai: structured output, explicit safety
settings, and bounded retry-with-backoff on every call. See GEM-1..GEM-5
in the FRD — nothing here should assume a Gemini-specific response shape
beyond the response_schema contract.
"""

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

# Academic content (History, Biology, etc.) must not be blocked by
# default safety thresholds — GEM-4.
_SAFETY_SETTINGS = [
    types.SafetySetting(category=category, threshold="BLOCK_ONLY_HIGH")
    for category in (
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
    )
]


class GeminiClient:
    def __init__(self) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)

    @retry(
        stop=stop_after_attempt(settings.request_max_retries),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    def generate_structured(self, *, model: str, prompt: str, response_schema: type) -> dict:
        """Call Gemini with a forced JSON response_schema. Retries transient
        failures with backoff; malformed-input errors should be caught by the
        caller and turned into a 400/422, not retried.
        """
        response = self._client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                safety_settings=_SAFETY_SETTINGS,
                http_options=types.HttpOptions(timeout=int(settings.request_timeout_seconds * 1000)),
            ),
        )
        return response.parsed


_client_instance: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    """Lazy singleton — the app must be importable (routes, OpenAPI schema,
    tests) even before a GEMINI_API_KEY is configured; only actual calls
    need the key."""
    global _client_instance
    if _client_instance is None:
        _client_instance = GeminiClient()
    return _client_instance
