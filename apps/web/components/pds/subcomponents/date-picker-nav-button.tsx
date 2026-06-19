"use client";

import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type DatePickerNavButtonProps = {
  direction: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
};

/** Circular prev/next control in the DatePicker calendar header. */
export function DatePickerNavButton({
  direction,
  onClick,
  disabled,
  ariaLabel,
}: DatePickerNavButtonProps) {
  return (
    <button
      type="button"
      className="pds-date-picker-nav"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <Icon name={direction === "prev" ? "keyboard_arrow_left" : "keyboard_arrow_right"} size={14} />
    </button>
  );
}
