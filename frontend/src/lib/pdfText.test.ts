import { beforeEach, describe, expect, it, vi } from "vitest";

// pdfjs-dist needs real DOM/canvas APIs and real binary PDF bytes to do
// actual parsing — neither is worth faking here. We mock the library the
// same way the Python tests mock PdfReader: verify OUR error-handling and
// text-joining logic, not pdfjs-dist's own internals.
const mockGetDocument = vi.fn();

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  PasswordResponses: { NEED_PASSWORD: 1 },
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "" }));

function fakePdf(pages: string[]) {
  return {
    numPages: pages.length,
    getPage: (pageNum: number) =>
      Promise.resolve({
        getTextContent: () => Promise.resolve({ items: [{ str: pages[pageNum - 1] }] }),
      }),
  };
}

beforeEach(() => {
  mockGetDocument.mockReset();
});

describe("extractPdfText", () => {
  it("joins text from multiple pages", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakePdf(["Page one.", "Page two."])), onPassword: undefined });
    const { extractPdfText } = await import("./pdfText");

    const result = await extractPdfText(new File(["dummy"], "test.pdf"));

    expect(result).toContain("Page one.");
    expect(result).toContain("Page two.");
  });

  it("skips blank pages", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakePdf(["", "Only real content."])), onPassword: undefined });
    const { extractPdfText } = await import("./pdfText");

    const result = await extractPdfText(new File(["dummy"], "test.pdf"));

    expect(result.trim()).toBe("Only real content.");
  });

  it("raises a clear error when no text is found (scanned PDF)", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.resolve(fakePdf(["", ""])), onPassword: undefined });
    const { extractPdfText, PdfExtractionError } = await import("./pdfText");

    await expect(extractPdfText(new File(["dummy"], "scanned.pdf"))).rejects.toThrow(PdfExtractionError);
    await expect(extractPdfText(new File(["dummy"], "scanned.pdf"))).rejects.toThrow(/No selectable text/);
  });

  it("raises a clear error on a password-protected PDF", async () => {
    const task = {
      onPassword: undefined as unknown as (cb: (r: unknown) => void) => void,
      promise: null as unknown as Promise<never>,
    };
    task.promise = new Promise((_resolve, reject) => {
      const err = new Error("No password given");
      err.name = "PasswordException";
      reject(err);
    });
    mockGetDocument.mockReturnValue(task);
    const { extractPdfText, PdfExtractionError } = await import("./pdfText");

    await expect(extractPdfText(new File(["dummy"], "locked.pdf"))).rejects.toThrow(PdfExtractionError);
    await expect(extractPdfText(new File(["dummy"], "locked.pdf"))).rejects.toThrow(/password-protected/);
  });

  it("raises a clear error when the document fails to parse", async () => {
    mockGetDocument.mockReturnValue({ promise: Promise.reject(new Error("bad xref")), onPassword: undefined });
    const { extractPdfText, PdfExtractionError } = await import("./pdfText");

    await expect(extractPdfText(new File(["dummy"], "broken.pdf"))).rejects.toThrow(PdfExtractionError);
    await expect(extractPdfText(new File(["dummy"], "broken.pdf"))).rejects.toThrow(/Couldn't read/);
  });
});
