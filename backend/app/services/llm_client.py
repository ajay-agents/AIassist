"""Provider-agnostic entry point for structured LLM calls. Gemini is the
primary provider (GEM-1..GEM-5); Groq is a fallback used only if Gemini
fails outright, including after Gemini's own bounded retry-with-backoff.
Routers should call generate_structured() here rather than reaching into
gemini_client or groq_client directly, so the fallback is applied uniformly.
"""

from typing import Literal

from app.config import settings
from app.services.gemini_client import get_gemini_client
from app.services.groq_client import get_groq_client

ModelTier = Literal["flash", "pro"]

_GEMINI_MODELS = {"flash": lambda: settings.gemini_flash_model, "pro": lambda: settings.gemini_pro_model}
_GROQ_MODELS = {"flash": lambda: settings.groq_flash_model, "pro": lambda: settings.groq_pro_model}


def generate_structured(*, model_tier: ModelTier, prompt: str, response_schema: type):
    try:
        return get_gemini_client().generate_structured(
            model=_GEMINI_MODELS[model_tier](), prompt=prompt, response_schema=response_schema
        )
    except Exception as gemini_exc:  # noqa: BLE001 — any Gemini failure triggers the Groq fallback
        try:
            return get_groq_client().generate_structured(
                model=_GROQ_MODELS[model_tier](), prompt=prompt, response_schema=response_schema
            )
        except Exception as groq_exc:  # noqa: BLE001 — surfaced to the caller as one clear error
            raise RuntimeError(
                f"Both Gemini and Groq failed for this request. "
                f"Gemini error: {gemini_exc!r}. Groq error: {groq_exc!r}."
            ) from groq_exc
