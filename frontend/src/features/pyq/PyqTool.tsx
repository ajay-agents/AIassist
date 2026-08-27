import { useState } from "react";
import { ApiError, analyzePyqs } from "../../api/client";
import type { LlmMeta, PyqResponse } from "../../api/types";
import { PdfUpload } from "../../components/PdfUpload";
import {
  Callout,
  Card,
  Chip,
  EmptyState,
  ErrorBanner,
  FrequencyBar,
  LlmMetaLine,
  PrimaryButton,
  SectionHeading,
  StatRow,
  StatTile,
  TextAreaField,
  TextField,
  WarningBanner,
} from "../../components/ui/Primitives";

interface PyqToolProps {
  apiBaseUrl: string;
}

export function PyqTool({ apiBaseUrl }: PyqToolProps) {
  const [subject, setSubject] = useState("Physics");
  const [gradeLevel, setGradeLevel] = useState("Grade 10");
  const [questionsText, setQuestionsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PyqResponse | null>(null);
  const [llm, setLlm] = useState<LlmMeta | null>(null);

  async function handleSubmit() {
    setWarning(null);
    setError(null);
    if (!questionsText.trim()) {
      setWarning("Paste at least one question first, or upload a PDF above.");
      return;
    }
    setLoading(true);
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      {/* Form column */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <SectionHeading>Past questions</SectionHeading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Subject" value={subject} onChange={setSubject} />
            <TextField label="Grade level" value={gradeLevel} onChange={setGradeLevel} />
          </div>

          <PdfUpload
            label="Upload a PDF of past questions"
            onExtracted={(text) => setQuestionsText((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
          />

          <TextAreaField
            label="Pasted previous-year questions (any format)"
            value={questionsText}
            onChange={setQuestionsText}
            rows={10}
          />
        </Card>

        <PrimaryButton onClick={handleSubmit} disabled={loading} loading={loading}>
          {loading ? "Analyzing…" : "Analyze"}
        </PrimaryButton>

        {warning && <WarningBanner message={warning} />}
        {error && <ErrorBanner message={error} />}
      </div>

      {/* Results column */}
      <div className="flex flex-col gap-3">
        {!result && !loading && (
          <EmptyState
            title="Your frequency breakdown will appear here"
            description="Paste past papers and hit Analyze to see which topics and question types come up most."
          />
        )}

        {result && (
          <>
            {llm && <LlmMetaLine {...llm} />}

            <StatRow>
              <StatTile
                label="Questions analyzed"
                value={result.topic_frequency.reduce((sum, e) => sum + e.count, 0)}
              />
              <StatTile label="Topics found" value={result.topic_frequency.length} />
              <StatTile label="High-yield" value={result.high_yield_topics.length} />
              <StatTile label="Top topic" value={result.topic_frequency[0]?.label ?? "—"} />
            </StatRow>

            <div>
              <SectionHeading>High-yield topics</SectionHeading>
              {result.high_yield_topics.length === 0 ? (
                <p className="text-sm text-muted">none identified</p>
              ) : (
                <div>
                  {result.high_yield_topics.map((topic) => (
                    <Chip key={topic}>{topic}</Chip>
                  ))}
                </div>
              )}
            </div>

            {result.strategy_insight && <Callout label="Strategy insight">{result.strategy_insight}</Callout>}

            <Card>
              <SectionHeading>Topic frequency</SectionHeading>
              {result.topic_frequency.length === 0 ? (
                <p className="text-sm text-muted">No data.</p>
              ) : (
                result.topic_frequency.map((entry, i) => <FrequencyBar key={entry.label} rank={i + 1} {...entry} />)
              )}
            </Card>

            <Card>
              <SectionHeading>Question-type frequency</SectionHeading>
              {result.type_frequency.length === 0 ? (
                <p className="text-sm text-muted">No data.</p>
              ) : (
                result.type_frequency.map((entry, i) => <FrequencyBar key={entry.label} rank={i + 1} {...entry} />)
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
