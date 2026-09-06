import { useRef, useState } from "react";
import { Loader2, Plus, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui-kit/SelectField";
import { NumberInput } from "@/components/ui-kit/NumberInput";
import { PdfUpload } from "@/components/ui-kit/PdfUpload";
import { Banner } from "@/components/ui-kit/Banner";
import { LlmMetaPill } from "@/components/ui-kit/StatusBadges";
import { SubjectCard, SubjectEditor } from "./SubjectCard";
import { PlanResult } from "./PlanResult";
import { ApiError, GRADE_LEVELS, generateStudyPlan } from "@/lib/api";

const newSubject = (prefill) => ({
  id: Math.random().toString(36).slice(2),
  name: "",
  topics: "",
  priority: "Medium",
  difficulty: "Moderate",
  ...prefill,
});

function isAbortError(err) {
  return err instanceof DOMException && err.name === "AbortError";
}

function StudyPlanTab({ apiBaseUrl }) {
  const [gradeLevel, setGradeLevel] = useState(GRADE_LEVELS[6]);
  const [totalDays, setTotalDays] = useState(14);
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [subjects, setSubjects] = useState([
    { id: "seed-1", name: "Physics", topics: "Mechanics, thermodynamics, waves, optics", priority: "High", difficulty: "Difficult" },
    { id: "seed-2", name: "Mathematics", topics: "Algebra, calculus, coordinate geometry", priority: "Medium", difficulty: "Moderate" },
  ]);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState(null);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [llm, setLlm] = useState(null);
  const abortRef = useRef(null);

  const handleGenerate = async () => {
    setWarning(null);
    setError(null);
    if (!subjects.some((s) => s.name.trim())) {
      setWarning("Add at least one subject first.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const { data, llm } = await generateStudyPlan(apiBaseUrl, { gradeLevel, totalDays, hoursPerDay, subjects }, controller.signal);
      setPlan(data);
      setLlm(llm);
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => abortRef.current?.abort();

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Create Your Study Plan</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Turn your syllabus into a structured, realistic study roadmap.
        </p>
      </div>

      <section className="surface-panel p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <SelectField
            id="grade-level"
            label="Grade level"
            value={gradeLevel}
            onChange={setGradeLevel}
            options={GRADE_LEVELS}
            hint="Used to calibrate depth and pace."
          />
          <NumberInput
            id="total-days"
            label="Total days"
            value={totalDays}
            onChange={setTotalDays}
            min={1}
            max={90}
            suffix="days"
            hint="Time until your exam."
          />
          <NumberInput
            id="hours-per-day"
            label="Hours per day"
            value={hoursPerDay}
            onChange={setHoursPerDay}
            min={1}
            max={16}
            suffix="hrs"
            hint="Be realistic — consistency wins."
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Subjects &amp; Syllabus</h2>
            <p className="text-sm text-muted-foreground">Upload a syllabus PDF or add subjects manually.</p>
          </div>
          <span className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {subjects.length} added
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="surface-panel p-5">
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Option A — Upload syllabus</p>
            <PdfUpload
              title="Upload Syllabus PDF"
              description="Each PDF becomes a new subject — drop one or more here."
              onExtracted={(text, fileName) =>
                setSubjects((list) => [...list, newSubject({ name: fileName.replace(/\.pdf$/i, ""), topics: text })])
              }
            />
          </div>

          <div className="surface-panel flex flex-col justify-between gap-4 p-5">
            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Option B — Add manually</p>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-surface/60 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-card text-primary">
                  <BookOpen className="h-4 w-4" />
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Enter each subject with its topics, priority and difficulty so the planner can weight your schedule correctly.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setDraft(newSubject());
              }}
              className="w-full"
            >
              <Plus className="h-4 w-4" /> Add New Subject
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {subjects.map((subject) =>
            editingId === subject.id ? (
              <div key={subject.id} className="md:col-span-2">
                <SubjectEditor
                  value={subject}
                  saveLabel="Update subject"
                  onCancel={() => setEditingId(null)}
                  onSave={(updated) => {
                    setSubjects((list) => list.map((s) => (s.id === updated.id ? updated : s)));
                    setEditingId(null);
                  }}
                />
              </div>
            ) : (
              <SubjectCard
                key={subject.id}
                subject={subject}
                onEdit={() => {
                  setDraft(null);
                  setEditingId(subject.id);
                }}
                onRemove={() => setSubjects((list) => list.filter((s) => s.id !== subject.id))}
              />
            ),
          )}
        </div>

        {draft ? (
          <SubjectEditor
            value={draft}
            onCancel={() => setDraft(null)}
            onSave={(subject) => {
              setSubjects((list) => [...list, subject]);
              setDraft(null);
            }}
          />
        ) : (
          <Button
            variant="ghost"
            onClick={() => {
              setEditingId(null);
              setDraft(newSubject());
            }}
            className="w-full border border-dashed border-border py-6 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Add Subject
          </Button>
        )}
      </section>

      <section className="surface-panel grid grid-cols-1 items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-6">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">Ready to build your roadmap?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {subjects.length} subjects · {totalDays} days · {hoursPerDay}h per day = <span className="font-semibold text-foreground">{totalDays * hoursPerDay}h</span> of
            planned study.
          </p>
        </div>
        <div className="flex gap-2 sm:justify-self-end">
          {loading && (
            <Button variant="outline" size="lg" onClick={handleStop}>
              Stop
            </Button>
          )}
          <Button size="lg" onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Generating plan…" : "Generate Study Plan"}
          </Button>
        </div>
      </section>

      {warning && <Banner tone="warning">{warning}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {plan ? (
        <>
          {llm && (
            <div className="flex justify-end">
              <LlmMetaPill {...llm} />
            </div>
          )}
          <PlanResult plan={plan} gradeLevel={gradeLevel} hoursPerDay={hoursPerDay} />
        </>
      ) : null}
    </div>
  );
}

export { StudyPlanTab };
