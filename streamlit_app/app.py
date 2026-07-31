"""Manual test console for the Study Desk backend — NOT the production
frontend (that's the existing React app per the FRD). This just gives
testers a quick way to hit the three Phase 1 endpoints, optionally via a
PDF upload instead of pasting text, and see the result as a polished,
downloadable HTML report.

PDF extraction (pdf_utils.py) and HTML rendering (html_render.py) both run
entirely in this Streamlit process — the backend's JSON contract is
untouched, which matters since the FRD flags the eventual React frontend's
contract as something to keep stable.

Deliberately avoids every Streamlit widget that touches pandas/pyarrow
(st.dataframe, st.data_editor, st.table, st.bar_chart, ...) — those lazily
import pyarrow's native lib, which some locked-down Windows machines block
via Application Control policy. The subjects list is managed by hand in
session_state, and results render as standalone HTML (via
st.components.v1.html), which has no dataframe/arrow involvement at all.
"""

import os

import requests
import streamlit as st
import streamlit.components.v1 as components

from html_render import render_notes_html, render_pyq_html, render_study_plan_html
from pdf_utils import PdfExtractionError, extract_pdf_text

DEFAULT_BACKEND_URL = os.getenv("STUDY_DESK_API_URL", "http://localhost:8000")

st.set_page_config(page_title="Study Desk — Test Console", page_icon="📚", layout="wide")

if "backend_url" not in st.session_state:
    st.session_state.backend_url = DEFAULT_BACKEND_URL

with st.sidebar:
    st.header("Backend")
    st.session_state.backend_url = st.text_input(
        "API base URL", value=st.session_state.backend_url
    ).rstrip("/")
    if st.button("Check health"):
        try:
            resp = requests.get(f"{st.session_state.backend_url}/health", timeout=5)
            resp.raise_for_status()
            st.success(f"OK — {resp.json()}")
        except Exception as exc:  # noqa: BLE001 — surfaced directly to the tester
            st.error(f"Unreachable: {exc}")
    st.caption(
        "This console is a manual test harness only. It is not the "
        "production frontend and stores no state beyond this session."
    )

st.title("📚 Study Desk — Test Console")
st.caption("Study Plan Generator · PYQ Analysis · Notes Summarizer")


def post_json(path: str, payload: dict) -> requests.Response | None:
    """Returns the raw response (not just the JSON body) so callers can also
    read the X-LLM-* provenance headers and timing for display."""
    url = f"{st.session_state.backend_url}{path}"
    try:
        resp = requests.post(url, json=payload, timeout=120)
    except requests.RequestException as exc:
        st.error(f"Request to {url} failed: {exc}")
        return None
    if resp.status_code >= 400:
        st.error(f"{resp.status_code} from {path}: {resp.text}")
        return None
    return resp


def render_llm_meta(resp: requests.Response) -> None:
    """Shows which provider/model actually answered and how long it took —
    lets testers confirm the Gemini→Groq fallback and the flash/pro tier
    switch are firing as expected, without changing the JSON contract."""
    provider = resp.headers.get("X-LLM-Provider")
    if not provider:
        return
    model = resp.headers.get("X-LLM-Model", "?")
    tier = resp.headers.get("X-LLM-Tier", "?")
    parts = [f"provider: **{provider}**", f"model: `{model}`", f"tier: {tier}"]
    insight_provider = resp.headers.get("X-LLM-Insight-Provider")
    if insight_provider:
        parts.append(f"insight provider: **{insight_provider}**")
    parts.append(f"{resp.elapsed.total_seconds():.1f}s")
    st.caption(" · ".join(parts))


def render_html_report(html: str, *, download_name: str, height: int = 650) -> None:
    """Displays the rendered HTML inline and offers it as a standalone file
    testers can save or send along."""
    components.html(html, height=height, scrolling=True)
    st.download_button("⬇️ Download as HTML", data=html, file_name=download_name, mime="text/html")


