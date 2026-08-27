"""Thin wrapper around google-genai: structured output, explicit safety
settings, and bounded retry-with-backoff on every call. See GEM-1..GEM-5
in the FRD — nothing here should assume a Gemini-specific response shape
beyond the response_schema contract.
"""

import logging

import requests
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger(__name__)

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


def _is_transient(exc: BaseException) -> bool:
    """Only retry failures that might actually succeed on a second try.
    An invalid API key or a bad request will fail identically every time —
    retrying those just burns ~7s of backoff before the Groq fallback ever
    gets a chance, which is exactly what happened live with a bad key."""
    if isinstance(exc, genai_errors.ServerError):
        return True
    if isinstance(exc, genai_errors.ClientError):
        return exc.code == 429  # rate limit — a 4xx, but worth retrying
    if isinstance(exc, (requests.exceptions.ConnectionError, requests.exceptions.Timeout)):
        return True
    return False


class GeminiClient:
    def __init__(self) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)

    @retry(
        retry=retry_if_exception(_is_transient),
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

        usage = getattr(response, "usage_metadata", None)
        if usage:
            logger.info(
                "gemini call model=%s prompt_tokens=%s output_tokens=%s total_tokens=%s",
                model,
                getattr(usage, "prompt_token_count", None),
                getattr(usage, "candidates_token_count", None),
                getattr(usage, "total_token_count", None),
            )

        if response.parsed is None:
            # A schema-constrained call returning nothing parsable shouldn't
            # crash downstream code with an AttributeError on None — raise
            # here so the caller's existing except-and-fall-back-to-Groq
            # path handles it like any other failure.
            raise ValueError(f"Gemini returned no parsable structured output for model {model!r}")
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
