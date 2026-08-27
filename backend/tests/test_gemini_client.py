import json
from unittest.mock import MagicMock

import requests
from pydantic import BaseModel

from app.services.gemini_client import GeminiClient, _is_transient


class _Schema(BaseModel):
    value: str


def _fake_response(status_code: int, body: dict) -> requests.Response:
    resp = requests.Response()
    resp.status_code = status_code
    resp._content = json.dumps(body).encode()
    return resp


def _client_error(code: int) -> Exception:
    from google.genai import errors as genai_errors

    return genai_errors.ClientError(code, _fake_response(code, {"message": "error"}))


def _server_error(code: int = 500) -> Exception:
    from google.genai import errors as genai_errors

    return genai_errors.ServerError(code, _fake_response(code, {"message": "error"}))


def test_server_errors_are_transient():
    assert _is_transient(_server_error(500)) is True
    assert _is_transient(_server_error(503)) is True


def test_rate_limit_is_transient_despite_being_a_4xx():
    assert _is_transient(_client_error(429)) is True


def test_auth_and_bad_request_errors_are_not_transient():
    # These fail identically on every retry — retrying them just burns
    # ~7s of backoff before the Groq fallback ever gets a chance.
    assert _is_transient(_client_error(401)) is False
    assert _is_transient(_client_error(400)) is False
    assert _is_transient(_client_error(403)) is False
    assert _is_transient(_client_error(404)) is False


def test_network_errors_are_transient():
    assert _is_transient(requests.exceptions.ConnectionError()) is True
    assert _is_transient(requests.exceptions.Timeout()) is True


def test_unrelated_exceptions_are_not_transient():
    assert _is_transient(ValueError("something else entirely")) is False


def _client_with_fake_response(monkeypatch, response) -> GeminiClient:
    fake_genai_client = MagicMock()
    fake_genai_client.models.generate_content.return_value = response
    monkeypatch.setattr("app.services.gemini_client.genai.Client", lambda **kwargs: fake_genai_client)
    return GeminiClient()


def test_logs_token_usage_on_success(monkeypatch, caplog):
    # FRD Risks: "Track token usage per call from day one" — verify this
    # actually happens, not just that a comment says it should.
    fake_response = MagicMock(
        parsed=_Schema(value="ok"),
        usage_metadata=MagicMock(prompt_token_count=10, candidates_token_count=5, total_token_count=15),
    )
    client = _client_with_fake_response(monkeypatch, fake_response)

    with caplog.at_level("INFO"):
        client.generate_structured(model="gemini-3.6-flash", prompt="hi", response_schema=_Schema)

    assert "prompt_tokens=10" in caplog.text
    assert "output_tokens=5" in caplog.text
    assert "total_tokens=15" in caplog.text


def test_raises_instead_of_returning_none_when_nothing_parsed():
    # A schema-constrained call that somehow yields nothing parsable
    # shouldn't crash a router with an AttributeError on None downstream —
    # it should raise here, so the caller's existing fallback-to-Groq path
    # handles it like any other failure.
    import pytest

    from app.services.gemini_client import GeminiClient

    fake_genai_client = MagicMock()
    fake_genai_client.models.generate_content.return_value = MagicMock(parsed=None, usage_metadata=None)
    client = object.__new__(GeminiClient)
    client._client = fake_genai_client

    with pytest.raises(ValueError, match="no parsable structured output"):
        client.generate_structured(model="gemini-3.6-flash", prompt="hi", response_schema=_Schema)
