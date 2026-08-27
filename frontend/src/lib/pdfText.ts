// Client-side PDF text extraction — mirrors streamlit_app/pdf_utils.py's
// behavior and error messages, but runs in the browser via pdfjs-dist so
// the backend's JSON contract never has to know about PDFs at all.
import { GlobalWorkerOptions, getDocument, type PDFPageProxy } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PdfExtractionError } from "./pdfExtractionError";

GlobalWorkerOptions.workerSrc = workerSrc;

export { PdfExtractionError };

interface TextItemLike {
  str?: string;
}

async function extractPageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent();
  return content.items
    .map((item) => (item as TextItemLike).str ?? "")
    .join(" ")
    .trim();
}

/** Renders a page to an offscreen canvas and runs it through OCR — the
 * fallback for scanned/image-only pages that have no text layer at all.
 * Any failure here (e.g. no network access to fetch the OCR engine) is
 * swallowed by the caller: OCR is a best-effort improvement, not something
 * that should turn one bad page into a hard failure for the whole PDF. */
async function ocrPageText(page: PDFPageProxy, ocrLang: string): Promise<string> {
  const { ocrCanvas } = await import("./ocr");
  const viewport = page.getViewport({ scale: 2 }); // upscaled for OCR accuracy
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;
  return ocrCanvas(canvas, ocrLang);
}

/** ocrLang: a Tesseract.js language code (default "eng"). Study Desk is
 * explicitly curriculum-neutral — no country or board assumed — so this
 * isn't hardcoded English-only; pass a different code for notes/papers
 * scanned in another language. */
export async function extractPdfText(file: File, ocrLang: string = "eng"): Promise<string> {
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
  let ocrAttempted = false;
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const text = await extractPageText(page);
    if (text) {
      pageTexts.push(text);
      continue;
    }

    // No text layer on this page (common for a scanned/photographed page)
    // — fall back to OCR rather than silently dropping it.
    ocrAttempted = true;
    try {
      const ocrText = await ocrPageText(page, ocrLang);
      if (ocrText) pageTexts.push(ocrText);
    } catch {
      // OCR itself failed for this page — skip it and keep going with
      // the rest of the document instead of failing the whole upload.
    }
  }

  const combined = pageTexts.join("\n\n");
  if (!combined.trim()) {
    throw new PdfExtractionError(
      ocrAttempted
        ? "No text could be extracted from this PDF, even with OCR — the scan may be too low-quality " +
          "or blank. Try pasting the text directly instead."
        : "No selectable text found in this PDF — it may be a scanned image without an " +
          "OCR text layer. Try pasting the text directly instead.",
    );
  }
  return combined;
}
