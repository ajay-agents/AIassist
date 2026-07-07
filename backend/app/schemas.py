from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# PLAN — Study Plan Generator
# ---------------------------------------------------------------------------


class SubjectInput(BaseModel):
    name: str
    topics_or_syllabus: str = Field(..., description="Topic list or raw syllabus text")
    priority: int = Field(3, ge=1, le=5)
    difficulty: int = Field(3, ge=1, le=5)


class StudyPlanRequest(BaseModel):
    subjects: list[SubjectInput]
    grade_level: str
    total_days: int = Field(..., gt=0)
    hours_per_day: float = Field(..., gt=0)


class LearningUnit(BaseModel):
    """One weighted unit of study, produced by Gemini — never invented by code."""

    subject: str
    topic: str
    effort: int = Field(..., ge=1, le=5)


class StudySession(BaseModel):
    subject: str
    topic: str
    kind: Literal["learn", "practice", "revise"]
    minutes: int


class DaySchedule(BaseModel):
    day: int
    sessions: list[StudySession]
    total_minutes: int


class StudyPlanResponse(BaseModel):
    days: list[DaySchedule]
    summary: str


# ---------------------------------------------------------------------------
# PYQ — PYQ Analysis
# ---------------------------------------------------------------------------


class PyqRequest(BaseModel):
    subject: str
    grade_level: str
    questions_text: str = Field(..., min_length=1)


class ClassifiedQuestion(BaseModel):
    """One question, classified by Gemini — code never guesses topic/type."""

    text: str
    topic: str
    question_type: str
    difficulty: str


class FrequencyEntry(BaseModel):
    label: str
    count: int
    percentage: float


class PyqResponse(BaseModel):
    topic_frequency: list[FrequencyEntry]
    type_frequency: list[FrequencyEntry]
    high_yield_topics: list[str]
    strategy_insight: str


# ---------------------------------------------------------------------------
# NOTES — Notes Summarizer
# ---------------------------------------------------------------------------


class NotesRequest(BaseModel):
    subject: str
    grade_level: str
    notes_text: str = Field(..., min_length=1)
    style: Literal["structured", "bullet", "exam-focused"] = "structured"


class NotesResponse(BaseModel):
    summary_markdown: str
    key_terms: list[str]
