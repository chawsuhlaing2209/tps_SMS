/** Run work after the browser is idle so navigation and paint stay responsive. */
export function runWhenIdle(work: () => void, timeoutMs = 2_000) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(work, { timeout: timeoutMs });
    return;
  }
  setTimeout(work, 0);
}
