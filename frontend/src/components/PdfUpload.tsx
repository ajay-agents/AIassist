import { useState, type ChangeEvent, type DragEvent } from "react";
import { PdfExtractionError } from "../lib/pdfExtractionError";
import { Spinner, UploadIcon } from "./ui/Icon";

interface PdfUploadProps {
  label: string;
  onExtracted: (text: string, fileName: string) => void;
  /** Allow selecting/dropping more than one PDF in a single go — each file
   * that extracts successfully triggers its own onExtracted call, in order,
   * so callers just accumulate as if the user uploaded them one at a time. */
  multiple?: boolean;
  /** Tesseract.js language code used for the scanned-page OCR fallback.
   * Defaults to English, but isn't hardcoded to it — Study Desk is
   * explicitly curriculum-neutral, so a caller can pass a different code
   * for notes/papers scanned in another language. */
  ocrLang?: string;
}

export function PdfUpload({ label, onExtracted, multiple = false, ocrLang }: PdfUploadProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);

  async function processFiles(files: File[]) {
    setStatus("loading");
    setErrors([]);
    const { extractPdfText } = await import("../lib/pdfText");
    const failures: string[] = [];

    for (let i = 0; i < files.length; i++) {
      setProgress({ done: i, total: files.length });
      const file = files[i];
      try {
        const text = ocrLang === undefined ? await extractPdfText(file) : await extractPdfText(file, ocrLang);
        onExtracted(text, file.name);
      } catch (err) {
        const message = err instanceof PdfExtractionError ? err.message : "Couldn't read this PDF.";
        failures.push(files.length > 1 ? `${file.name}: ${message}` : message);
      }
    }

    setProgress(null);
    setStatus(failures.length > 0 ? "error" : "idle");
    setErrors(failures);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // allow re-uploading the same filename(s) later
    if (files.length) await processFiles(files);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) await processFiles(multiple ? files : files.slice(0, 1));
  }

  const helperText =
    status === "loading"
      ? progress
        ? `Extracting ${progress.done + 1} of ${progress.total}…`
        : "Extracting text…"
      : `Click to browse or drag & drop ${multiple ? "one or more PDFs" : "a PDF"} here`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer items-center gap-3 border-2 border-dashed px-4 py-3 text-sm transition ${
          dragActive ? "border-accent bg-accent/10" : "border-rule text-muted hover:border-ink/40"
        }`}
      >
        {status === "loading" ? <Spinner className="h-5 w-5 shrink-0 text-accent" /> : <UploadIcon className="h-5 w-5 shrink-0" />}
        <span className="flex flex-col">
          <span className="font-medium text-ink">{label}</span>
          <span className="text-xs text-muted">{helperText}</span>
        </span>
        <input type="file" accept="application/pdf" multiple={multiple} className="hidden" onChange={handleChange} />
      </label>
      {status === "error" && errors.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {errors.map((message, i) => (
            <span key={i} className="text-xs text-danger">
              {message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
