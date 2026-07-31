// Client-side PDF text extraction — mirrors streamlit_app/pdf_utils.py's
// behavior and error messages, but runs in the browser via pdfjs-dist so
// the backend's JSON contract never has to know about PDFs at all.
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PdfExtractionError } from "./pdfExtractionError";

GlobalWorkerOptions.workerSrc = workerSrc;

export { PdfExtractionError };

interface TextItemLike {
  str?: string;
}

export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  // Deliberately leave loadingTask.onPassword unset: pdfjs-dist's own
  // default behavior (no handler registered) is to reject the promise
  // with a PasswordException, which is exactly what we want here — setting
  // a handler would mean *we* own the interactive retry flow instead.
  let pdf;
  try {
    pdf = await getDocument({ data: buffer }).promise;
  } catch (err) {
    const message = (err as Error).message ?? "";
    if ((err as Error).name === "PasswordException" || /password/i.test(message)) {
      throw new PdfExtractionError("This PDF is password-protected — remove the password and re-upload.");
    }
    throw new PdfExtractionError(`Couldn't read this PDF: ${message}`);
  }

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (item as TextItemLike).str ?? "")
      .join(" ")
      .trim();
    if (text) pageTexts.push(text);
  }

  const combined = pageTexts.join("\n\n");
  if (!combined.trim()) {
    throw new PdfExtractionError(
      "No selectable text found in this PDF — it may be a scanned image without an " +
        "OCR text layer. Try pasting the text directly instead.",
    );
  }
  return combined;
}
