"""Manual test console for the Study Desk backend — NOT the production
frontend (that's the existing React app per the FRD). This just gives
testers a quick way to hit the three Phase 1 endpoints and eyeball results.
"""

import os

import pandas as pd
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

    st.markdown("**Subjects** — add or edit rows below")
    default_subjects = pd.DataFrame(
        [
            {
                "name": "Physics",
                "topics_or_syllabus": "Kinematics, Thermodynamics, Optics",
                "priority": 3,
                "difficulty": 3,
            },
            {
                "name": "Chemistry",
                "topics_or_syllabus": "Bonding, Equilibrium",
                "priority": 4,
                "difficulty": 4,
            },
        ]
    )
    subjects_df = st.data_editor(
        default_subjects,
        num_rows="dynamic",
        use_container_width=True,
        key="subjects_editor",
        column_config={
            "priority": st.column_config.NumberColumn(min_value=1, max_value=5),
            "difficulty": st.column_config.NumberColumn(min_value=1, max_value=5),
        },
    )

    if st.button("Generate plan", type="primary", key="plan_submit"):
        subjects = [row for row in subjects_df.to_dict("records") if row.get("name")]
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
                            st.dataframe(pd.DataFrame(day["sessions"]), use_container_width=True)
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

                st.markdown("**High-yield topics:** " + ", ".join(result["high_yield_topics"]) or "none")
                if result.get("strategy_insight"):
                    st.info(result["strategy_insight"])

                col_a, col_b = st.columns(2)
                with col_a:
                    st.markdown("**Topic frequency**")
                    topic_df = pd.DataFrame(result["topic_frequency"])
                    if not topic_df.empty:
                        st.dataframe(topic_df, use_container_width=True)
                        st.bar_chart(topic_df.set_index("label")["percentage"])
                with col_b:
                    st.markdown("**Question-type frequency**")
                    type_df = pd.DataFrame(result["type_frequency"])
                    if not type_df.empty:
                        st.dataframe(type_df, use_container_width=True)
                        st.bar_chart(type_df.set_index("label")["percentage"])

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
