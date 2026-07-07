"use client";

import type { ReactNode } from "react";
import { Icon } from "../../app/lib/material-icon";
import { cn } from "../../lib/utils";

export type OptionChipProps = {
  selected?: boolean;
  disabled?: boolean;
  label: ReactNode;
  detail?: ReactNode;
  onClick?: () => void;
  className?: string;
  /**
   * `checkbox` (default) — multi-select: shows a checked indicator.
   * `none` — single-select: radio-like pill highlight only.
   * See docs/COMPONENTS.md (job 4).
   */
  indicator?: "checkbox" | "none";
};

/** Canonical selectable chip for form inputs — see docs/COMPONENTS.md (job 4). */
export function OptionChip({
  selected,
  disabled,
  label,
  detail,
  onClick,
  className,
  indicator = "checkbox"
}: OptionChipProps) {
  return (
    <button
      type="button"
      className={cn("option-chip", selected && "option-chip--selected", className)}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      {indicator === "checkbox" ? (
        <span className="option-chip__indicator" aria-hidden>
          <Icon
            name={selected ? "check_box" : "check_box_outline_blank"}
            filled={selected}
            size={16}
          />
        </span>
      ) : null}
      <span className="pds-type-body-m-medium option-chip__label">{label}</span>
      {detail ? <span className="pds-type-body-m-medium option-chip__detail">{detail}</span> : null}
    </button>
  );
}

export function OptionChipGrid({
  children,
  className,
  layout = "grid"
}: {
  children: ReactNode;
  className?: string;
  /**
   * `grid` (default) — two-column card grid for chips with details.
   * `wrap` — wrapping pill row for compact label-only chips (grade/classroom pickers).
   */
  layout?: "grid" | "wrap";
}) {
  return (
    <div className={cn("option-chip-grid", layout === "wrap" && "option-chip-grid--wrap", className)}>
      {children}
    </div>
  );
}
