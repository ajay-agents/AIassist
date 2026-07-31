// Mirrors backend/app/schemas.py. Keep these in sync by hand — the FRD
// requires the JSON contract to stay stable, so changes here should be rare
// and deliberate, not incidental to a UI change.

export interface SubjectInput {
  name: string;
  topics_or_syllabus: string;
  priority: number;
  difficulty: number;
}

export interface StudyPlanRequest {
  subjects: SubjectInput[];
  grade_level: string;
  total_days: number;
  hours_per_day: number;
}

export type SessionKind = "learn" | "practice" | "revise";

export interface StudySession {
  subject: string;
  topic: string;
  kind: SessionKind;
  minutes: number;
}

export interface DaySchedule {
  day: number;
  sessions: StudySession[];
  total_minutes: number;
}

export interface StudyPlanResponse {
  days: DaySchedule[];
  summary: string;
}

export interface PyqRequest {
  subject: string;
  grade_level: string;
  questions_text: string;
}

export interface FrequencyEntry {
  label: string;
  count: number;
  percentage: number;
}

export interface PyqResponse {
  topic_frequency: FrequencyEntry[];
  type_frequency: FrequencyEntry[];
  high_yield_topics: string[];
  strategy_insight: string;
}

export type NotesStyle = "structured" | "bullet" | "exam-focused";

export interface NotesRequest {
  subject: string;
  grade_level: string;
  notes_text: string;
  style: NotesStyle;
}

export interface NotesResponse {
  summary_markdown: string;
  key_terms: string[];
}

// Which provider/model actually answered — read from X-LLM-* response
// headers, never part of the JSON body (so the contract above stays fixed).
export interface LlmMeta {
  provider: string;
  model: string;
  tier: string;
  insightProvider?: string;
  elapsedMs: number;
}

export interface ApiResult<T> {
  data: T;
  llm: LlmMeta | null;
}
