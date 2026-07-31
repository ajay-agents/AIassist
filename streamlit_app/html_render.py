"""Renders backend JSON responses into polished, standalone HTML reports —
runs entirely in the Streamlit process (no backend contract change). Plain
Python string templating from *structured* data only; the LLM never
produces markup directly, so there's nothing here for a prompt-injected
response to hijack beyond the text it's allowed to contribute — and even
that text is escaped (or, for notes' markdown, sanitized via bleach) before
it's ever concatenated into a template.
"""

import html as _html
import re

import bleach
import markdown as _markdown

# bleach.clean(strip=True) drops disallowed tags but keeps their inner text
# by default (e.g. <script>alert(1)</script> becomes the harmless-but-ugly
# visible text "alert(1)"). Not a security issue — it's inert text, never
# executed — but for a "professional" report we don't want it visible at
# all, so drop these blocks (tag *and* content) before conversion.
_STRIP_BLOCK_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)

_BASE_CSS = """
<style>
  :root {
    --bg: #ffffff; --fg: #1a1a1a; --muted: #6b7280; --border: #e5e7eb;
    --accent: #2563eb; --accent-bg: #eff6ff; --card-bg: #f9fafb;
    --learn: #2563eb; --practice: #d97706; --revise: #059669;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115; --fg: #e5e7eb; --muted: #9ca3af; --border: #2a2e37;
      --accent: #60a5fa; --accent-bg: #16202e; --card-bg: #171a21;
      --learn: #60a5fa; --practice: #fbbf24; --revise: #34d399;
    }
  }
  * { box-sizing: border-box; }
  body {
    background: var(--bg); color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0; padding: 24px; line-height: 1.55; max-width: 900px;
  }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 22px 0 10px; }
  .subtitle { color: var(--muted); margin: 0 0 20px; font-size: 0.9rem; }
  .card {
    background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 18px; margin-bottom: 10px;
  }
  .callout {
    background: var(--accent-bg); border-left: 3px solid var(--accent); border-radius: 6px;
    padding: 12px 16px; margin: 12px 0; font-size: 0.92rem;
  }
  details.card > summary { cursor: pointer; font-weight: 600; list-style: none; }
  details.card > summary::-webkit-details-marker { display: none; }
  details.card > summary::before { content: "▸ "; color: var(--muted); }
  details.card[open] > summary::before { content: "▾ "; }
  .badge {
    display: inline-block; font-size: 0.72rem; font-weight: 600; padding: 1px 8px;
    border-radius: 999px; color: #fff; margin-right: 6px; text-transform: uppercase;
  }
  .badge.learn { background: var(--learn); }
  .badge.practice { background: var(--practice); }
  .badge.revise { background: var(--revise); }
  .chip {
    display: inline-block; background: var(--accent-bg); color: var(--accent);
    border-radius: 999px; padding: 3px 12px; margin: 0 6px 6px 0; font-size: 0.85rem;
  }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
  .bar-label { width: 140px; flex-shrink: 0; font-size: 0.88rem; }
  .bar-track { flex: 1; background: var(--border); border-radius: 999px; height: 10px; overflow: hidden; }
  .bar-fill { background: var(--accent); height: 100%; border-radius: 999px; }
  .bar-value { width: 90px; flex-shrink: 0; text-align: right; font-size: 0.82rem; color: var(--muted); }
  .day-usage { font-size: 0.8rem; color: var(--muted); margin-left: 8px; font-weight: normal; }
  .prose h2 { border-bottom: 1px solid var(--border); padding-bottom: 4px; }
  .prose ul, .prose ol { padding-left: 22px; }
  .prose code { background: var(--card-bg); padding: 1px 5px; border-radius: 4px; font-size: 0.85em; }
  .prose pre code { display: block; padding: 10px; overflow-x: auto; }
</style>
"""


def _esc(value) -> str:
    return _html.escape(str(value))


def _page(title: str, subtitle: str, body: str) -> str:
    return (
        f"<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>{_esc(title)}</title>{_BASE_CSS}</head><body>"
        f"<h1>{_esc(title)}</h1><p class='subtitle'>{_esc(subtitle)}</p>{body}</body></html>"
    )


