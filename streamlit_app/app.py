"""Manual test console for the Study Desk backend — NOT the production
frontend (that's the existing React app per the FRD). This just gives
testers a quick way to hit the three Phase 1 endpoints and eyeball results.

Deliberately avoids every Streamlit widget that touches pandas/pyarrow
(st.dataframe, st.data_editor, st.table, st.bar_chart, ...) — those lazily
import pyarrow's native lib, which some locked-down Windows machines block
via Application Control policy. Tables are rendered as plain markdown and
subject rows are managed by hand in session_state instead.
"""

import os

import requests
import streamlit as st

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


def post_json(path: str, payload: dict) -> dict | None:
    url = f"{st.session_state.backend_url}{path}"
    try:
        resp = requests.post(url, json=payload, timeout=120)
    except requests.RequestException as exc:
        st.error(f"Request to {url} failed: {exc}")
        return None
    if resp.status_code >= 400:
        st.error(f"{resp.status_code} from {path}: {resp.text}")
        return None
    return resp.json()


def markdown_table(rows: list[dict]) -> str:
    if not rows:
        return "_none_"
    headers = list(rows[0].keys())
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for row in rows:
        lines.append("| " + " | ".join(str(row.get(h, "")) for h in headers) + " |")
    return "\n".join(lines)


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
                result = post_json("/generate-study-plan", payload)
            if result:
                st.success("Plan generated")
                st.markdown(f"**Summary:** {result['summary']}")
                for day in result["days"]:
                    with st.expander(f"Day {day['day']} — {day['total_minutes']} min"):
                        if day["sessions"]:
                            st.markdown(markdown_table(day["sessions"]))
                        else:
                            st.caption("No sessions scheduled.")

# ---------------------------------------------------------------------------
# PYQ Analysis
# ---------------------------------------------------------------------------
with tab_pyq:
    st.subheader("PYQ Analysis")

    col1, col2 = st.columns(2)
    pyq_subject = col1.text_input("Subject", value="Physics", key="pyq_subject")
    pyq_grade = col2.text_input("Grade level", value="Grade 10", key="pyq_grade")
    questions_text = st.text_area(
        "Pasted previous-year questions (any format)", height=220, key="pyq_text"
    )

    if st.button("Analyze", type="primary", key="pyq_submit"):
        if not questions_text.strip():
            st.warning("Paste at least one question first.")
        else:
            payload = {
                "subject": pyq_subject,
                "grade_level": pyq_grade,
                "questions_text": questions_text,
            }
            with st.spinner("Calling /analyze-pyqs..."):
                result = post_json("/analyze-pyqs", payload)
            if result:
                st.success("Analysis complete")

                st.markdown("**High-yield topics:** " + (", ".join(result["high_yield_topics"]) or "none"))
                if result.get("strategy_insight"):
                    st.info(result["strategy_insight"])

                col_a, col_b = st.columns(2)
                with col_a:
                    st.markdown("**Topic frequency**")
                    for entry in result["topic_frequency"]:
                        st.progress(entry["percentage"] / 100, text=f"{entry['label']} — {entry['percentage']:.0f}% ({entry['count']})")
                with col_b:
                    st.markdown("**Question-type frequency**")
                    for entry in result["type_frequency"]:
                        st.progress(entry["percentage"] / 100, text=f"{entry['label']} — {entry['percentage']:.0f}% ({entry['count']})")

# ---------------------------------------------------------------------------
# Notes Summarizer
# ---------------------------------------------------------------------------
with tab_notes:
    st.subheader("Notes Summarizer")

    col1, col2, col3 = st.columns(3)
    notes_subject = col1.text_input("Subject", value="Biology", key="notes_subject")
    notes_grade = col2.text_input("Grade level", value="Grade 10", key="notes_grade")
    style = col3.selectbox("Style", ["structured", "bullet", "exam-focused"], key="notes_style")
    notes_text = st.text_area("Pasted notes", height=260, key="notes_text")

    if st.button("Summarize", type="primary", key="notes_submit"):
        if not notes_text.strip():
            st.warning("Paste some notes first.")
        else:
            payload = {
                "subject": notes_subject,
                "grade_level": notes_grade,
                "notes_text": notes_text,
                "style": style,
            }
            with st.spinner("Calling /summarize-notes..."):
                result = post_json("/summarize-notes", payload)
            if result:
                st.success("Summary ready")
                st.markdown(result["summary_markdown"])
                st.markdown("**Key terms**")
                for term in result["key_terms"]:
                    st.markdown(f"- {term}")
