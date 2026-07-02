"use client";

import { useCallback, useEffect, useRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

/**
 * Horizontal-scroll container for `.padauk-table`. Sets `data-pin-overlay="true"`
 * while more columns remain to the right, so the pinned actions column only
 * renders its floating shadow mid-scroll and sits flush at scroll-end (and on
 * tables that don't overflow at all).
 */
export function PadaukTableWrap({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement | null>(null);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const overlay = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    const next = overlay ? "true" : "false";
    if (el.dataset.pinOverlay !== next) {
      el.dataset.pinOverlay = next;
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild);
    }
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update]);

  return (
    <div ref={ref} className={cn("padauk-table-wrap", className)} {...props}>
      {children}
    </div>
  );
}
