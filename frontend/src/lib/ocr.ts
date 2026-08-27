// Client-side OCR fallback for scanned/image-only PDF pages (no text layer),
// via tesseract.js. Dynamically imported only when a page actually needs
// it, so the ~couple-MB OCR engine + language data never load for the
// common case of a normal, text-layer PDF. Requires network access on
// first use, to fetch tesseract.js's WASM core and the requested
// language's trained data from its default CDN.
import type { Worker } from "tesseract.js";

export const DEFAULT_OCR_LANG = "eng";

// Cached per-language, not a single global — Study Desk is explicitly
// curriculum-neutral (no country/board assumed), so hardcoding English-only
// OCR here would be inconsistent with that principle for anyone scanning
// notes in another language. Callers can pass a different Tesseract
// language code; this just makes that possible instead of baking in one
// language architecturally.
const workerPromises = new Map<string, Promise<Worker>>();

function getWorker(lang: string): Promise<Worker> {
  let promise = workerPromises.get(lang);
  if (!promise) {
    promise = import("tesseract.js").then(({ createWorker }) => createWorker(lang));
    workerPromises.set(lang, promise);
  }
  return promise;
}

export async function ocrCanvas(canvas: HTMLCanvasElement, lang: string = DEFAULT_OCR_LANG): Promise<string> {
  const worker = await getWorker(lang);
  const {
    data: { text },
  } = await worker.recognize(canvas);
  return text.trim();
}
