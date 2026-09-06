import "@testing-library/jest-dom/vitest";

// pdfjs-dist constructs a DOMMatrix at module load time, which jsdom doesn't
// provide. Tests never exercise real matrix math (pdfjs-dist itself is
// mocked wherever PDF parsing behavior matters) — this stub just lets the
// module import without crashing in any test that renders a component
// which pulls it in transitively.
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {};
}
