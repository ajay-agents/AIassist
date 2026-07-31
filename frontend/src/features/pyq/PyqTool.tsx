import { useState } from "react";
import { ApiError, analyzePyqs } from "../../api/client";
import type { LlmMeta, PyqResponse } from "../../api/types";
import { PdfUpload } from "../../components/PdfUpload";
import {
  Callout,
  Chip,
  ErrorBanner,
  FrequencyBar,
  LlmMetaLine,
  PrimaryButton,
  TextAreaField,
  TextField,
} from "../../components/ui/Primitives";

interface PyqToolProps {
  apiBaseUrl: string;
}

export function PyqTool({ apiBaseUrl }: PyqToolProps) {
  const [subject, setSubject] = useState("Physics");
  const [gradeLevel, setGradeLevel] = useState("Grade 10");
  const [questionsText, setQuestionsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PyqResponse | null>(null);
  const [llm, setLlm] = useState<LlmMeta | null>(null);

  async function handleSubmit() {
    if (!questionsText.trim()) {
      setError("Paste at least one question first, or upload a PDF above.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, llm } = await analyzePyqs(apiBaseUrl, {
        subject,
        grade_level: gradeLevel,
        questions_text: questionsText,
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Subject" value={subject} onChange={setSubject} />
        <TextField label="Grade level" value={gradeLevel} onChange={setGradeLevel} />
      </div>

      <PdfUpload
        label="Or upload a PDF of past questions"
        onExtracted={(text) => setQuestionsText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
      />

      <TextAreaField
        label="Pasted previous-year questions (any format)"
        value={questionsText}
        onChange={setQuestionsText}
        rows={10}
      />

      <div>
        <PrimaryButton onClick={handleSubmit} disabled={loading}>
          {loading ? "Analyzing…" : "Analyze"}
        </PrimaryButton>
      </div>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-col gap-3">
          {llm && <LlmMetaLine {...llm} />}

          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">High-yield topics</h3>
            {result.high_yield_topics.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">none identified</p>
            ) : (
              result.high_yield_topics.map((topic) => <Chip key={topic}>{topic}</Chip>)
            )}
          </div>

          {result.strategy_insight && <Callout>{result.strategy_insight}</Callout>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Topic frequency</h3>
              {result.topic_frequency.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No data.</p>
              ) : (
                result.topic_frequency.map((entry) => <FrequencyBar key={entry.label} {...entry} />)
              )}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Question-type frequency
              </h3>
              {result.type_frequency.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No data.</p>
              ) : (
                result.type_frequency.map((entry) => <FrequencyBar key={entry.label} {...entry} />)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
