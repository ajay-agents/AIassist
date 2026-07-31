import { useState } from "react";
import { ApiError, generateStudyPlan } from "../../api/client";
import type { LlmMeta, SubjectInput, StudyPlanResponse } from "../../api/types";
import { PdfUpload } from "../../components/PdfUpload";
import {
  Card,
  Callout,
  ErrorBanner,
  KindBadge,
  LlmMetaLine,
  NumberField,
  PrimaryButton,
  TextField,
} from "../../components/ui/Primitives";

const DEFAULT_SUBJECTS: SubjectInput[] = [
  { name: "Physics", topics_or_syllabus: "Kinematics, Thermodynamics, Optics", priority: 3, difficulty: 3 },
  { name: "Chemistry", topics_or_syllabus: "Bonding, Equilibrium", priority: 4, difficulty: 4 },
];

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
  const [result, setResult] = useState<StudyPlanResponse | null>(null);
  const [llm, setLlm] = useState<LlmMeta | null>(null);

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
    if (validSubjects.length === 0) {
      setError("Add at least one subject first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, llm } = await generateStudyPlan(apiBaseUrl, {
        subjects: validSubjects,
        grade_level: gradeLevel,
        total_days: totalDays,
        hours_per_day: hoursPerDay,
      });
      setResult(data);
      setLlm(llm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const budgetMinutes = Math.max(hoursPerDay * 60, 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Grade level" value={gradeLevel} onChange={setGradeLevel} />
        <NumberField label="Total days" value={totalDays} onChange={setTotalDays} min={1} />
        <NumberField label="Hours per day" value={hoursPerDay} onChange={setHoursPerDay} min={0.5} step={0.5} />
      </div>

      <PdfUpload
        label="Or upload a syllabus PDF to add as a new subject"
        onExtracted={(text, fileName) =>
          addSubject({ name: fileName.replace(/\.pdf$/i, ""), topics_or_syllabus: text })
        }
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Subjects</h3>
        {subjects.map((subject, i) => (
          <Card key={i} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <TextField label="Name" value={subject.name} onChange={(v) => updateSubject(i, { name: v })} />
            </div>
            <div className="flex-[2]">
              <TextField
                label="Topics / syllabus"
                value={subject.topics_or_syllabus}
                onChange={(v) => updateSubject(i, { topics_or_syllabus: v })}
              />
            </div>
            <div className="w-24">
              <NumberField
                label="Priority"
                value={subject.priority}
                onChange={(v) => updateSubject(i, { priority: v })}
                min={1}
                max={5}
              />
            </div>
            <div className="w-24">
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
              className="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            >
              ✕
            </button>
          </Card>
        ))}
        <button
          onClick={() => addSubject()}
          className="w-fit rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400"
        >
          + Add subject
        </button>
      </div>

      <div>
        <PrimaryButton onClick={handleSubmit} disabled={loading}>
          {loading ? "Generating…" : "Generate plan"}
        </PrimaryButton>
      </div>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-col gap-3">
          {llm && <LlmMetaLine {...llm} />}
          <Callout>{result.summary}</Callout>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Day-by-day roadmap</h3>
          {result.days.map((day) => {
            const pct = Math.min((day.total_minutes / budgetMinutes) * 100, 100);
            return (
              <details key={day.day} className="group rounded-xl border border-slate-200 dark:border-slate-800" open={day.day === 1}>
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <span>
                    <span className="mr-2 inline-block text-slate-400 transition group-open:rotate-90">▸</span>
                    Day {day.day}
                  </span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    {day.total_minutes} / {Math.round(budgetMinutes)} min ({pct.toFixed(0)}%)
                  </span>
                </summary>
                <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                  {day.sessions.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No sessions scheduled.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {day.sessions.map((s, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                            <td className="py-1.5 pr-2">
                              <KindBadge kind={s.kind} />
                            </td>
                            <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-300">{s.subject}</td>
                            <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-300">{s.topic}</td>
                            <td className="py-1.5 text-right text-slate-500 dark:text-slate-400">{s.minutes} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
