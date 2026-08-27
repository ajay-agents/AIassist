"""Renders backend JSON responses into polished, standalone HTML reports —
runs entirely in the Streamlit process (no backend contract change). Markup
lives in templates/ (Jinja2) so the look can be edited without touching this
file; the LLM never produces markup directly — Jinja2's autoescape handles
every plain-text value here, and the one deliberately-safe HTML block
(notes' sanitized markdown) is marked so explicitly via Markup().
"""

import re
from pathlib import Path

import bleach
import markdown as _markdown
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

_TEMPLATES_DIR = Path(__file__).parent / "templates"
_env = Environment(
    loader=FileSystemLoader(_TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

# bleach.clean(strip=True) drops disallowed tags but keeps their inner text
# by default (e.g. <script>alert(1)</script> becomes the harmless-but-ugly
# visible text "alert(1)"). Not a security issue — it's inert text, never
# executed — but for a "professional" report we don't want it visible at
# all, so drop these blocks (tag *and* content) before conversion.
_STRIP_BLOCK_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)

_ALLOWED_TAGS = [
    "p", "br", "strong", "em", "b", "i", "u", "code", "pre", "blockquote",
    "h1", "h2", "h3", "h4", "ul", "ol", "li", "a", "table", "thead", "tbody",
    "tr", "td", "th", "hr", "span",
]
_ALLOWED_ATTRS = {"a": ["href", "title"]}


def _safe_markdown_to_html(markdown_text: str) -> str:
    cleaned_source = _STRIP_BLOCK_RE.sub("", markdown_text)
    raw_html = _markdown.markdown(cleaned_source, extensions=["extra", "sane_lists"])
    return bleach.clean(raw_html, tags=_ALLOWED_TAGS, attributes=_ALLOWED_ATTRS, strip=True)


# ---------------------------------------------------------------------------
# Study Plan Generator
# ---------------------------------------------------------------------------

_KIND_LABEL = {"learn": "Learn", "practice": "Practice", "revise": "Revise"}


def render_study_plan_html(result: dict, grade_level: str, hours_per_day: float) -> str:
    budget_minutes = max(hours_per_day * 60, 1)
    days = []
    for day in result["days"]:
        pct = min(day["total_minutes"] / budget_minutes * 100, 100)
        sessions = [
            {
                "kind": s["kind"],
                "kind_label": _KIND_LABEL.get(s["kind"], s["kind"]),
                "subject": s["subject"],
                "topic": s["topic"],
                "minutes": s["minutes"],
            }
            for s in day["sessions"]
        ]
        days.append(
            {
                "day": day["day"],
                "total_minutes": day["total_minutes"],
                "budget_minutes": int(budget_minutes),
                "pct_display": f"{pct:.0f}",
                "is_open": day["day"] == 1,
                "sessions": sessions,
            }
        )

    template = _env.get_template("study_plan.html")
    return template.render(
        title="Study Plan Roadmap",
        subtitle=f"{grade_level} · {len(result['days'])} days · {hours_per_day}h/day",
        summary=result["summary"],
        days=days,
    )


# ---------------------------------------------------------------------------
# PYQ Analysis
# ---------------------------------------------------------------------------


def _with_percentage_display(entries: list[dict]) -> list[dict]:
    return [{**e, "percentage_display": f"{e['percentage']:.0f}"} for e in entries]


def render_pyq_html(result: dict, subject: str, grade_level: str) -> str:
    template = _env.get_template("pyq_analysis.html")
    return template.render(
        title="PYQ Analysis",
        subtitle=f"{subject} · {grade_level}",
        high_yield_topics=result["high_yield_topics"],
        strategy_insight=result.get("strategy_insight", ""),
        topic_frequency=_with_percentage_display(result["topic_frequency"]),
        type_frequency=_with_percentage_display(result["type_frequency"]),
    )


# ---------------------------------------------------------------------------
# Notes Summarizer
# ---------------------------------------------------------------------------


def render_notes_html(result: dict, subject: str, grade_level: str, style: str) -> str:
    # Markup() marks this pre-sanitized string safe so Jinja2 inserts it
    # verbatim instead of escaping it like every other (untrusted) value.
    summary_html = Markup(_safe_markdown_to_html(result["summary_markdown"]))
    template = _env.get_template("notes_summary.html")
    return template.render(
        title="Notes Summary",
        subtitle=f"{subject} · {grade_level} · {style} style",
        summary_html=summary_html,
        key_terms=result["key_terms"],
    )
