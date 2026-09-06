import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRecognize = vi.fn();
const mockCreateWorker = vi.fn().mockResolvedValue({ recognize: mockRecognize });

vi.mock("tesseract.js", () => ({
  createWorker: (...args) => mockCreateWorker(...args),
}));

beforeEach(() => {
  vi.resetModules();
  mockCreateWorker.mockClear();
  mockRecognize.mockReset();
});

describe("ocrCanvas", () => {
  it("returns the trimmed recognized text", async () => {
    mockRecognize.mockResolvedValue({ data: { text: "  Recovered text.  \n" } });
    const { ocrCanvas } = await import("./ocr");

    const result = await ocrCanvas(document.createElement("canvas"));

    expect(result).toBe("Recovered text.");
    expect(mockCreateWorker).toHaveBeenCalledWith("eng");
  });

  it("reuses the same worker across multiple pages instead of creating one per call", async () => {
    mockRecognize.mockResolvedValue({ data: { text: "text" } });
    const { ocrCanvas } = await import("./ocr");

    await ocrCanvas(document.createElement("canvas"));
    await ocrCanvas(document.createElement("canvas"));

    expect(mockCreateWorker).toHaveBeenCalledTimes(1);
    expect(mockRecognize).toHaveBeenCalledTimes(2);
  });

  it("is not hardcoded to English — an explicit language code is honored", async () => {
    mockRecognize.mockResolvedValue({ data: { text: "text" } });
    const { ocrCanvas } = await import("./ocr");

    await ocrCanvas(document.createElement("canvas"), "hin");

    expect(mockCreateWorker).toHaveBeenCalledWith("hin");
  });

  it("uses a separate cached worker per language", async () => {
    mockRecognize.mockResolvedValue({ data: { text: "text" } });
    const { ocrCanvas } = await import("./ocr");

    await ocrCanvas(document.createElement("canvas"), "eng");
    await ocrCanvas(document.createElement("canvas"), "hin");
    await ocrCanvas(document.createElement("canvas"), "eng");

    expect(mockCreateWorker).toHaveBeenCalledTimes(2);
    expect(mockCreateWorker).toHaveBeenCalledWith("eng");
    expect(mockCreateWorker).toHaveBeenCalledWith("hin");
  });
});
