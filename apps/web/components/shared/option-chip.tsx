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
};

/** Selectable pill with leading indicator — fee components, payment plans, etc. */
export function OptionChip({
  selected,
  disabled,
  label,
  detail,
  onClick,
  className
}: OptionChipProps) {
  return (
    <button
      type="button"
      className={cn("option-chip", selected && "option-chip--selected", className)}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="option-chip__indicator" aria-hidden>
        {selected ? <Icon name="check" size={14} /> : null}
      </span>
      <span className="option-chip__label">{label}</span>
      {detail ? <span className="option-chip__detail">{detail}</span> : null}
    </button>
  );
}

export function OptionChipGrid({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("option-chip-grid", className)}>{children}</div>;
}
