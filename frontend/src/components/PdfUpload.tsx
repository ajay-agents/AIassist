import { useState, type ChangeEvent, type DragEvent } from "react";
import { PdfExtractionError } from "../lib/pdfExtractionError";
import { Spinner, UploadIcon } from "./ui/Icon";

interface PdfUploadProps {
  label: string;
  onExtracted: (text: string, fileName: string) => void;
}

export function PdfUpload({ label, onExtracted }: PdfUploadProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function processFile(file: File) {
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

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-uploading the same filename later
    if (file) await processFile(file);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }

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
          <span className="text-xs text-muted">
            {status === "loading" ? "Extracting text…" : "Click to browse or drag & drop a PDF here"}
          </span>
        </span>
        <input type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
      </label>
      {status === "error" && error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
