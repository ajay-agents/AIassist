from fastapi.testclient import TestClient

from app.main import app
from app.routers import notes as notes_router
from app.routers import pyq as pyq_router
from app.routers import study_plan as study_plan_router
from app.schemas import ClassifiedQuestion, LearningUnit, NotesResponse
from app.services.llm_client import LLMResult

client = TestClient(app)


def test_study_plan_reports_llm_provenance_headers(monkeypatch):
    breakdown = study_plan_router._PlanBreakdown(
        units=[LearningUnit(subject="Physics", topic="Kinematics", effort=3)],
        summary="Focus on mechanics this week.",
    )

    def fake_generate_structured(*, model_tier, prompt, response_schema):
        return LLMResult(data=breakdown, provider="gemini", model="gemini-3.6-flash")

    monkeypatch.setattr(study_plan_router, "generate_structured", fake_generate_structured)

    resp = client.post(
        "/generate-study-plan",
        json={
            "subjects": [{"name": "Physics", "topics_or_syllabus": "Kinematics", "priority": 3, "difficulty": 3}],
            "grade_level": "Grade 10",
            "total_days": 3,
            "hours_per_day": 2,
        },
    )

    assert resp.status_code == 200
    assert resp.headers["X-LLM-Provider"] == "gemini"
    assert resp.headers["X-LLM-Model"] == "gemini-3.6-flash"
    assert resp.headers["X-LLM-Tier"] == "flash"
    body = resp.json()
    assert body["summary"] == "Focus on mechanics this week."
    assert any(s["topic"] == "Kinematics" for day in body["days"] for s in day["sessions"])


def test_pyq_reports_provider_used_including_insight(monkeypatch):
    classification = pyq_router._PyqClassification(
        questions=[
            ClassifiedQuestion(text="What is velocity?", topic="Kinematics", question_type="MCQ", difficulty="easy")
        ]
    )
    insight = pyq_router._StrategyInsight(strategy_insight="Focus on Kinematics.")

    calls = {"n": 0}

    def fake_generate_structured(*, model_tier, prompt, response_schema):
        calls["n"] += 1
        if calls["n"] == 1:
            return LLMResult(data=classification, provider="gemini", model="gemini-3.6-flash")
        return LLMResult(data=insight, provider="groq", model="llama-3.1-8b-instant")

    monkeypatch.setattr(pyq_router, "generate_structured", fake_generate_structured)

    resp = client.post(
        "/analyze-pyqs",
        json={"subject": "Physics", "grade_level": "Grade 10", "questions_text": "What is velocity?"},
    )

    assert resp.status_code == 200
    assert resp.headers["X-LLM-Provider"] == "gemini"
    assert resp.headers["X-LLM-Insight-Provider"] == "groq"
    body = resp.json()
    assert body["strategy_insight"] == "Focus on Kinematics."
    assert body["topic_frequency"][0]["label"] == "Kinematics"


def test_notes_uses_flash_tier_for_short_notes(monkeypatch):
    seen_tiers = []

    def fake_generate_structured(*, model_tier, prompt, response_schema):
        seen_tiers.append(model_tier)
        return LLMResult(
            data=NotesResponse(summary_markdown="A short summary.", key_terms=["velocity"]),
            provider="gemini",
            model="gemini-3.6-flash",
        )

    monkeypatch.setattr(notes_router, "generate_structured", fake_generate_structured)

    resp = client.post(
        "/summarize-notes",
        json={"subject": "Physics", "grade_level": "Grade 10", "notes_text": "short notes", "style": "structured"},
    )

    assert resp.status_code == 200
    assert seen_tiers == ["flash"]
    assert resp.headers["X-LLM-Tier"] == "flash"


def test_notes_uses_pro_tier_for_long_notes(monkeypatch):
    seen_tiers = []

    def fake_generate_structured(*, model_tier, prompt, response_schema):
        seen_tiers.append(model_tier)
        return LLMResult(
            data=NotesResponse(summary_markdown="A summary.", key_terms=["term"]),
            provider="gemini",
            model="gemini-2.5-pro",
        )

    monkeypatch.setattr(notes_router, "generate_structured", fake_generate_structured)

    long_notes = "word " * 2000  # comfortably over the pro-tier char threshold
    resp = client.post(
        "/summarize-notes",
        json={"subject": "Physics", "grade_level": "Grade 10", "notes_text": long_notes, "style": "structured"},
    )

    assert resp.status_code == 200
    assert all(tier == "pro" for tier in seen_tiers)
    assert resp.headers["X-LLM-Tier"] == "pro"


def test_notes_rejects_empty_summary_from_llm(monkeypatch):
    def fake_generate_structured(*, model_tier, prompt, response_schema):
        return LLMResult(
            data=NotesResponse(summary_markdown="   ", key_terms=[]), provider="gemini", model="gemini-3.6-flash"
        )

    monkeypatch.setattr(notes_router, "generate_structured", fake_generate_structured)

    resp = client.post(
        "/summarize-notes",
        json={"subject": "Physics", "grade_level": "Grade 10", "notes_text": "some notes", "style": "structured"},
    )

    assert resp.status_code == 422


def test_generate_study_plan_rejects_empty_subjects():
    resp = client.post(
        "/generate-study-plan",
        json={"subjects": [], "grade_level": "Grade 10", "total_days": 3, "hours_per_day": 2},
    )
    assert resp.status_code == 422


def test_analyze_pyqs_rejects_empty_questions_text():
    resp = client.post(
        "/analyze-pyqs", json={"subject": "Physics", "grade_level": "Grade 10", "questions_text": ""}
    )
    assert resp.status_code == 422
