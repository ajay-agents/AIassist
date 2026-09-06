import { beforeEach, describe, expect, it, vi } from "vitest";

// pdfjs-dist needs real DOM/canvas APIs and real binary PDF bytes to do
// actual parsing — neither is worth faking here. We mock the library the
// same way the Python tests mock PdfReader: verify OUR error-handling and
// text-joining logic, not pdfjs-dist's own internals.
const mockGetDocument = vi.fn();

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: (...args) => mockGetDocument(...args),
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "" }));

// OCR itself (tesseract.js) is exercised in ocr.test.js — here we only need
// to verify pdfText.js calls into it correctly on a textless page.
vi.mock("./ocr", () => ({ ocrCanvas: vi.fn() }));
import { ocrCanvas } from "./ocr";

beforeEach(() => {
  mockGetDocument.mockReset();
  ocrCanvas.mockReset();
});

/** A page with no getViewport/render at all — simulates the OCR attempt
 * itself throwing (e.g. a genuinely un-renderable page), so pdfText.js's
 * try/catch around OCR must swallow it and move on. */
function fakeTextOnlyPage(text) {
  return { getTextContent: () => Promise.resolve({ items: [{ str: text }] }) };
}

/** A page that can be rendered for OCR (getViewport + render both work). */
function fakeRenderablePage(text) {
  return {
    getTextContent: () => Promise.resolve({ items: [{ str: text }] }),
    getViewport: () => ({ width: 10, height: 10 }),
    render: () => ({ promise: Promise.resolve() }),
  };
}

function fakePdf(pages) {
  return {
    numPages: pages.length,
    getPage: (pageNum) => Promise.resolve(pages[pageNum - 1]),
  };
}

describe("extractPdfText", () => {
  it("joins text from multiple pages", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakePdf([fakeTextOnlyPage("Page one."), fakeTextOnlyPage("Page two.")])) });
    const { extractPdfText } = await import("./pdfText");

    const result = await extractPdfText(new File(["dummy"], "test.pdf"));

    expect(result).toContain("Page one.");
    expect(result).toContain("Page two.");
  });

  it("skips blank pages", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakePdf([fakeTextOnlyPage(""), fakeTextOnlyPage("Only real content.")])) });
    const { extractPdfText } = await import("./pdfText");

    const result = await extractPdfText(new File(["dummy"], "test.pdf"));

    expect(result.trim()).toBe("Only real content.");
  });

  it("falls back to OCR for a page with no text layer, and uses the recovered text", async () => {
    ocrCanvas.mockResolvedValue("Recovered by OCR.");
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakePdf([fakeRenderablePage(""), fakeTextOnlyPage("Normal page.")])) });
    const { extractPdfText } = await import("./pdfText");

    const result = await extractPdfText(new File(["dummy"], "scanned.pdf"));

    expect(result).toContain("Recovered by OCR.");
    expect(result).toContain("Normal page.");
    expect(ocrCanvas).toHaveBeenCalledTimes(1);
  });

  it("skips a page whose OCR attempt itself fails, without failing the whole document", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakePdf([fakeTextOnlyPage(""), fakeTextOnlyPage("Only real content.")])) });
    const { extractPdfText } = await import("./pdfText");

    const result = await extractPdfText(new File(["dummy"], "test.pdf"));

    expect(result.trim()).toBe("Only real content.");
    expect(ocrCanvas).not.toHaveBeenCalled();
  });

  it("raises a clear error mentioning OCR when nothing can be extracted even after trying it", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakePdf([fakeTextOnlyPage(""), fakeTextOnlyPage("")])) });
    const { extractPdfText, PdfExtractionError } = await import("./pdfText");

    await expect(extractPdfText(new File(["dummy"], "scanned.pdf"))).rejects.toThrow(PdfExtractionError);
    await expect(extractPdfText(new File(["dummy"], "scanned.pdf"))).rejects.toThrow(/even with OCR/);
  });

  it("raises a clear error on a password-protected PDF", async () => {
    const task = {
      promise: new Promise((_resolve, reject) => {
        const err = new Error("No password given");
        err.name = "PasswordException";
        reject(err);
      }),
    };
    mockGetDocument.mockReturnValue(task);
    const { extractPdfText, PdfExtractionError } = await import("./pdfText");

    await expect(extractPdfText(new File(["dummy"], "locked.pdf"))).rejects.toThrow(PdfExtractionError);
    await expect(extractPdfText(new File(["dummy"], "locked.pdf"))).rejects.toThrow(/password-protected/);
  });

  it("raises a clear error when the document fails to parse", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error("bad xref")) });
    const { extractPdfText, PdfExtractionError } = await import("./pdfText");

    await expect(extractPdfText(new File(["dummy"], "broken.pdf"))).rejects.toThrow(PdfExtractionError);
    await expect(extractPdfText(new File(["dummy"], "broken.pdf"))).rejects.toThrow(/Couldn't read/);
  });
});
