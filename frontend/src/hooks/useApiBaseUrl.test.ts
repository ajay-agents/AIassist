import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useApiBaseUrl } from "./useApiBaseUrl";

describe("useApiBaseUrl", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to localhost:8000 when nothing is stored", () => {
    const { result } = renderHook(() => useApiBaseUrl());
    expect(result.current[0]).toBe("http://localhost:8000");
  });

  it("strips a trailing slash", () => {
    localStorage.setItem("study-desk:api-base-url", "http://localhost:9000/");
    const { result } = renderHook(() => useApiBaseUrl());
    expect(result.current[0]).toBe("http://localhost:9000");
  });

  it("persists updates to localStorage", () => {
    const { result } = renderHook(() => useApiBaseUrl());
    act(() => result.current[1]("http://example.com:8010"));
    expect(localStorage.getItem("study-desk:api-base-url")).toBe("http://example.com:8010");
  });
});
