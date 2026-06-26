"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Options, type OptionsProps } from "./options";
import { cn } from "../../../lib/utils";
import {
  computeDatePickerPlacement,
  type DatePickerPlacement,
  type DatePickerVerticalAlign,
} from "../date-picker-placement";
import {
  getFloatingPortalTarget,
  PDS_Z_POPOVER,
  type FloatingPortalTarget,
} from "../floating-portal";

export type SelectItemPosition = "top" | "bottom";

export type SelectItemPositionProps = {
  position?: SelectItemPosition;
  open?: boolean;
  /** When set, the panel is portaled and positioned against the anchor. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Assigned to the fixed portal wrapper (for outside-click detection). */
  containerRef?: React.Ref<HTMLDivElement>;
  children?: React.ReactNode;
  optionsProps?: OptionsProps;
  /** Max height for the options panel (modal selects clamp to space above footer). */
  panelMaxHeight?: number;
  className?: string;
};

function preferredVerticalFor(position: SelectItemPosition): DatePickerVerticalAlign | "auto" {
  return position === "top" ? "top" : "auto";
}

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

/** Positions a panel above or below an anchor — Figma node 35:12288. */
export function SelectItemPosition({
  position = "bottom",
  open = true,
  anchorRef,
  containerRef,
  children,
  optionsProps,
  panelMaxHeight,
  className,
}: SelectItemPositionProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [layout, setLayout] = React.useState<{
    placement: DatePickerPlacement;
    anchorWidth: number;
    portal: FloatingPortalTarget;
    coords: { top: number; left: number };
  } | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!open || !anchorRef) {
      setLayout(null);
      return;
    }

    const measure = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const portal = getFloatingPortalTarget(anchor);
      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const anchorWidth = anchorRect.width || panelRect.width || panel.offsetWidth;
      const height = panelRect.height || panel.offsetHeight;
      if (anchorWidth <= 0 || height <= 0) return;

      const placement = computeDatePickerPlacement(
        anchorRect,
        anchorWidth,
        height,
        preferredVerticalFor(position)
      );

      setLayout({
        anchorWidth,
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
  }, [anchorRef, open, position, optionsProps, children]);

  if (!open) return null;

  const panelContent =
    children ?? (optionsProps ? <Options {...optionsProps} fillWidth /> : null);

  if (anchorRef) {
    if (!mounted) return null;

    const portal = getFloatingPortalTarget(anchorRef.current);
    const isReady = layout !== null;
    const positionMode = layout?.portal.mode ?? portal.mode;

    return createPortal(
      <div
        ref={containerRef}
        className={cn(
          "pds-select-item-position",
          "pds-select-item-position--fixed",
          positionMode === "absolute" && "pds-select-item-position--in-modal",
          isReady && `pds-select-item-position--${layout.placement.vertical}`,
          className
        )}
        style={
          isReady
            ? {
                position: positionMode,
                top: layout.coords.top,
                left: layout.coords.left,
                width: layout.anchorWidth,
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
        onMouseDown={(event) => event.preventDefault()}
        data-vertical={layout?.placement.vertical}
      >
        <div
          ref={panelRef}
          className="pds-select-item-position__panel pds-select-item-position__panel--constrained"
          style={
            isReady
              ? {
                  maxHeight: layout.placement.maxHeight,
                }
              : undefined
          }
        >
          {panelContent}
        </div>
      </div>,
      portal.element
    );
  }

  return (
    <div
      className={cn(
        "pds-select-item-position",
        position === "top" && "pds-select-item-position--top",
        position === "bottom" && "pds-select-item-position--bottom",
        className
      )}
      data-figma-node="35:12288"
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="pds-select-item-position__spacer" aria-hidden="true" />
      <div
        ref={panelRef}
        className={cn(
          "pds-select-item-position__panel",
          panelMaxHeight != null && "pds-select-item-position__panel--constrained"
        )}
        style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined}
      >
        {panelContent}
      </div>
    </div>
  );
}