# ---------------------------------------------------------------------------
# Study Plan Generator
# ---------------------------------------------------------------------------

_KIND_LABEL = {"learn": "Learn", "practice": "Practice", "revise": "Revise"}


def render_study_plan_html(result: dict, grade_level: str, hours_per_day: float) -> str:
    budget_minutes = max(hours_per_day * 60, 1)
    days_html = []
    for day in result["days"]:
        pct = min(day["total_minutes"] / budget_minutes * 100, 100)
        rows = "".join(
            f"<tr><td><span class='badge {s['kind']}'>{_esc(_KIND_LABEL.get(s['kind'], s['kind']))}</span></td>"
            f"<td>{_esc(s['subject'])}</td><td>{_esc(s['topic'])}</td><td>{_esc(s['minutes'])} min</td></tr>"
            for s in day["sessions"]
        )
        table = (
            f"<table><thead><tr><th></th><th>Subject</th><th>Topic</th><th>Time</th></tr></thead>"
            f"<tbody>{rows}</tbody></table>"
            if day["sessions"]
            else "<p style='color:var(--muted)'>No sessions scheduled.</p>"
        )
        days_html.append(
            f"<details class='card' {'open' if day['day'] == 1 else ''}>"
            f"<summary>Day {day['day']}"
            f"<span class='day-usage'>{day['total_minutes']} / {int(budget_minutes)} min ({pct:.0f}%)</span>"
            f"</summary>{table}</details>"
        )

    body = (
        f"<div class='callout'>{_esc(result['summary'])}</div>"
        f"<h2>Day-by-day roadmap</h2>{''.join(days_html)}"
    )
    return _page(
        "Study Plan Roadmap", f"{_esc(grade_level)} · {len(result['days'])} days · {hours_per_day}h/day", body
    )


# ---------------------------------------------------------------------------
# PYQ Analysis
# ---------------------------------------------------------------------------


def _frequency_bars(entries: list[dict]) -> str:
    if not entries:
        return "<p style='color:var(--muted)'>No data.</p>"
    return "".join(
        f"<div class='bar-row' title='{_esc(e['count'])} question(s)'>"
        f"<div class='bar-label'>{_esc(e['label'])}</div>"
        f"<div class='bar-track'><div class='bar-fill' style='width:{e['percentage']:.0f}%'></div></div>"
        f"<div class='bar-value'>{e['percentage']:.0f}% ({_esc(e['count'])})</div></div>"
        for e in entries
    )


def render_pyq_html(result: dict, subject: str, grade_level: str) -> str:
    chips = "".join(f"<span class='chip'>{_esc(t)}</span>" for t in result["high_yield_topics"]) or (
        "<span style='color:var(--muted)'>none identified</span>"
    )
    insight = (
        f"<div class='callout'>{_esc(result['strategy_insight'])}</div>" if result.get("strategy_insight") else ""
    )
    body = (
        f"<h2>High-yield topics</h2><div>{chips}</div>"
        f"{insight}"
        f"<h2>Topic frequency</h2>{_frequency_bars(result['topic_frequency'])}"
        f"<h2>Question-type frequency</h2>{_frequency_bars(result['type_frequency'])}"
    )
    return _page("PYQ Analysis", f"{_esc(subject)} · {_esc(grade_level)}", body)


# ---------------------------------------------------------------------------
# Notes Summarizer
# ---------------------------------------------------------------------------

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


def render_notes_html(result: dict, subject: str, grade_level: str, style: str) -> str:
    summary_html = _safe_markdown_to_html(result["summary_markdown"])
    # key_terms is a flat list of strings (the model phrases term+definition
    # together however it likes) — render each as its own glossary card
    # rather than guessing at a term/definition split that may not hold.
    terms_html = "".join(f"<li class='card'>{_esc(term)}</li>" for term in result["key_terms"])
    body = (
        f"<div class='card prose'>{summary_html}</div>"
        f"<h2>Key terms</h2><ul style='list-style:none;padding:0'>{terms_html}</ul>"
    )
    return _page("Notes Summary", f"{_esc(subject)} · {_esc(grade_level)} · {_esc(style)} style", body)
