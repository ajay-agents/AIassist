// Split out from pdfText.js so components can catch/import this error type
// without eagerly pulling in pdfjs-dist (~1MB+ with its worker) — that
// module is loaded dynamically, only once a user actually uploads a PDF.
export class PdfExtractionError extends Error {}
