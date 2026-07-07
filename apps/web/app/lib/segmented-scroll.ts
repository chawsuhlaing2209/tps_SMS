/** Scroll container helpers for SegmentedControl tab/filter switches. */

export function findScrollContainer(from: HTMLElement | null): HTMLElement | Window {
  if (!from) {
    return window;
  }

  let node: HTMLElement | null = from.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }

  return window;
}

export function getScrollTop(container: HTMLElement | Window): number {
  if (container === window) {
    return window.scrollY;
  }
  return (container as HTMLElement).scrollTop;
}

export function setScrollTop(container: HTMLElement | Window, top: number): void {
  if (container === window) {
    window.scrollTo({ top, left: 0, behavior: "auto" });
    return;
  }
  (container as HTMLElement).scrollTop = top;
}

/** Run after React has painted following a segment switch. */
export function restoreScrollAfterPaint(
  container: HTMLElement | Window,
  top: number
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setScrollTop(container, top);
    });
  });
}
