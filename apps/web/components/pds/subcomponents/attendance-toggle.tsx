"use client";

import type { ReactNode } from "react";
import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";
import { ATTENDANCE_ICONS, type PdsAttendanceState } from "../palettes";

export type AttendanceToggleProps = {
  state: PdsAttendanceState;
  label: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Large attendance choice button — present, late, absent with leading status icon. */
export function AttendanceToggle({
  state,
  label,
  selected,
  disabled,
  onClick,
  className,
}: AttendanceToggleProps) {
  return (
    <button
      type="button"
      className={cn(
        "pds-attendance-toggle",
        `pds-attendance-toggle--${state}`,
        selected && "pds-attendance-toggle--selected",
        className,
      )}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="pds-attendance-toggle__icon" aria-hidden>
        <Icon name={ATTENDANCE_ICONS[state]} filled size={16} />
      </span>
      <span className="pds-type-body-m-bold pds-attendance-toggle__label">{label}</span>
    </button>
  );
}

export function AttendanceToggleGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("pds-attendance-toggle-group", className)}>{children}</div>;
}
