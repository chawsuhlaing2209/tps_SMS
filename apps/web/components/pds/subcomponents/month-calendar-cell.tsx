"use client";

import { cn } from "../../../lib/utils";

export type MonthCalendarCellProps = {
  label: string;
  selected?: boolean;
  current?: boolean;
  onSelect: () => void;
};

/** Single month pill in the month grid — Figma 67:13837. */
export function MonthCalendarCell({ label, selected, current, onSelect }: MonthCalendarCellProps) {
  return (
    <button
      type="button"
      className={cn(
        "pds-type-body-s-regular pds-month-calendar-cell",
        selected && "pds-month-calendar-cell--selected",
        current && !selected && "pds-month-calendar-cell--current"
      )}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}
