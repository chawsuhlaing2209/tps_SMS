"use client";

import { cn } from "../../../lib/utils";

export type DateCalendarShortcutButtonProps = {
  label: string;
  selected?: boolean;
  onClick?: () => void;
};

/** Preset shortcut pill in the filter range calendar (Figma 67:14509). */
export function DateCalendarShortcutButton({
  label,
  selected = false,
  onClick,
}: DateCalendarShortcutButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "pds-type-body-s-semibold pds-date-calendar-shortcut",
        selected && "pds-date-calendar-shortcut--selected"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
