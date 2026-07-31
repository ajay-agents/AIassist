import { describe, expect, it, vi } from "vitest";
import { ApiError, extractErrorMessage, generateStudyPlan } from "./client";

describe("extractErrorMessage", () => {
  it("returns a plain string detail as-is", () => {
    expect(extractErrorMessage({ detail: "no key terms could be extracted" })).toBe(
      "no key terms could be extracted",
    );
  });

  it("formats a pydantic validation error array", () => {
    const body = {
      detail: [{ type: "string_too_short", loc: ["body", "questions_text"], msg: "String should have at least 1 character" }],
    };
    expect(extractErrorMessage(body)).toBe("body.questions_text: String should have at least 1 character");
  });

  it("falls back gracefully for an unexpected shape", () => {
    expect(extractErrorMessage(null)).toBe("Request failed");
    expect(extractErrorMessage({})).toBe("Request failed");
  });
});

describe("generateStudyPlan", () => {
  const payload = {
    subjects: [{ name: "Physics", topics_or_syllabus: "Kinematics", priority: 3, difficulty: 3 }],
    grade_level: "Grade 10",
    total_days: 3,
    hours_per_day: 2,
  };

  it("parses the response body and X-LLM-* headers on success", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ days: [], summary: "ok" }), {
        status: 200,
        headers: { "X-LLM-Provider": "gemini", "X-LLM-Model": "gemini-3.6-flash", "X-LLM-Tier": "flash" },
      }),
    );
    vi.stubGlobal("fetch", fakeFetch);

    const result = await generateStudyPlan("http://localhost:8000", payload);

    expect(result.data.summary).toBe("ok");
    expect(result.llm).toMatchObject({ provider: "gemini", model: "gemini-3.6-flash", tier: "flash" });
    expect(fakeFetch).toHaveBeenCalledWith(
      "http://localhost:8000/generate-study-plan",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });

  it("throws an ApiError with the extracted message on a 422", async () => {
    const fakeFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ msg: "List should have at least 1 item", loc: ["body", "subjects"] }] }), {
        status: 422,
      }),
    );
    vi.stubGlobal("fetch", fakeFetch);

    await expect(generateStudyPlan("http://localhost:8000", payload)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("List should have at least 1 item"),
    });
    vi.unstubAllGlobals();
  });

  it("throws a network ApiError when fetch itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const err = await generateStudyPlan("http://localhost:8000", payload).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toContain("Couldn't reach");
    vi.unstubAllGlobals();
  });
});
