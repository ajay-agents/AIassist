import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PdfUpload } from "./PdfUpload";

// PdfUpload dynamically imports "../lib/pdfText" (to keep pdfjs-dist out of
// the main bundle) but statically imports PdfExtractionError from the
// separate, pdfjs-dist-free "../lib/pdfExtractionError" for its `instanceof`
// check. The mock must reuse that SAME class — a locally-defined lookalike
// class would fail `instanceof` even with an identical name/message.
vi.mock("../lib/pdfText", async () => {
  const { PdfExtractionError } = await import("../lib/pdfExtractionError");
  return { PdfExtractionError, extractPdfText: vi.fn() };
});

import { PdfExtractionError } from "../lib/pdfExtractionError";
import { extractPdfText } from "../lib/pdfText";

const mockExtract = vi.mocked(extractPdfText);

describe("PdfUpload", () => {
  it("calls onExtracted with the extracted text on success", async () => {
    mockExtract.mockResolvedValue("Extracted question text.");
    const onExtracted = vi.fn();
    render(<PdfUpload label="Upload a PDF" onExtracted={onExtracted} />);

    const input = screen.getByLabelText(/upload a pdf/i, { selector: "input" });
    const file = new File(["dummy"], "questions.pdf", { type: "application/pdf" });
    await userEvent.upload(input, file);

    await waitFor(() => expect(onExtracted).toHaveBeenCalledWith("Extracted question text.", "questions.pdf"));
  });

  it("shows the error message when extraction fails", async () => {
    mockExtract.mockRejectedValue(new PdfExtractionError("This PDF is password-protected."));
    render(<PdfUpload label="Upload a PDF" onExtracted={vi.fn()} />);

    const input = screen.getByLabelText(/upload a pdf/i, { selector: "input" });
    const file = new File(["dummy"], "locked.pdf", { type: "application/pdf" });
    await userEvent.upload(input, file);

    expect(await screen.findByText(/password-protected/)).toBeInTheDocument();
  });
});
