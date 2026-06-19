import * as React from "react";
import { cn } from "../../../lib/utils";

export type DividerSize = "sm" | "md" | "lg" | "xl";

export type DividerProps = {
  /** Figma: dashed */
  dashed?: boolean;
  /** Figma: hasPadding */
  hasPadding?: boolean;
  /** Figma: size */
  size?: DividerSize;
  className?: string;
  decorative?: boolean;
};

/** Horizontal rule — Figma node 35:14443. */
export function Divider({
  dashed = false,
  hasPadding = false,
  size = "sm",
  className,
  decorative = true,
}: DividerProps) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation="horizontal"
      className={cn(
        "pds-divider",
        `pds-divider--size-${size}`,
        dashed && "pds-divider--dashed",
        hasPadding && "pds-divider--padded",
        className
      )}
      data-figma-node="35:14443"
    >
      <span className="pds-divider__line" />
    </div>
  );
}
