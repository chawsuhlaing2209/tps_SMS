"use client";

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import type { PdsSubjectColorKey } from "../palettes";

export type FilterTabProps = {
  label: ReactNode;
  count?: number | string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Filter tab with optional count pill — forest fill when active, count flips lime-on-forest. */
export function FilterTab({ label, count, active, disabled, onClick, className }: FilterTabProps) {
  return (
    <button
      type="button"
      className={cn(
        "pds-filter-tab",
        active && "pds-filter-tab--active",
        className,
      )}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="pds-type-body-m-bold pds-filter-tab__label">{label}</span>
      {count != null ? (
        <span className="pds-type-body-s-bold pds-filter-tab__count">{count}</span>
      ) : null}
    </button>
  );
}

export function FilterTabGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("pds-filter-tab-group", className)} role="tablist">{children}</div>;
}

export type SubjectTabProps = {
  label: ReactNode;
  colorKey: PdsSubjectColorKey;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Subject tab — at rest white/border; active uses categorical subject color fill. */
export function SubjectTab({ label, colorKey, active, disabled, onClick, className }: SubjectTabProps) {
  return (
    <button
      type="button"
      className={cn(
        "pds-subject-tab",
        `pds-subject-tab--${colorKey}`,
        active && "pds-subject-tab--active",
        className,
      )}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="pds-type-body-m-bold">{label}</span>
    </button>
  );
}

export function SubjectTabGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("pds-subject-tab-group", className)} role="tablist">{children}</div>;
}

export type DayPickerTabProps = {
  label: ReactNode;
  active?: boolean;
  /** Lime emphasis fill when active (e.g. "This term"). */
  emphasis?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

/** Day / period filter — forest when active; `emphasis` uses lime fill instead. */
export function DayPickerTab({
  label,
  active,
  emphasis,
  disabled,
  onClick,
  className,
}: DayPickerTabProps) {
  return (
    <button
      type="button"
      className={cn(
        "pds-day-picker-tab",
        active && "pds-day-picker-tab--active",
        emphasis && "pds-day-picker-tab--emphasis",
        className,
      )}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="pds-type-body-m-bold">{label}</span>
    </button>
  );
}

export function DayPickerGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("pds-day-picker-group", className)} role="tablist">{children}</div>;
}
