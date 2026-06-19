"use client";

import { Icon } from "../../../app/lib/material-icon";
import { cn } from "../../../lib/utils";

export type DatePickerTriggerProps = {
  valueLabel: string;
  placeholder: string;
  showingPlaceholder: boolean;
  variant: "form" | "filter";
  open: boolean;
  disabled?: boolean;
  error?: boolean;
  ariaLabel?: string;
  onClick: () => void;
  className?: string;
};

/** DatePicker field trigger — Figma DatePicker suffix + value row. */
export function DatePickerTrigger({
  valueLabel,
  placeholder,
  showingPlaceholder,
  variant,
  open,
  disabled,
  error,
  ariaLabel,
  onClick,
  className,
}: DatePickerTriggerProps) {
  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        "pds-type-body-m-medium pds-date-picker__trigger",
        `pds-date-picker__trigger--${variant}`,
        open && "pds-date-picker__trigger--focus",
        error && "pds-date-picker__trigger--error",
        disabled && "pds-date-picker__trigger--disabled",
        className
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "pds-date-picker__value",
          showingPlaceholder && "pds-date-picker__value--placeholder"
        )}
      >
        {showingPlaceholder ? placeholder : valueLabel}
      </span>
      <Icon name="calendar_month" size={20} className="pds-date-picker__icon" />
    </button>
  );
}
