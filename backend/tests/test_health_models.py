from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.main import app
from app.services import gemini_client, groq_client

client = TestClient(app)


def test_reports_available_true_when_all_models_resolve(monkeypatch):
    fake_gemini = MagicMock()
    fake_gemini._client.models.get.return_value = MagicMock()
    fake_groq = MagicMock()
    fake_groq._client.models.retrieve.return_value = MagicMock()
    monkeypatch.setattr(gemini_client, "get_gemini_client", lambda: fake_gemini)
    monkeypatch.setattr(groq_client, "get_groq_client", lambda: fake_groq)

    resp = client.get("/health/models")

    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"gemini_flash", "gemini_pro", "groq_flash", "groq_pro"}
    assert all(entry["available"] is True for entry in body.values())


def test_reports_available_false_with_error_for_a_missing_model_without_failing_the_others(monkeypatch):
    fake_gemini = MagicMock()
    fake_gemini._client.models.get.return_value = MagicMock()
    fake_groq = MagicMock()
    fake_groq._client.models.retrieve.side_effect = Exception("404 model_not_found")
    monkeypatch.setattr(gemini_client, "get_gemini_client", lambda: fake_gemini)
    monkeypatch.setattr(groq_client, "get_groq_client", lambda: fake_groq)

    resp = client.get("/health/models")

    assert resp.status_code == 200
    body = resp.json()
    assert body["gemini_flash"]["available"] is True
    assert body["groq_flash"]["available"] is False
    assert "model_not_found" in body["groq_flash"]["error"]
    # One provider's failure doesn't block reporting on the other.
    assert body["gemini_pro"]["available"] is True
