import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "./app/globals.css";

// jsdom does not implement ResizeObserver, which PDS components (e.g. the
// options panel in composites/options.tsx) rely on to size themselves. Provide
// a no-op polyfill so those components mount in the test environment.
if (typeof globalThis.ResizeObserver === "undefined") {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
}

// jsdom reports all layout boxes as 0×0. Portaled PDS panels (e.g. the select
// options panel) only become interactive once they measure a non-zero anchor,
// so give every element a positive offset size in tests.
for (const prop of ["offsetWidth", "offsetHeight"] as const) {
  Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 100 });
}

afterEach(() => {
  cleanup();
});
