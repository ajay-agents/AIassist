import { useRef, useState } from "react";
import { BarChart3, Layers, Lightbulb, Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui-kit/SelectField";
import { PdfUpload } from "@/components/ui-kit/PdfUpload";
import { ResultCard } from "@/components/ui-kit/ResultCard";
import { Banner } from "@/components/ui-kit/Banner";
import { LlmMetaPill, StatusPill } from "@/components/ui-kit/StatusBadges";
import { ApiError, GRADE_LEVELS, analyzePyqs } from "@/lib/api";

function isAbortError(err) {
  return err instanceof DOMException && err.name === "AbortError";
}

function PyqTab({ apiBaseUrl }) {
  const [subject, setSubject] = useState("Physics");
  const [gradeLevel, setGradeLevel] = useState(GRADE_LEVELS[6]);
  const [questionsText, setQuestionsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [llm, setLlm] = useState(null);
  const abortRef = useRef(null);

  const analyze = async () => {
    setWarning(null);
    setError(null);
    if (!questionsText.trim()) {
      setWarning("Paste at least one question first, or upload a PDF above.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const { data, llm } = await analyzePyqs(apiBaseUrl, { subject, gradeLevel, questionsText }, controller.signal);
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
  };

  const handleStop = () => abortRef.current?.abort();

  const totalQuestions = result ? result.type_frequency.reduce((sum, e) => sum + e.count, 0) : 0;

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Previous-Year Question Analysis</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Understand what appears most often in your previous-year questions.
        </p>
      </div>

      <section className="surface-panel p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pyq-subject" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Subject
            </Label>
            <Input id="pyq-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Physics" className="h-10 bg-card" />
          </div>
          <SelectField label="Grade level" value={gradeLevel} onChange={setGradeLevel} options={GRADE_LEVELS} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="surface-panel p-5">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Upload paper</p>
          <PdfUpload
            title="Upload Previous-Year Questions PDF"
            description="Upload your past papers or question bank."
            onExtracted={(text) => setQuestionsText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
          />
        </div>
        <div className="surface-panel flex flex-col p-5">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Or paste your questions</p>
          <Textarea
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            rows={8}
            placeholder={"1. Derive the expression for kinetic energy...\n2. A block of mass 2 kg slides..."}
            className="min-h-40 flex-1 resize-y bg-card text-sm leading-relaxed"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {questionsText.trim() ? questionsText.trim().split(/\n+/).length : 0} lines detected
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {loading && (
          <Button variant="outline" size="lg" onClick={handleStop}>
            Stop
          </Button>
        )}
        <Button size="lg" onClick={analyze} disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          {loading ? "Analyzing…" : "Analyze PYQs"}
        </Button>
      </div>

      {warning && <Banner tone="warning">{warning}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {result ? (
        <div className="space-y-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 className="min-w-0 truncate text-xl font-semibold text-foreground sm:text-2xl">Analysis Report</h2>
            <span className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {totalQuestions} questions · {result.subject ?? subject}
            </span>
          </div>

          {llm && (
            <div className="flex justify-end">
              <LlmMetaPill {...llm} />
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <ResultCard title="Topic Frequency" subtitle="Share of questions per topic" icon={<BarChart3 className="h-4 w-4" />}>
              {result.topic_frequency.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data.</p>
              ) : (
                <div className="space-y-4">
                  {result.topic_frequency.map((row) => (
                    <div key={row.label}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{Math.round(row.percentage)}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${row.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ResultCard>

            <ResultCard title="Question Type" subtitle="Format distribution" icon={<Layers className="h-4 w-4" />}>
              {result.type_frequency.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {result.type_frequency.map((q) => (
                    <span key={q.label} className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground">
                      {q.label}
                      <span className="text-xs tabular-nums text-muted-foreground">{q.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </ResultCard>
          </div>

          <ResultCard title="High-Yield Topics" subtitle="Prioritise these first" icon={<Target className="h-4 w-4" />}>
            {result.high_yield_topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">None identified.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {result.high_yield_topics.map((topic) => (
                  <StatusPill key={topic} className="border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                    {topic}
                  </StatusPill>
                ))}
              </div>
            )}
          </ResultCard>

          {result.strategy_insight && (
            <ResultCard
              tone="accent"
              title="Strategy Insight"
              subtitle="Generated recommendation"
              icon={<Lightbulb className="h-4 w-4" />}
              action={<StatusPill className="border-primary/30 bg-card text-primary">AI insight</StatusPill>}
            >
              <p className="max-w-3xl text-sm leading-7 text-foreground">{result.strategy_insight}</p>
            </ResultCard>
          )}
        </div>
      ) : null}
    </div>
  );
}

export { PyqTab };
