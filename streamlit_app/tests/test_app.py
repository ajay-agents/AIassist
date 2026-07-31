"""Headless UI tests for the test console, using Streamlit's AppTest to
actually execute app.py and drive it, with requests.post/get mocked so no
real backend or API keys are needed. Covers the happy-path rendering that
the earlier manual smoke tests (against a live backend with no LLM keys)
couldn't reach, since those only ever hit the error path.
"""

from datetime import timedelta
from unittest.mock import Mock, patch

from streamlit.testing.v1 import AppTest

from app import merge_extracted_text


def test_merge_extracted_text_appends_when_existing_has_content():
    assert merge_extracted_text("Existing notes.", "New PDF text.") == "Existing notes.\n\nNew PDF text."


def test_merge_extracted_text_replaces_when_existing_is_blank():
    assert merge_extracted_text("   ", "New PDF text.") == "New PDF text."
    assert merge_extracted_text("", "New PDF text.") == "New PDF text."


def _fake_response(json_body: dict, headers: dict | None = None) -> Mock:
    resp = Mock()
    resp.status_code = 200
    resp.json.return_value = json_body
    resp.headers = headers or {}
    resp.elapsed = timedelta(seconds=0.42)
    return resp


def _rendered_html(at: AppTest) -> str:
    """Results render via st.components.v1.html — AppTest exposes that as an
    UnknownElement of type 'iframe' whose proto.srcdoc holds the actual HTML.
    Returns the srcdoc of the last such element found (the most recent
    result rendered), searched across the whole app tree."""

    def walk(node):
        if getattr(node, "type", None) == "iframe":
            yield node.proto.srcdoc
        children = getattr(node, "children", None)
        if children:
            for child in children.values():
                yield from walk(child)

    matches = list(walk(at.main))
    assert matches, "expected at least one rendered HTML report"
    return matches[-1]


def test_health_check_success():
    at = AppTest.from_file("app.py")
    with patch("requests.get", return_value=_fake_response({"status": "ok"})):
        at.run(timeout=15)
        health_btn = [b for b in at.button if b.label == "Check health"][0]
        health_btn.click().run(timeout=15)
    assert at.exception == []
    assert any("OK" in s.value for s in at.success)


def test_study_plan_happy_path_renders_schedule():
    plan_response = _fake_response(
        {
            "summary": "Focus on mechanics this week.",
            "days": [
                {
                    "day": 1,
                    "total_minutes": 45,
                    "sessions": [{"subject": "Physics", "topic": "Kinematics", "kind": "learn", "minutes": 45}],
                }
            ],
        },
        headers={"X-LLM-Provider": "gemini", "X-LLM-Model": "gemini-3.6-flash", "X-LLM-Tier": "flash"},
    )
    at = AppTest.from_file("app.py")
    at.run(timeout=15)
    with patch("requests.post", return_value=plan_response):
        gen_btn = [b for b in at.button if b.label == "Generate plan"][0]
        gen_btn.click().run(timeout=15)

    assert at.exception == []
    assert any("Plan generated" in s.value for s in at.success)
    assert any("gemini" in c.value for c in at.caption)
    rendered = _rendered_html(at)
    assert "Kinematics" in rendered
    assert "Focus on mechanics this week." in rendered
    assert any(b.label == "⬇️ Download as HTML" for b in at.get("download_button"))


def test_pyq_happy_path_renders_frequencies():
    pyq_response = _fake_response(
        {
            "topic_frequency": [{"label": "Kinematics", "count": 2, "percentage": 100.0}],
            "type_frequency": [{"label": "MCQ", "count": 2, "percentage": 100.0}],
            "high_yield_topics": ["Kinematics"],
            "strategy_insight": "Focus on Kinematics.",
        },
        headers={"X-LLM-Provider": "groq", "X-LLM-Model": "llama-3.1-8b-instant", "X-LLM-Tier": "flash"},
    )
    at = AppTest.from_file("app.py")
    at.run(timeout=15)
    pyq_text = [t for t in at.text_area if t.key == "pyq_text"][0]
    pyq_text.set_value("What is velocity? What is inertia?").run(timeout=5)
    with patch("requests.post", return_value=pyq_response):
        analyze_btn = [b for b in at.button if b.label == "Analyze"][0]
        analyze_btn.click().run(timeout=15)

    assert at.exception == []
    assert any("Analysis complete" in s.value for s in at.success)
    assert any("groq" in c.value for c in at.caption)
    rendered = _rendered_html(at)
    assert "Kinematics" in rendered
    assert "Focus on Kinematics." in rendered


def test_notes_happy_path_renders_summary_and_terms():
    notes_response = _fake_response(
        {"summary_markdown": "## Cell Biology\nCells are the basic unit of life.", "key_terms": ["mitochondria"]},
        headers={"X-LLM-Provider": "gemini", "X-LLM-Model": "gemini-2.5-pro", "X-LLM-Tier": "pro"},
    )
    at = AppTest.from_file("app.py")
    at.run(timeout=15)
    notes_text = [t for t in at.text_area if t.key == "notes_text"][0]
    notes_text.set_value("Mitochondria is the powerhouse of the cell.").run(timeout=5)
    with patch("requests.post", return_value=notes_response):
        summarize_btn = [b for b in at.button if b.label == "Summarize"][0]
        summarize_btn.click().run(timeout=15)

    assert at.exception == []
    assert any("Summary ready" in s.value for s in at.success)
    assert any("pro" in c.value for c in at.caption)
    rendered = _rendered_html(at)
    assert "Cell Biology" in rendered
    assert "mitochondria" in rendered
