import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ApiError, summarizeNotes } from "../../api/client";
import type { LlmMeta, NotesResponse, NotesStyle } from "../../api/types";
import { PdfUpload } from "../../components/PdfUpload";
import { Card, ErrorBanner, LlmMetaLine, PrimaryButton, TextAreaField, TextField } from "../../components/ui/Primitives";

const STYLES: NotesStyle[] = ["structured", "bullet", "exam-focused"];

interface NotesToolProps {
  apiBaseUrl: string;
}

export function NotesTool({ apiBaseUrl }: NotesToolProps) {
  const [subject, setSubject] = useState("Biology");
  const [gradeLevel, setGradeLevel] = useState("Grade 10");
  const [style, setStyle] = useState<NotesStyle>("structured");
  const [notesText, setNotesText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NotesResponse | null>(null);
  const [llm, setLlm] = useState<LlmMeta | null>(null);

  async function handleSubmit() {
    if (!notesText.trim()) {
      setError("Paste some notes first, or upload a PDF above.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Subject" value={subject} onChange={setSubject} />
        <TextField label="Grade level" value={gradeLevel} onChange={setGradeLevel} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Style</span>
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={style}
            onChange={(e) => setStyle(e.target.value as NotesStyle)}
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PdfUpload
        label="Or upload a PDF of notes"
        onExtracted={(text) => setNotesText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
      />

      <TextAreaField label="Pasted notes" value={notesText} onChange={setNotesText} rows={12} />
      <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
        {notesText.length} characters — the backend automatically switches to the pro-tier model for longer pastes.
      </p>

      <div>
        <PrimaryButton onClick={handleSubmit} disabled={loading}>
          {loading ? "Summarizing…" : "Summarize"}
        </PrimaryButton>
      </div>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-col gap-3">
          {llm && <LlmMetaLine {...llm} />}

          <Card className="prose prose-sm max-w-none prose-slate dark:prose-invert prose-headings:font-semibold prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-1 dark:prose-h2:border-slate-800">
            <ReactMarkdown>{result.summary_markdown}</ReactMarkdown>
          </Card>

          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Key terms</h3>
            <ul className="flex flex-col gap-2">
              {result.key_terms.map((term, i) => (
                <li key={i}>
                  <Card className="text-sm text-slate-700 dark:text-slate-300">{term}</Card>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
