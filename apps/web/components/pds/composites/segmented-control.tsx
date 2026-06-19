"use client";

import { cn } from "../../../lib/utils";

export type SegmentedControlOption = {
  id: string;
  label: string;
};

export type SegmentedControlProps = {
  options: SegmentedControlOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
};

/** Mutually exclusive segmented toggle — forest pill on active option. */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn("pds-segmented-control", className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "pds-type-body-m-bold pds-segmented-control__option",
              active && "pds-segmented-control__option--active",
            )}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
