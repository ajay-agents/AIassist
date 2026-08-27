import { useRef, useState } from "react";
import { ApiError, generateStudyPlan } from "../../api/client";
import type { LlmMeta, SubjectInput, StudyPlanResponse } from "../../api/types";
import { PdfUpload } from "../../components/PdfUpload";
import { CloseIcon } from "../../components/ui/Icon";
import {
  Callout,
  Card,
  EmptyState,
  ErrorBanner,
  KindBadge,
  LlmMetaLine,
  NumberField,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  StatRow,
  StatTile,
  SubjectDot,
  TextField,
  WarningBanner,
} from "../../components/ui/Primitives";
import { subjectColor } from "../../lib/subjectColor";

const DEFAULT_SUBJECTS: SubjectInput[] = [
  { name: "Physics", topics_or_syllabus: "Kinematics, Thermodynamics, Optics", priority: 3, difficulty: 3 },
  { name: "Chemistry", topics_or_syllabus: "Bonding, Equilibrium", priority: 4, difficulty: 4 },
];

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

interface StudyPlanToolProps {
  apiBaseUrl: string;
}

export function StudyPlanTool({ apiBaseUrl }: StudyPlanToolProps) {
  const [gradeLevel, setGradeLevel] = useState("Grade 10");
  const [totalDays, setTotalDays] = useState(7);
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [subjects, setSubjects] = useState<SubjectInput[]>(DEFAULT_SUBJECTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<StudyPlanResponse | null>(null);
  const [llm, setLlm] = useState<LlmMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function updateSubject(index: number, patch: Partial<SubjectInput>) {
    setSubjects((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSubject(index: number) {
    setSubjects((prev) => prev.filter((_, i) => i !== index));
  }

  function addSubject(prefill?: Partial<SubjectInput>) {
    setSubjects((prev) => [
      ...prev,
      { name: "", topics_or_syllabus: "", priority: 3, difficulty: 3, ...prefill },
    ]);
  }

  async function handleSubmit() {
    const validSubjects = subjects.filter((s) => s.name.trim());
    setWarning(null);
    setError(null);
    if (validSubjects.length === 0) {
      setWarning("Add at least one subject first.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const { data, llm } = await generateStudyPlan(
        apiBaseUrl,
        { subjects: validSubjects, grade_level: gradeLevel, total_days: totalDays, hours_per_day: hoursPerDay },
        controller.signal,
      );
      setResult(data);
      setLlm(llm);
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  const budgetMinutes = Math.max(hoursPerDay * 60, 1);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      {/* Form column */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <SectionHeading>Plan settings</SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextField label="Grade level" value={gradeLevel} onChange={setGradeLevel} />
            <NumberField label="Total days" value={totalDays} onChange={setTotalDays} min={1} />
            <NumberField label="Hours per day" value={hoursPerDay} onChange={setHoursPerDay} min={0.5} step={0.5} />
          </div>

          <PdfUpload
            label="Upload syllabus PDFs — each one becomes a new subject"
            multiple
            onExtracted={(text, fileName) =>
              addSubject({ name: fileName.replace(/\.pdf$/i, ""), topics_or_syllabus: text })
            }
          />
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeading count={subjects.length}>Subjects</SectionHeading>
          {subjects.map((subject, i) => {
            const color = subjectColor(subject.name || `subject-${i}`);
            return (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 border border-rule p-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,4.5rem)_minmax(0,4.5rem)_auto] sm:items-end"
              >
                <div className="flex min-w-0 items-end gap-2">
                  <SubjectDot colorClass={color.dot} />
                  <div className="min-w-0 flex-1">
                    <TextField label="Name" value={subject.name} onChange={(v) => updateSubject(i, { name: v })} />
                  </div>
                </div>
                <div className="min-w-0">
                  <TextField
                    label="Topics / syllabus"
                    value={subject.topics_or_syllabus}
                    onChange={(v) => updateSubject(i, { topics_or_syllabus: v })}
                  />
                </div>
                <div className="min-w-0">
                  <NumberField
                    label="Priority"
                    value={subject.priority}
                    onChange={(v) => updateSubject(i, { priority: v })}
                    min={1}
                    max={5}
                  />
                </div>
                <div className="min-w-0">
                  <NumberField
                    label="Difficulty"
                    value={subject.difficulty}
                    onChange={(v) => updateSubject(i, { difficulty: v })}
                    min={1}
                    max={5}
                  />
                </div>
                <button
                  onClick={() => removeSubject(i)}
                  aria-label={`Remove subject ${subject.name || i + 1}`}
                  className="h-fit justify-self-start rounded-md px-2 py-2 text-muted transition hover:bg-danger/10 hover:text-danger sm:mb-0.5 sm:justify-self-auto"
                >
                  <CloseIcon />
                </button>
              </div>
            );
          })}
          <SecondaryButton onClick={() => addSubject()} className="w-fit">
            + Add subject
          </SecondaryButton>
        </Card>

        <div className="flex gap-2">
          <PrimaryButton onClick={handleSubmit} disabled={loading} loading={loading}>
            {loading ? "Generating…" : "Generate plan"}
          </PrimaryButton>
          {loading && <SecondaryButton onClick={handleStop}>Stop</SecondaryButton>}
        </div>

        {warning && <WarningBanner message={warning} />}
        {error && <ErrorBanner message={error} />}
      </div>

      {/* Results column */}
      <div className="flex flex-col gap-3">
        {!result && !loading && (
          <EmptyState
            title="Your roadmap will appear here"
            description="Fill in your subjects and hit Generate plan to get a day-by-day study schedule."
          />
        )}

        {result && (
          <>
            {llm && <LlmMetaLine {...llm} />}

            <StatRow>
              <StatTile label="Days" value={result.days.length} />
              <StatTile
                label="Total study time"
                value={formatMinutes(result.days.reduce((sum, d) => sum + d.total_minutes, 0))}
              />
              <StatTile
                label="Subjects"
                value={new Set(result.days.flatMap((d) => d.sessions.map((s) => s.subject))).size}
              />
              <StatTile
                label="Avg / day"
                value={formatMinutes(result.days.reduce((sum, d) => sum + d.total_minutes, 0) / result.days.length)}
              />
            </StatRow>

            <Callout>{result.summary}</Callout>
            <SectionHeading count={result.days.length}>Day-by-day roadmap</SectionHeading>
            <div className="flex flex-col divide-y divide-rule border border-rule">
              {result.days.map((day) => {
                const pct = Math.min((day.total_minutes / budgetMinutes) * 100, 100);
                return (
                  <details key={day.day} className="group bg-surface open:bg-paper" open={day.day === 1}>
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink marker:text-muted">
                      <span className="flex items-center gap-2.5">
                        <span className="font-data w-5 text-muted tabular-nums">{day.day}</span>
                        <span>Day {day.day}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs font-normal text-muted">
                        <span
                          className="h-1.5 w-16 overflow-hidden rounded-full bg-rule"
                          role="progressbar"
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Day ${day.day} time used: ${day.total_minutes} of ${Math.round(budgetMinutes)} minutes`}
                        >
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="font-data tabular-nums">
                          {day.total_minutes} / {Math.round(budgetMinutes)} min
                        </span>
                      </span>
                    </summary>
                    <div className="border-t border-rule px-4 py-3">
                      {day.sessions.length === 0 ? (
                        <p className="text-sm text-muted">No sessions scheduled.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {day.sessions.map((s, i) => {
                            const color = subjectColor(s.subject);
                            return (
                              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                                <KindBadge kind={s.kind} />
                                <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                                  <SubjectDot colorClass={color.dot} />
                                  {s.subject}
                                </span>
                                <span aria-hidden className="text-muted">
                                  —
                                </span>
                                <span className="text-muted">{s.topic}</span>
                                <span className="font-data ml-auto text-xs text-muted tabular-nums">
                                  {s.minutes} min
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
