"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../lib/utils";
import { computeDatePickerPlacement, type DatePickerPlacement } from "../date-picker-placement";
import {
  getFloatingPortalTarget,
  PDS_Z_POPOVER,
  type FloatingPortalTarget,
} from "../floating-portal";

function toPortalCoordinates(
  placement: DatePickerPlacement,
  portal: FloatingPortalTarget
): { top: number; left: number } {
  if (portal.mode === "fixed") {
    return { top: placement.top, left: placement.left };
  }

  const containerRect = portal.element.getBoundingClientRect();
  return {
    top: placement.top - containerRect.top,
    left: placement.left - containerRect.left,
  };
}

export type DatePickerPositionProps = {
  open?: boolean;
  /** Anchor element (typically the picker root wrapping the trigger). */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Assigned to the fixed portal wrapper (for outside-click detection). */
  containerRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
  className?: string;
  panelClassName?: string;
};

/** Positions the calendar panel below/above the trigger, clamped to the viewport. */
export function DatePickerPosition({
  open = true,
  anchorRef,
  containerRef,
  children,
  className,
  panelClassName,
}: DatePickerPositionProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [layout, setLayout] = React.useState<{
    placement: DatePickerPlacement;
    portal: FloatingPortalTarget;
    coords: { top: number; left: number };
  } | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!open) {
      setLayout(null);
      return;
    }

    const measure = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const portal = getFloatingPortalTarget(anchor);
      const panelRect = panel.getBoundingClientRect();
      const width = panelRect.width || panel.offsetWidth;
      const height = panelRect.height || panel.offsetHeight;
      if (width <= 0 || height <= 0) return;

      const placement = computeDatePickerPlacement(anchor.getBoundingClientRect(), width, height);
      setLayout({
        placement,
        portal,
        coords: toPortalCoordinates(placement, portal),
      });
    };

    measure();
    const raf = window.requestAnimationFrame(measure);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    const panel = panelRef.current;
    const anchor = anchorRef.current;
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (panel) observer?.observe(panel);
    if (anchor) observer?.observe(anchor);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      observer?.disconnect();
    };
  }, [anchorRef, open, panelClassName, children]);

  if (!open || !mounted) return null;

  const portal = getFloatingPortalTarget(anchorRef.current);
  const isReady = layout !== null;
  const positionMode = layout?.portal.mode ?? portal.mode;

  return createPortal(
    <div
      ref={containerRef}
      className={cn(
        "pds-date-picker-position",
        "pds-date-picker-position--fixed",
        positionMode === "absolute" && "pds-date-picker-position--in-modal",
        isReady && `pds-date-picker-position--${layout.placement.horizontal}`,
        isReady && `pds-date-picker-position--${layout.placement.vertical}`,
        className
      )}
      style={
        isReady
          ? {
              position: positionMode,
              top: layout.coords.top,
              left: layout.coords.left,
              maxWidth: layout.placement.maxWidth,
              zIndex: PDS_Z_POPOVER,
              pointerEvents: "auto",
            }
          : {
              position: positionMode,
              top: 0,
              left: 0,
              opacity: 0,
              pointerEvents: "none",
              zIndex: PDS_Z_POPOVER,
            }
      }
      data-align={layout?.placement.horizontal}
      data-vertical={layout?.placement.vertical}
    >
      <div
        ref={panelRef}
        className={cn(
          "pds-date-picker-position__panel",
          "pds-date-picker-position__panel--constrained",
          panelClassName
        )}
        style={
          isReady
            ? {
                maxHeight: layout.placement.maxHeight,
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>,
    portal.element
  );
}
