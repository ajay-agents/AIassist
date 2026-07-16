"""Fallback LLM provider. Groq is only ever called when Gemini has failed —
see llm_client.py for the fallback ordering. Groq has no native
response_schema like Gemini's, so the JSON Schema is embedded in the prompt
and JSON mode forces valid-JSON syntax; pydantic then validates the shape,
giving callers the same guarantee as the Gemini path.
"""

import json

from groq import Groq
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings


class GroqClient:
    def __init__(self) -> None:
        self._client = Groq(api_key=settings.groq_api_key, timeout=settings.request_timeout_seconds)

    @retry(
        stop=stop_after_attempt(settings.request_max_retries),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    def generate_structured(self, *, model: str, prompt: str, response_schema: type[BaseModel]) -> BaseModel:
        schema_json = json.dumps(response_schema.model_json_schema())
        completion = self._client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Respond with a single JSON object that matches this JSON Schema "
                        f"exactly, with no extra commentary or markdown fences:\n{schema_json}"
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content
        return response_schema.model_validate(json.loads(raw))


_client_instance: GroqClient | None = None


def get_groq_client() -> GroqClient:
    """Lazy singleton — mirrors gemini_client.get_gemini_client so the app is
    importable before a GROQ_API_KEY is configured; only actual fallback
    calls need the key."""
    global _client_instance
    if _client_instance is None:
        _client_instance = GroqClient()
    return _client_instance
