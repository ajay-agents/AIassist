import { useCallback, useRef, useState } from "react";
import { FileText, UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { PdfExtractionError } from "@/lib/pdfExtractionError";
import { cn } from "@/lib/utils";

/** onExtracted(text, fileName) fires once per successfully-extracted file,
 * in order — callers accumulate as if the file had been uploaded one at a
 * time. The dropzone never locks after a success so more files can always
 * be added. */
function PdfUpload({ title, description, className, compact = false, multiple = true, ocrLang, onExtracted }) {
  const [state, setState] = useState("empty"); // empty | dragging | extracting | done | error
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState([]);
  const inputRef = useRef(null);
  const resetTimer = useRef(null);

  const processFiles = useCallback(
    async (files) => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      setState("extracting");
      setErrors([]);
      const { extractPdfText } = await import("@/lib/pdfText");

      let successCount = 0;
      const failures = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setMessage(files.length > 1 ? `Extracting ${i + 1} of ${files.length}…` : `Extracting ${file.name}…`);
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
          failures.push(`${file.name} is not a PDF.`);
          continue;
        }
        try {
          const text = ocrLang === undefined ? await extractPdfText(file) : await extractPdfText(file, ocrLang);
          onExtracted(text, file.name);
          successCount++;
        } catch (err) {
          const reason = err instanceof PdfExtractionError ? err.message : "Couldn't read this PDF.";
          failures.push(files.length > 1 ? `${file.name}: ${reason}` : reason);
        }
      }

      if (failures.length > 0) {
        setState("error");
        setErrors(failures);
      } else {
        setState("done");
        setMessage(successCount > 1 ? `${successCount} files processed` : files[0]?.name);
        resetTimer.current = setTimeout(() => setState("empty"), 2000);
      }
    },
    [ocrLang, onExtracted],
  );

  const browse = () => inputRef.current?.click();

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        onClick={browse}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") browse();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (state !== "extracting") setState("dragging");
        }}
        onDragLeave={() => {
          if (state === "dragging") setState("empty");
        }}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files ?? []);
          const selected = multiple ? files : files.slice(0, 1);
          if (selected.length) void processFiles(selected);
          else setState("empty");
        }}
        className={cn(
          "group relative flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-surface/60 text-center transition-all duration-200 outline-none",
          compact ? "gap-2 px-5 py-7" : "gap-3 px-6 py-10",
          "hover:border-primary/60 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          state === "dragging" && "border-primary bg-accent/60",
          state === "done" && "border-solid border-success/40 bg-success/5",
          state === "error" && "border-destructive/50 bg-destructive/5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          aria-label={title}
          accept="application/pdf,.pdf"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = ""; // allow re-uploading the same filename(s) later
            if (files.length) void processFiles(files);
          }}
        />

        {state === "extracting" ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">{message}</p>
          </>
        ) : state === "done" ? (
          <>
            <CheckCircle2 className="h-6 w-6 text-success" />
            <p className="text-sm font-semibold text-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">Extracted successfully</p>
          </>
        ) : state === "error" ? (
          <>
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm font-semibold text-foreground">Some files couldn't be read</p>
            <div className="flex flex-col gap-0.5">
              {errors.map((err, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {err}
                </p>
              ))}
            </div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">Click to try again</p>
          </>
        ) : (
          <>
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary transition-transform duration-200 group-hover:-translate-y-0.5">
              {state === "dragging" ? <UploadCloud className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">PDF only · text extracted locally</p>
          </>
        )}
      </div>
    </div>
  );
}

export { PdfUpload };
