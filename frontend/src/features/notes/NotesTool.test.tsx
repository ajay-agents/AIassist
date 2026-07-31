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
});
