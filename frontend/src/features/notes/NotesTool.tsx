import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ApiError, summarizeNotes } from "../../api/client";
import type { LlmMeta, NotesResponse, NotesStyle } from "../../api/types";
import { PdfUpload } from "../../components/PdfUpload";
import {
  Card,
  EmptyState,
  ErrorBanner,
  LlmMetaLine,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  StatRow,
  StatTile,
  TextAreaField,
  TextField,
  WarningBanner,
} from "../../components/ui/Primitives";

const STYLES: { id: NotesStyle; label: string }[] = [
  { id: "structured", label: "Structured" },
  { id: "bullet", label: "Bullet" },
  { id: "exam-focused", label: "Exam-focused" },
];

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

interface NotesToolProps {
  apiBaseUrl: string;
}

export function NotesTool({ apiBaseUrl }: NotesToolProps) {
  const [subject, setSubject] = useState("Biology");
  const [gradeLevel, setGradeLevel] = useState("Grade 10");
  const [style, setStyle] = useState<NotesStyle>("structured");
  const [notesText, setNotesText] = useState("");
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NotesResponse | null>(null);
  const [llm, setLlm] = useState<LlmMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit() {
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
      const { data, llm } = await summarizeNotes(
        apiBaseUrl,
        { subject, grade_level: gradeLevel, notes_text: notesText, style },
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      {/* Form column */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <SectionHeading>Your notes</SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Subject" value={subject} onChange={setSubject} />
            <TextField label="Grade level" value={gradeLevel} onChange={setGradeLevel} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted">Style</span>
            <div className="flex border border-rule">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  aria-pressed={style === s.id}
                  className={`flex-1 border-r border-rule px-3 py-1.5 text-sm font-medium transition last:border-r-0 ${
                    style === s.id ? "bg-ink text-paper" : "text-muted hover:bg-paper"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <PdfUpload
            label="Upload PDFs of notes"
            multiple
            onExtracted={(text) => setNotesText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
          />

          <TextAreaField label="Pasted notes" value={notesText} onChange={setNotesText} rows={12} />
          <p className="font-data -mt-2 text-xs text-muted">
            {notesText.length} characters — the backend automatically switches to the pro-tier model for longer
            pastes.
          </p>
        </Card>

        <div className="flex gap-2">
          <PrimaryButton onClick={handleSubmit} disabled={loading} loading={loading}>
            {loading ? "Summarizing…" : "Summarize"}
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
            title="Your summary will appear here"
            description="Paste your notes and hit Summarize to get an expert-tutor-style summary plus key terms."
          />
        )}

        {result && (
          <>
            {llm && <LlmMetaLine {...llm} />}

            <StatRow>
              <StatTile label="Key terms" value={result.key_terms.length} />
              <StatTile label="Style" value={STYLES.find((s) => s.id === style)?.label ?? style} />
              <StatTile label="Summary length" value={`${wordCount(result.summary_markdown)}w`} />
              <StatTile
                label="Reading time"
                value={`${Math.max(1, Math.round(wordCount(result.summary_markdown) / 200))} min`}
              />
            </StatRow>

            <Card className="prose prose-sm max-h-[32rem] max-w-none overflow-auto font-body prose-headings:font-display prose-headings:text-ink prose-p:text-ink prose-li:text-ink prose-strong:text-ink prose-a:text-accent-ink prose-code:text-ink prose-h2:border-b prose-h2:border-rule prose-h2:pb-1 prose-table:text-sm prose-thead:border-rule prose-th:text-ink prose-td:border-rule">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary_markdown}</ReactMarkdown>
            </Card>

            <div>
              <SectionHeading count={result.key_terms.length}>Key terms</SectionHeading>
              <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                {result.key_terms.map((term, i) => (
                  <li key={i}>
                    <Card className="text-sm text-ink">{term}</Card>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
