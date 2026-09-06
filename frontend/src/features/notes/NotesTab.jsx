import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Loader2, Sparkles, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui-kit/SelectField";
import { PdfUpload } from "@/components/ui-kit/PdfUpload";
import { ResultCard } from "@/components/ui-kit/ResultCard";
import { Banner } from "@/components/ui-kit/Banner";
import { LlmMetaPill } from "@/components/ui-kit/StatusBadges";
import { ApiError, GRADE_LEVELS, summarizeNotes } from "@/lib/api";

const STYLES = ["Structured", "Bullet", "Exam-focused"];

function wordCount(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function isAbortError(err) {
  return err instanceof DOMException && err.name === "AbortError";
}

function NotesTab({ apiBaseUrl }) {
  const [subject, setSubject] = useState("Physics");
  const [gradeLevel, setGradeLevel] = useState(GRADE_LEVELS[6]);
  const [style, setStyle] = useState("Structured");
  const [notesText, setNotesText] = useState("");
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [llm, setLlm] = useState(null);
  const abortRef = useRef(null);

  const summarize = async () => {
    setWarning(null);
    setError(null);
    if (!notesText.trim()) {
      setWarning("Paste some notes first, or upload a PDF above.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const { data, llm } = await summarizeNotes(apiBaseUrl, { subject, gradeLevel, style, notesText }, controller.signal);
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

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Notes Summarizer</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Turn long notes into clear, structured revision material.
        </p>
      </div>

      <section className="surface-panel p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="notes-subject" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Subject
            </Label>
            <Input id="notes-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Physics" className="h-10 bg-card" />
          </div>
          <SelectField label="Grade level" value={gradeLevel} onChange={setGradeLevel} options={GRADE_LEVELS} />
          <SelectField label="Summary style" value={style} onChange={setStyle} options={STYLES} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="surface-panel p-5">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Upload notes</p>
          <PdfUpload
            title="Upload Notes PDF"
            description="Drop your notes here or browse from your device."
            onExtracted={(text) => setNotesText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
          />
        </div>
        <div className="surface-panel flex flex-col p-5">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Or paste your notes</p>
          <Textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            rows={8}
            placeholder="Paste lecture notes, textbook extracts or class transcripts…"
            className="min-h-40 flex-1 resize-y bg-card text-sm leading-relaxed"
          />
          <p className="mt-2 text-xs tabular-nums text-muted-foreground">
            {notesText.length.toLocaleString()} characters · {notesText.trim() ? wordCount(notesText).toLocaleString() : 0} words — longer
            pastes automatically use the stronger pro-tier model.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {loading && (
          <Button variant="outline" size="lg" onClick={handleStop}>
            Stop
          </Button>
        )}
        <Button size="lg" onClick={summarize} disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Summarizing…" : "Summarize Notes"}
        </Button>
      </div>

      {warning && <Banner tone="warning">{warning}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {result ? (
        <div className="space-y-5">
          {llm && (
            <div className="flex justify-end">
              <LlmMetaPill {...llm} />
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <ResultCard title="Summary" subtitle={`${subject} · ${style} · ${Math.max(1, Math.round(wordCount(result.summary_markdown) / 200))} min read`} icon={<FileText className="h-4 w-4" />}>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground prose-a:text-primary prose-code:text-foreground prose-h2:border-b prose-h2:border-border prose-h2:pb-1.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary_markdown}</ReactMarkdown>
              </div>
            </ResultCard>

            <ResultCard title="Key Terms" subtitle="Extracted vocabulary" icon={<Tags className="h-4 w-4" />}>
              {result.key_terms.length === 0 ? (
                <p className="text-sm text-muted-foreground">None extracted.</p>
              ) : (
                <div className="space-y-2">
                  {result.key_terms.map((term) => (
                    <div key={term} className="rounded-lg border border-border bg-surface/70 px-3.5 py-2.5 transition-colors hover:border-primary/40">
                      <p className="text-sm font-semibold text-foreground">{term}</p>
                    </div>
                  ))}
                </div>
              )}
            </ResultCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { NotesTab };
