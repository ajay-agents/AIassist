import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ApiError, summarizeNotes } from "../../api/client";
import type { LlmMeta, NotesResponse, NotesStyle } from "../../api/types";
import { PdfUpload } from "../../components/PdfUpload";
import {
  Card,
  EmptyState,
  ErrorBanner,
  LlmMetaLine,
  PrimaryButton,
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

  async function handleSubmit() {
    setWarning(null);
    setError(null);
    if (!notesText.trim()) {
      setWarning("Paste some notes first, or upload a PDF above.");
      return;
    }
    setLoading(true);
    try {
      const { data, llm } = await summarizeNotes(apiBaseUrl, {
        subject,
        grade_level: gradeLevel,
        notes_text: notesText,
        style,
      });
      setResult(data);
      setLlm(llm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
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
            label="Upload a PDF of notes"
            onExtracted={(text) => setNotesText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
          />

          <TextAreaField label="Pasted notes" value={notesText} onChange={setNotesText} rows={12} />
          <p className="font-data -mt-2 text-xs text-muted">
            {notesText.length} characters — the backend automatically switches to the pro-tier model for longer
            pastes.
          </p>
        </Card>

        <PrimaryButton onClick={handleSubmit} disabled={loading} loading={loading}>
          {loading ? "Summarizing…" : "Summarize"}
        </PrimaryButton>

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

            <Card className="prose prose-sm max-w-none font-body prose-headings:font-display prose-headings:text-ink prose-p:text-ink prose-li:text-ink prose-strong:text-ink prose-a:text-accent-ink prose-code:text-ink prose-h2:border-b prose-h2:border-rule prose-h2:pb-1">
              <ReactMarkdown>{result.summary_markdown}</ReactMarkdown>
            </Card>

            <div>
              <SectionHeading count={result.key_terms.length}>Key terms</SectionHeading>
              <ul className="flex flex-col gap-2">
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
