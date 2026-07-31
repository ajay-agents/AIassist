import { useState, type ChangeEvent } from "react";
import { PdfExtractionError } from "../lib/pdfExtractionError";

interface PdfUploadProps {
  label: string;
  onExtracted: (text: string, fileName: string) => void;
}

export function PdfUpload({ label, onExtracted }: PdfUploadProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-uploading the same filename later
    if (!file) return;

    setStatus("loading");
    setError(null);
    try {
      // Dynamic import keeps pdfjs-dist (and its ~1MB worker) out of the
      // main bundle until a tester actually uploads a PDF.
      const { extractPdfText } = await import("../lib/pdfText");
      const text = await extractPdfText(file);
      onExtracted(text, file.name);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof PdfExtractionError ? err.message : "Couldn't read this PDF.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400">
        <span aria-hidden>📄</span>
        {label}
        <input type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
      </label>
      {status === "loading" && <span className="text-xs text-slate-500">Extracting text…</span>}
      {status === "error" && error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
