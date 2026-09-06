import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PdfUpload } from "./PdfUpload";

// PdfUpload dynamically imports "@/lib/pdfText" (to keep pdfjs-dist out of
// the main bundle) but statically imports PdfExtractionError from the
// separate, pdfjs-dist-free "@/lib/pdfExtractionError" for its `instanceof`
// check. The mock must reuse that SAME class — a locally-defined lookalike
// class would fail `instanceof` even with an identical name/message.
vi.mock("@/lib/pdfText", async () => {
  const { PdfExtractionError } = await import("@/lib/pdfExtractionError");
  return { PdfExtractionError, extractPdfText: vi.fn() };
});

import { PdfExtractionError } from "@/lib/pdfExtractionError";
import { extractPdfText } from "@/lib/pdfText";

describe("PdfUpload", () => {
  it("calls onExtracted with the extracted text on success", async () => {
    extractPdfText.mockResolvedValue("Extracted question text.");
    const onExtracted = vi.fn();
    render(<PdfUpload title="Upload a PDF" description="drop it" onExtracted={onExtracted} multiple={false} />);

    const input = screen.getByLabelText(/upload a pdf/i, { selector: "input" });
    const file = new File(["dummy"], "questions.pdf", { type: "application/pdf" });
    await userEvent.upload(input, file);

    await waitFor(() => expect(onExtracted).toHaveBeenCalledWith("Extracted question text.", "questions.pdf"));
  });

  it("shows the error message when extraction fails", async () => {
    extractPdfText.mockRejectedValue(new PdfExtractionError("This PDF is password-protected."));
    render(<PdfUpload title="Upload a PDF" description="drop it" onExtracted={vi.fn()} multiple={false} />);

    const input = screen.getByLabelText(/upload a pdf/i, { selector: "input" });
    const file = new File(["dummy"], "locked.pdf", { type: "application/pdf" });
    await userEvent.upload(input, file);

    expect(await screen.findByText(/password-protected/)).toBeInTheDocument();
  });

  it("does not set the multiple attribute when multiple={false}", () => {
    render(<PdfUpload title="Upload a PDF" description="drop it" onExtracted={vi.fn()} multiple={false} />);
    const input = screen.getByLabelText(/upload a pdf/i, { selector: "input" });
    expect(input.multiple).toBe(false);
  });

  it("extracts each selected file and calls onExtracted once per file, in order, when multiple is allowed", async () => {
    extractPdfText.mockImplementation((file) => Promise.resolve(`text from ${file.name}`));
    const onExtracted = vi.fn();
    render(<PdfUpload title="Upload PDFs" description="drop them" onExtracted={onExtracted} />);

    const input = screen.getByLabelText(/upload pdfs/i, { selector: "input" });
    expect(input.multiple).toBe(true);
    const fileA = new File(["a"], "a.pdf", { type: "application/pdf" });
    const fileB = new File(["b"], "b.pdf", { type: "application/pdf" });
    await userEvent.upload(input, [fileA, fileB]);

    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(2));
    expect(onExtracted).toHaveBeenNthCalledWith(1, "text from a.pdf", "a.pdf");
    expect(onExtracted).toHaveBeenNthCalledWith(2, "text from b.pdf", "b.pdf");
  });

  it("still extracts the files that succeed when one file in a multi-select fails", async () => {
    extractPdfText.mockImplementation((file) =>
      file.name === "locked.pdf"
        ? Promise.reject(new PdfExtractionError("This PDF is password-protected."))
        : Promise.resolve(`text from ${file.name}`),
    );
    const onExtracted = vi.fn();
    render(<PdfUpload title="Upload PDFs" description="drop them" onExtracted={onExtracted} />);

    const input = screen.getByLabelText(/upload pdfs/i, { selector: "input" });
    const good = new File(["a"], "good.pdf", { type: "application/pdf" });
    const locked = new File(["b"], "locked.pdf", { type: "application/pdf" });
    await userEvent.upload(input, [good, locked]);

    await waitFor(() => expect(onExtracted).toHaveBeenCalledWith("text from good.pdf", "good.pdf"));
    expect(onExtracted).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/locked\.pdf.*password-protected/)).toBeInTheDocument();
  });
});
