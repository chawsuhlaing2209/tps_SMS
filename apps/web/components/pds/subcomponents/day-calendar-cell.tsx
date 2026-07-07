"use client";

import { cn } from "../../../lib/utils";

export type DayCalendarCellState =
  | "idle"
  | "muted"
  | "selected"
  | "range"
  | "range-start"
  | "range-end"
  | "today";

export type DayCalendarCellAccent = "lime" | "shell";

export type DayCalendarCellProps = {
  label: string;
  state?: DayCalendarCellState;
  accent?: DayCalendarCellAccent;
  onSelect?: () => void;
};

/** Single day cell in the day grid (Figma 67:14385). */
export function DayCalendarCell({
  label,
  state = "idle",
  accent = "lime",
  onSelect,
}: DayCalendarCellProps) {
  const interactive = Boolean(onSelect);

  return (
    <button
      type="button"
      disabled={!interactive}
      data-accent={accent}
      className={cn(
        "pds-type-body-m-medium pds-day-calendar-cell",
        state === "muted" && "pds-day-calendar-cell--muted",
        state === "selected" && "pds-day-calendar-cell--selected",
        state === "range" && "pds-day-calendar-cell--range",
        state === "range-start" && "pds-day-calendar-cell--range-start",
        state === "range-end" && "pds-day-calendar-cell--range-end",
        state === "today" && "pds-day-calendar-cell--today"
      )}
      onClick={onSelect}
    >
      <span className="pds-day-calendar-cell__label">{label}</span>
    </button>
  );
}
