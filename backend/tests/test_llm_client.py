from pydantic import BaseModel

from app.services import llm_client


class _Schema(BaseModel):
    value: str


class _StubClient:
    def __init__(self, *, fails: bool, result=None):
        self._fails = fails
        self._result = result
        self.calls = 0

    def generate_structured(self, *, model, prompt, response_schema):
        self.calls += 1
        if self._fails:
            raise RuntimeError("provider unavailable")
        return self._result


def test_uses_gemini_when_it_succeeds(monkeypatch):
    gemini = _StubClient(fails=False, result=_Schema(value="from-gemini"))
    groq = _StubClient(fails=False, result=_Schema(value="from-groq"))
    monkeypatch.setattr(llm_client, "get_gemini_client", lambda: gemini)
    monkeypatch.setattr(llm_client, "get_groq_client", lambda: groq)

    result = llm_client.generate_structured(model_tier="flash", prompt="p", response_schema=_Schema)

    assert result.value == "from-gemini"
    assert gemini.calls == 1
    assert groq.calls == 0


def test_falls_back_to_groq_when_gemini_fails(monkeypatch):
    gemini = _StubClient(fails=True)
    groq = _StubClient(fails=False, result=_Schema(value="from-groq"))
    monkeypatch.setattr(llm_client, "get_gemini_client", lambda: gemini)
    monkeypatch.setattr(llm_client, "get_groq_client", lambda: groq)

    result = llm_client.generate_structured(model_tier="flash", prompt="p", response_schema=_Schema)

    assert result.value == "from-groq"
    assert gemini.calls == 1
    assert groq.calls == 1


def test_raises_clear_error_when_both_providers_fail(monkeypatch):
    gemini = _StubClient(fails=True)
    groq = _StubClient(fails=True)
    monkeypatch.setattr(llm_client, "get_gemini_client", lambda: gemini)
    monkeypatch.setattr(llm_client, "get_groq_client", lambda: groq)

    try:
        llm_client.generate_structured(model_tier="flash", prompt="p", response_schema=_Schema)
        assert False, "expected RuntimeError"
    except RuntimeError as exc:
        assert "Gemini" in str(exc)
        assert "Groq" in str(exc)
