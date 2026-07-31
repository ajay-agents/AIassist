import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { PyqTool } from "./PyqTool";

vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../api/client")>("../../api/client");
  return { ...actual, analyzePyqs: vi.fn() };
});

import { analyzePyqs } from "../../api/client";

const mockAnalyze = vi.mocked(analyzePyqs);

beforeEach(() => {
  mockAnalyze.mockReset();
});

describe("PyqTool", () => {
  it("renders frequencies, chips, and insight on success", async () => {
    mockAnalyze.mockResolvedValue({
      data: {
        topic_frequency: [{ label: "Kinematics", count: 3, percentage: 60 }],
        type_frequency: [{ label: "MCQ", count: 5, percentage: 100 }],
        high_yield_topics: ["Kinematics"],
        strategy_insight: "Focus on Kinematics.",
      },
      llm: { provider: "groq", model: "llama-3.1-8b-instant", tier: "flash", elapsedMs: 500 },
    });

    render(<PyqTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.type(screen.getByLabelText(/pasted previous-year questions/i), "What is velocity?");
    await userEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    await waitFor(() => expect(screen.getByText("Focus on Kinematics.")).toBeInTheDocument());
    expect(screen.getAllByText("Kinematics").length).toBeGreaterThan(0);
    expect(screen.getByText(/llama-3.1-8b-instant/)).toBeInTheDocument();
  });

  it("warns instead of calling the API when no questions are entered", async () => {
    render(<PyqTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    expect(await screen.findByText(/paste at least one question/i)).toBeInTheDocument();
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it("shows the API error message when the request fails", async () => {
    mockAnalyze.mockRejectedValue(new ApiError(422, "questions_text: String should have at least 1 character"));

    render(<PyqTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.type(screen.getByLabelText(/pasted previous-year questions/i), "q");
    await userEvent.click(screen.getByRole("button", { name: /^analyze$/i }));

    expect(await screen.findByText(/should have at least 1 character/i)).toBeInTheDocument();
  });
});
