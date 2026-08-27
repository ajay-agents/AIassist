import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import notes, pyq, study_plan

# Makes the per-call token-usage logging in gemini_client.py/groq_client.py
# actually visible — the FRD's own Risks section calls for tracking usage
# per call from day one, ahead of hitting a free-tier quota. This is
# basicConfig'd here (the application entry point), not inside the service
# modules themselves, per standard logging practice.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Study Desk API", version="1.2.0")

# CORS restricted to the known frontend origin only — NFR: Security.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["POST"],
    allow_headers=["*"],
)

app.include_router(study_plan.router, tags=["study-plan"])
app.include_router(pyq.router, tags=["pyq"])
app.include_router(notes.router, tags=["notes"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/health/models")
def health_models() -> dict:
    """On-demand diagnostic — verifies the configured Gemini/Groq model
    names are actually available right now, rather than waiting to find
    out from a live request's 404. Both providers' lineups have already
    changed under this project once each; call this after any deploy or
    whenever a request starts failing with model_not_found. Deliberately
    NOT part of the plain /health liveness check, since it makes real
    network calls to both providers and shouldn't gate basic uptime."""
    from app.services.gemini_client import get_gemini_client
    from app.services.groq_client import get_groq_client

    results: dict[str, dict] = {}

    for tier, model in (("gemini_flash", settings.gemini_flash_model), ("gemini_pro", settings.gemini_pro_model)):
        try:
            get_gemini_client()._client.models.get(model=model)
            results[tier] = {"provider": "gemini", "model": model, "available": True}
        except Exception as exc:  # noqa: BLE001 — reporting availability, not raising
            results[tier] = {"provider": "gemini", "model": model, "available": False, "error": str(exc)}

    for tier, model in (("groq_flash", settings.groq_flash_model), ("groq_pro", settings.groq_pro_model)):
        try:
            get_groq_client()._client.models.retrieve(model)
            results[tier] = {"provider": "groq", "model": model, "available": True}
        except Exception as exc:  # noqa: BLE001 — reporting availability, not raising
            results[tier] = {"provider": "groq", "model": model, "available": False, "error": str(exc)}

    return results
