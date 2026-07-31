from html_render import render_notes_html, render_pyq_html, render_study_plan_html


def test_study_plan_renders_days_and_sessions():
    result = {
        "summary": "Focus on mechanics this week.",
        "days": [
            {
                "day": 1,
                "total_minutes": 45,
                "sessions": [{"subject": "Physics", "topic": "Kinematics", "kind": "learn", "minutes": 45}],
            },
            {"day": 2, "total_minutes": 0, "sessions": []},
        ],
    }
    out = render_study_plan_html(result, grade_level="Grade 10", hours_per_day=2)
    assert "Kinematics" in out
    assert "Physics" in out
    assert "Focus on mechanics this week." in out
    assert "No sessions scheduled." in out
    assert "38%" in out or "37%" in out or "38 %" in out  # 45/120 minutes ≈ 38%


def test_study_plan_escapes_malicious_topic_name():
    result = {
        "summary": "ok",
        "days": [
            {
                "day": 1,
                "total_minutes": 10,
                "sessions": [
                    {"subject": "<script>alert(1)</script>", "topic": "x", "kind": "learn", "minutes": 10}
                ],
            }
        ],
    }
    out = render_study_plan_html(result, grade_level="Grade 10", hours_per_day=1)
    assert "<script>alert(1)</script>" not in out
    assert "&lt;script&gt;" in out


def test_pyq_renders_frequencies_and_chips():
    result = {
        "topic_frequency": [{"label": "Kinematics", "count": 3, "percentage": 60.0}],
        "type_frequency": [{"label": "MCQ", "count": 5, "percentage": 100.0}],
        "high_yield_topics": ["Kinematics"],
        "strategy_insight": "Focus on Kinematics.",
    }
    out = render_pyq_html(result, subject="Physics", grade_level="Grade 10")
    assert "Kinematics" in out
    assert "60%" in out
    assert "Focus on Kinematics." in out


def test_pyq_handles_no_high_yield_topics():
    result = {
        "topic_frequency": [],
        "type_frequency": [],
        "high_yield_topics": [],
        "strategy_insight": "",
    }
    out = render_pyq_html(result, subject="Physics", grade_level="Grade 10")
    assert "none identified" in out


def test_pyq_escapes_malicious_label():
    result = {
        "topic_frequency": [{"label": "<img src=x onerror=alert(1)>", "count": 1, "percentage": 100.0}],
        "type_frequency": [],
        "high_yield_topics": [],
        "strategy_insight": "",
    }
    out = render_pyq_html(result, subject="Physics", grade_level="Grade 10")
    assert "<img src=x" not in out
    assert "&lt;img" in out


def test_notes_converts_markdown_to_html():
    result = {"summary_markdown": "## Cell Biology\n\nCells are the **basic** unit of life.", "key_terms": ["Mitochondria: the powerhouse of the cell."]}
    out = render_notes_html(result, subject="Biology", grade_level="Grade 10", style="structured")
    assert "<h2>Cell Biology</h2>" in out
    assert "<strong>basic</strong>" in out
    assert "Mitochondria: the powerhouse of the cell." in out


def test_notes_strips_script_tags_from_markdown():
    malicious = "## Heading\n\n<script>alert('xss')</script>\n\nSome text."
    result = {"summary_markdown": malicious, "key_terms": ["term"]}
    out = render_notes_html(result, subject="Biology", grade_level="Grade 10", style="structured")
    assert "<script>" not in out
    assert "alert(" not in out
    assert "Some text." in out


def test_notes_escapes_script_in_key_terms():
    result = {"summary_markdown": "Some notes.", "key_terms": ["<script>alert(1)</script>"]}
    out = render_notes_html(result, subject="Biology", grade_level="Grade 10", style="structured")
    assert "<script>alert(1)</script>" not in out
    assert "&lt;script&gt;" in out