def merge_extracted_text(existing: str, extracted: str) -> str:
    """Pure merge logic, factored out so it's unit-testable without needing
    to simulate a file upload through Streamlit's test harness (st.file_uploader
    has no AppTest simulation support as of this Streamlit version)."""
    return f"{existing}\n\n{extracted}" if existing.strip() else extracted


def pdf_uploader_appends_to(state_key: str, uploader_key: str, label: str) -> None:
    """Renders a PDF uploader; on a NEW file, extracts its text and appends
    it into st.session_state[state_key]. Must be called BEFORE the widget
    that owns state_key is instantiated, so the update takes effect this run.
    Guards against re-appending the same file on every unrelated rerun."""
    uploaded = st.file_uploader(label, type=["pdf"], key=uploader_key)
    if uploaded is None:
        return
    signature = (uploaded.name, uploaded.size)
    sig_state_key = f"{uploader_key}_signature"
    if st.session_state.get(sig_state_key) == signature:
        return
    st.session_state[sig_state_key] = signature
    try:
        extracted = extract_pdf_text(uploaded)
    except PdfExtractionError as exc:
        st.error(str(exc))
        return
    st.session_state[state_key] = merge_extracted_text(st.session_state.get(state_key, ""), extracted)
    st.caption(f"Extracted {len(extracted)} characters from '{uploaded.name}' and added below.")


tab_plan, tab_pyq, tab_notes = st.tabs(["Study Plan", "PYQ Analysis", "Notes Summarizer"])

# ---------------------------------------------------------------------------
# Study Plan Generator
# ---------------------------------------------------------------------------
with tab_plan:
    st.subheader("Study Plan Generator")

    col1, col2, col3 = st.columns(3)
    grade_level = col1.text_input("Grade level", value="Grade 10", key="plan_grade")
    total_days = col2.number_input("Total days", min_value=1, value=7, step=1, key="plan_days")
    hours_per_day = col3.number_input(
        "Hours per day", min_value=0.5, value=3.0, step=0.5, key="plan_hours"
    )

    if "subjects" not in st.session_state:
        st.session_state.subjects = [
            {"name": "Physics", "topics_or_syllabus": "Kinematics, Thermodynamics, Optics", "priority": 3, "difficulty": 3},
            {"name": "Chemistry", "topics_or_syllabus": "Bonding, Equilibrium", "priority": 4, "difficulty": 4},
        ]

    uploaded_syllabus = st.file_uploader(
        "Or upload a syllabus PDF to add as a new subject (optional)", type=["pdf"], key="plan_pdf"
    )
    if uploaded_syllabus is not None:
        signature = (uploaded_syllabus.name, uploaded_syllabus.size)
        if st.session_state.get("plan_pdf_signature") != signature:
            st.session_state["plan_pdf_signature"] = signature
            try:
                extracted = extract_pdf_text(uploaded_syllabus)
            except PdfExtractionError as exc:
                st.error(str(exc))
            else:
                st.session_state.subjects.append(
                    {"name": uploaded_syllabus.name.rsplit(".", 1)[0], "topics_or_syllabus": extracted, "priority": 3, "difficulty": 3}
                )
                st.caption(f"Extracted {len(extracted)} characters — added as a new subject below.")
                st.rerun()

    st.markdown("**Subjects**")
    for i, subject in enumerate(st.session_state.subjects):
        row1, row2, row3, row4, row5 = st.columns([3, 5, 2, 2, 1])
        subject["name"] = row1.text_input("Name", value=subject["name"], key=f"subj_name_{i}")
        subject["topics_or_syllabus"] = row2.text_input(
            "Topics / syllabus", value=subject["topics_or_syllabus"], key=f"subj_topics_{i}"
        )
        subject["priority"] = row3.number_input(
            "Priority", min_value=1, max_value=5, value=subject["priority"], key=f"subj_priority_{i}"
        )
        subject["difficulty"] = row4.number_input(
            "Difficulty", min_value=1, max_value=5, value=subject["difficulty"], key=f"subj_difficulty_{i}"
        )
        if row5.button("✕", key=f"subj_remove_{i}"):
            st.session_state.subjects.pop(i)
            st.rerun()

    if st.button("Add subject"):
        st.session_state.subjects.append(
            {"name": "", "topics_or_syllabus": "", "priority": 3, "difficulty": 3}
        )
        st.rerun()

    if st.button("Generate plan", type="primary", key="plan_submit"):
        subjects = [s for s in st.session_state.subjects if s["name"].strip()]
        if not subjects:
            st.warning("Add at least one subject first.")
        else:
            payload = {
                "subjects": subjects,
                "grade_level": grade_level,
                "total_days": int(total_days),
                "hours_per_day": float(hours_per_day),
            }
            with st.spinner("Calling /generate-study-plan..."):
                resp = post_json("/generate-study-plan", payload)
            if resp:
                result = resp.json()
                st.success("Plan generated")
                render_llm_meta(resp)
                html = render_study_plan_html(result, grade_level=grade_level, hours_per_day=float(hours_per_day))
                render_html_report(html, download_name="study_plan.html")

