"""Provider-agnostic entry point for structured LLM calls. Gemini is the
primary provider (GEM-1..GEM-5); Groq is a fallback used only if Gemini
fails outright, including after Gemini's own bounded retry-with-backoff.
Routers should call generate_structured() here rather than reaching into
gemini_client or groq_client directly, so the fallback is applied uniformly.
"""

from dataclasses import dataclass
from typing import Literal

from fastapi import Response

from app.config import settings
from app.services.gemini_client import get_gemini_client
from app.services.groq_client import get_groq_client

ModelTier = Literal["flash", "pro"]

_GEMINI_MODELS = {"flash": lambda: settings.gemini_flash_model, "pro": lambda: settings.gemini_pro_model}
_GROQ_MODELS = {"flash": lambda: settings.groq_flash_model, "pro": lambda: settings.groq_pro_model}


@dataclass
class LLMResult:
    """Wraps the parsed response together with which provider/model actually
    answered, so callers can surface that for debugging/testing (e.g. as
    response headers) without it becoming part of the JSON contract."""

    data: object
    provider: Literal["gemini", "groq"]
    model: str


def generate_structured(*, model_tier: ModelTier, prompt: str, response_schema: type) -> LLMResult:
    gemini_model = _GEMINI_MODELS[model_tier]()
    try:
        data = get_gemini_client().generate_structured(
            model=gemini_model, prompt=prompt, response_schema=response_schema
        )
        return LLMResult(data=data, provider="gemini", model=gemini_model)
    except Exception as gemini_exc:  # noqa: BLE001 — any Gemini failure triggers the Groq fallback
        groq_model = _GROQ_MODELS[model_tier]()
        try:
            data = get_groq_client().generate_structured(
                model=groq_model, prompt=prompt, response_schema=response_schema
            )
            return LLMResult(data=data, provider="groq", model=groq_model)
        except Exception as groq_exc:  # noqa: BLE001 — surfaced to the caller as one clear error
            raise RuntimeError(
                f"Both Gemini and Groq failed for this request. "
                f"Gemini error: {gemini_exc!r}. Groq error: {groq_exc!r}."
            ) from groq_exc


def set_llm_headers(response: Response, result: LLMResult, model_tier: ModelTier) -> None:
    """Expose which provider/model actually answered as response headers —
    useful for testers, without changing the JSON response contract (NFR:
    Portability)."""
    response.headers["X-LLM-Provider"] = result.provider
    response.headers["X-LLM-Model"] = result.model
    response.headers["X-LLM-Tier"] = model_tier
