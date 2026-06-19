/** Shared demo data for stories and tests. */

export const DEMO_OPTIONS = [
  { id: "a", label: "Label" },
  { id: "b", label: "Label" },
  { id: "c", label: "Label" },
];

/** Assert a rendered element uses an expected design token via computed style. */
export function expectTokenStyle(
  element: Element,
  property: keyof CSSStyleDeclaration,
  tokenVar: string
) {
  const { expect } = require("vitest") as typeof import("vitest");
  const styles = getComputedStyle(element);
  const value = styles[property];
  const probe = document.createElement("div");
  probe.style.setProperty("background", `var(${tokenVar})`);
  document.body.appendChild(probe);
  const expected = getComputedStyle(probe).backgroundColor;
  document.body.removeChild(probe);
  expect(value).toBe(expected);
}