# ---------------------------------------------------------------------------
# PYQ Analysis
# ---------------------------------------------------------------------------
with tab_pyq:
    st.subheader("PYQ Analysis")

    col1, col2 = st.columns(2)
    pyq_subject = col1.text_input("Subject", value="Physics", key="pyq_subject")
    pyq_grade = col2.text_input("Grade level", value="Grade 10", key="pyq_grade")
    pdf_uploader_appends_to("pyq_text", "pyq_pdf", "Or upload a PDF of past questions (optional)")
    questions_text = st.text_area(
        "Pasted previous-year questions (any format)", height=220, key="pyq_text"
    )

    if st.button("Analyze", type="primary", key="pyq_submit"):
        if not questions_text.strip():
            st.warning("Paste at least one question first, or upload a PDF above.")
        else:
            payload = {
                "subject": pyq_subject,
                "grade_level": pyq_grade,
                "questions_text": questions_text,
            }
            with st.spinner("Calling /analyze-pyqs..."):
                resp = post_json("/analyze-pyqs", payload)
            if resp:
                result = resp.json()
                st.success("Analysis complete")
                render_llm_meta(resp)
                html = render_pyq_html(result, subject=pyq_subject, grade_level=pyq_grade)
                render_html_report(html, download_name="pyq_analysis.html")

# ---------------------------------------------------------------------------
# Notes Summarizer
# ---------------------------------------------------------------------------
with tab_notes:
    st.subheader("Notes Summarizer")

    col1, col2, col3 = st.columns(3)
    notes_subject = col1.text_input("Subject", value="Biology", key="notes_subject")
    notes_grade = col2.text_input("Grade level", value="Grade 10", key="notes_grade")
    style = col3.selectbox("Style", ["structured", "bullet", "exam-focused"], key="notes_style")
    pdf_uploader_appends_to("notes_text", "notes_pdf", "Or upload a PDF of notes (optional)")
    notes_text = st.text_area("Pasted notes", height=260, key="notes_text")
    st.caption(
        f"{len(notes_text)} characters — the backend automatically switches to the "
        "pro-tier model for longer pastes (see provider/tier shown after summarizing)."
    )

    if st.button("Summarize", type="primary", key="notes_submit"):
        if not notes_text.strip():
            st.warning("Paste some notes first, or upload a PDF above.")
        else:
            payload = {
                "subject": notes_subject,
                "grade_level": notes_grade,
                "notes_text": notes_text,
                "style": style,
            }
            with st.spinner("Calling /summarize-notes..."):
                resp = post_json("/summarize-notes", payload)
            if resp:
                result = resp.json()
                st.success("Summary ready")
                render_llm_meta(resp)
                html = render_notes_html(result, subject=notes_subject, grade_level=notes_grade, style=style)
                render_html_report(html, download_name="notes_summary.html")
