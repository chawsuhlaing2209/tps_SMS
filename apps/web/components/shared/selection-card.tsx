"use client";

import type { ReactNode } from "react";
import { Icon } from "../../app/lib/material-icon";
import { cn } from "../../lib/utils";

export type SelectionCardProps = {
  selected?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  className?: string;
};

/** Horizontal option card: icon left, copy right, selected check bottom-right. */
export function SelectionCard({
  selected,
  disabled,
  icon,
  title,
  description,
  onClick,
  className
}: SelectionCardProps) {
  return (
    <button
      type="button"
      className={cn(
        "selection-card",
        selected && "selection-card--selected",
        disabled && "selection-card--disabled",
        className
      )}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="selection-card__icon" aria-hidden>
        {icon}
      </span>
      <span className="selection-card__body">
        <strong className="pds-type-body-l-medium selection-card__title">{title}</strong>
        <span className="pds-type-body-m-medium selection-card__desc">{description}</span>
      </span>
      {selected ? (
        <span className="selection-card__check" aria-hidden>
          <Icon name="check_box" filled size={16} />
        </span>
      ) : null}
    </button>
  );
}

export function SelectionCardGrid({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("selection-card-grid", className)}>{children}</div>;
}
