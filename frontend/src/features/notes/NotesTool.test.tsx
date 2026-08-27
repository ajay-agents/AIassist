import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { NotesTool } from "./NotesTool";

vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../api/client")>("../../api/client");
  return { ...actual, summarizeNotes: vi.fn() };
});

import { summarizeNotes } from "../../api/client";

const mockSummarize = vi.mocked(summarizeNotes);

beforeEach(() => {
  mockSummarize.mockReset();
});

describe("NotesTool", () => {
  it("renders the markdown summary and key terms on success", async () => {
    mockSummarize.mockResolvedValue({
      data: {
        summary_markdown: "## Cell Biology\n\nCells are the **basic** unit of life.",
        key_terms: ["Mitochondria: the powerhouse of the cell."],
      },
      llm: { provider: "gemini", model: "gemini-2.5-pro", tier: "pro", elapsedMs: 1200 },
    });

    render(<NotesTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.type(screen.getByLabelText(/pasted notes/i), "Mitochondria is the powerhouse of the cell.");
    await userEvent.click(screen.getByRole("button", { name: /^summarize$/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Cell Biology" })).toBeInTheDocument());
    expect(screen.getByText("basic")).toBeInTheDocument();
    expect(screen.getByText(/Mitochondria: the powerhouse/)).toBeInTheDocument();
    expect(screen.getByText(/gemini-2.5-pro/)).toBeInTheDocument();
  });

  it("renders a GitHub-flavored markdown table as an actual <table>, not literal pipe text", async () => {
    const tableMarkdown = [
      "| Term | Meaning |",
      "| --- | --- |",
      "| Mitosis | Cell division producing two identical cells |",
      "| Meiosis | Cell division producing four gametes |",
    ].join("\n");
    mockSummarize.mockResolvedValue({
      data: { summary_markdown: tableMarkdown, key_terms: ["Mitosis"] },
      llm: { provider: "gemini", model: "gemini-2.5-pro", tier: "pro", elapsedMs: 900 },
    });

    render(<NotesTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.type(screen.getByLabelText(/pasted notes/i), "Cell division notes.");
    await userEvent.click(screen.getByRole("button", { name: /^summarize$/i }));

    const table = await screen.findByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Meaning" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Cell division producing four gametes" })).toBeInTheDocument();
    // The raw pipe syntax must not leak through as literal text.
    expect(screen.queryByText(/\| Mitosis \|/)).not.toBeInTheDocument();
  });

  it("warns instead of calling the API when no notes are entered", async () => {
    render(<NotesTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.click(screen.getByRole("button", { name: /^summarize$/i }));

    expect(await screen.findByText(/paste some notes first/i)).toBeInTheDocument();
    expect(mockSummarize).not.toHaveBeenCalled();
  });

  it("shows the API error message when the request fails", async () => {
    mockSummarize.mockRejectedValue(new ApiError(422, "no key terms could be extracted from the given notes"));

    render(<NotesTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.type(screen.getByLabelText(/pasted notes/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /^summarize$/i }));

    expect(await screen.findByText(/no key terms could be extracted/i)).toBeInTheDocument();
  });

  it("lets the user stop an in-flight request via the Stop button, with no error shown", async () => {
    mockSummarize.mockImplementation(
      (_baseUrl, _payload, signal) =>
        new Promise((_resolve, reject) => {
          // Mirrors what the real fetch-based client does: rejects with
          // AbortError once the passed signal is aborted.
          signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );

    render(<NotesTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.type(screen.getByLabelText(/pasted notes/i), "Some notes to summarize.");
    await userEvent.click(screen.getByRole("button", { name: /^summarize$/i }));

    const stopButton = await screen.findByRole("button", { name: /^stop$/i });
    await userEvent.click(stopButton);

    await waitFor(() => expect(screen.getByRole("button", { name: /^summarize$/i })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^stop$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
