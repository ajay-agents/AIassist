from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import notes, pyq, study_plan

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
