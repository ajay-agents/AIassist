import json
from unittest.mock import MagicMock

import groq
import httpx
from pydantic import BaseModel, ValidationError

from app.services.groq_client import GroqClient, _is_transient


class _Schema(BaseModel):
    value: str


def _fake_request() -> httpx.Request:
    return httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")


def _status_error(cls: type[groq.APIStatusError], code: int) -> Exception:
    response = httpx.Response(code, request=_fake_request())
    return cls(message="error", response=response, body=None)


def test_rate_limit_and_server_errors_are_transient():
    assert _is_transient(_status_error(groq.RateLimitError, 429)) is True
    assert _is_transient(_status_error(groq.InternalServerError, 500)) is True


def test_connection_and_timeout_errors_are_transient():
    assert _is_transient(groq.APIConnectionError(request=_fake_request())) is True
    assert _is_transient(groq.APITimeoutError(request=_fake_request())) is True


def test_auth_and_not_found_and_bad_request_errors_are_not_transient():
    # A bad key, a since-removed model (404 — this is exactly what happened
    # live when Groq's lineup changed), or a malformed request fail
    # identically every time. Retrying them is pure wasted latency.
    assert _is_transient(_status_error(groq.AuthenticationError, 401)) is False
    assert _is_transient(_status_error(groq.NotFoundError, 404)) is False
    assert _is_transient(_status_error(groq.BadRequestError, 400)) is False
    assert _is_transient(_status_error(groq.PermissionDeniedError, 403)) is False


def test_malformed_model_output_is_transient():
    # The model's own JSON was broken or didn't match the schema — a fresh
    # completion might do better, unlike a permanent config error.
    try:
        json.loads("not json")
    except json.JSONDecodeError as exc:
        assert _is_transient(exc) is True

    try:
        _Schema.model_validate({"wrong_field": 1})
    except ValidationError as exc:
        assert _is_transient(exc) is True


def test_unrelated_exceptions_are_not_transient():
    assert _is_transient(ValueError("something else entirely")) is False


def test_logs_token_usage_on_success(monkeypatch, caplog):
    # FRD Risks: "Track token usage per call from day one" — verify this
    # actually happens, not just that a comment says it should.
    fake_completion = MagicMock(
        usage=MagicMock(prompt_tokens=8, completion_tokens=4, total_tokens=12),
    )
    fake_completion.choices = [MagicMock(message=MagicMock(content=json.dumps({"value": "ok"})))]
    fake_groq_client = MagicMock()
    fake_groq_client.chat.completions.create.return_value = fake_completion
    monkeypatch.setattr("app.services.groq_client.groq.Groq", lambda **kwargs: fake_groq_client)

    client = GroqClient()
    with caplog.at_level("INFO"):
        result = client.generate_structured(model="openai/gpt-oss-20b", prompt="hi", response_schema=_Schema)

    assert result == _Schema(value="ok")
    assert "prompt_tokens=8" in caplog.text
    assert "completion_tokens=4" in caplog.text
    assert "total_tokens=12" in caplog.text
