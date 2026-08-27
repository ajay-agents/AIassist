import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { StudyPlanTool } from "./StudyPlanTool";

vi.mock("../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../api/client")>("../../api/client");
  return { ...actual, generateStudyPlan: vi.fn() };
});

import { generateStudyPlan } from "../../api/client";

const mockGenerate = vi.mocked(generateStudyPlan);

beforeEach(() => {
  mockGenerate.mockReset();
});

describe("StudyPlanTool", () => {
  it("renders the returned roadmap on success", async () => {
    mockGenerate.mockResolvedValue({
      data: {
        summary: "Focus on mechanics this week.",
        days: [
          {
            day: 1,
            total_minutes: 45,
            sessions: [{ subject: "Physics", topic: "Kinematics", kind: "learn", minutes: 45 }],
          },
        ],
      },
      llm: { provider: "gemini", model: "gemini-3.6-flash", tier: "flash", elapsedMs: 800 },
    });

    render(<StudyPlanTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.click(screen.getByRole("button", { name: /generate plan/i }));

    await waitFor(() => expect(screen.getByText("Focus on mechanics this week.")).toBeInTheDocument());
    expect(screen.getByText("Kinematics")).toBeInTheDocument();
    expect(screen.getByText(/gemini-3.6-flash/)).toBeInTheDocument();
    expect(mockGenerate).toHaveBeenCalledWith(
      "http://localhost:8000",
      expect.objectContaining({ grade_level: "Grade 10", total_days: 7, hours_per_day: 3 }),
      expect.any(AbortSignal),
    );
  });

  it("shows a warning instead of calling the API when no subjects are named", async () => {
    render(<StudyPlanTool apiBaseUrl="http://localhost:8000" />);
    for (const nameInput of screen.getAllByLabelText("Name")) {
      await userEvent.clear(nameInput);
    }
    await userEvent.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(await screen.findByText(/add at least one subject/i)).toBeInTheDocument();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("shows the API error message when the request fails", async () => {
    mockGenerate.mockRejectedValue(new ApiError(502, "Both Gemini and Groq failed for this request."));

    render(<StudyPlanTool apiBaseUrl="http://localhost:8000" />);
    await userEvent.click(screen.getByRole("button", { name: /generate plan/i }));

    expect(await screen.findByText(/both gemini and groq failed/i)).toBeInTheDocument();
  });
});
