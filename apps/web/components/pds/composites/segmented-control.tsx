"use client";

import { type MouseEvent } from "react";
import { Icon } from "../../../app/lib/material-icon";
import {
  findScrollContainer,
  getScrollTop,
  restoreScrollAfterPaint,
} from "../../../app/lib/segmented-scroll";
import { cn } from "../../../lib/utils";

export type SegmentedControlOption = {
  id: string;
  label: string;
  icon?: string;
};

export type SegmentedControlProps = {
  options: SegmentedControlOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
  /** Remember and restore scroll per segment when switching (default true). */
  preserveScroll?: boolean;
};

/** Mutually exclusive segmented toggle — primary pill on active option (Figma 67:13138). */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  preserveScroll = true,
}: SegmentedControlProps) {
  function handleSelect(optionId: string, event: MouseEvent<HTMLButtonElement>) {
    if (optionId === value) {
      return;
    }

    const button = event.currentTarget;

    if (preserveScroll) {
      // Keep the viewport where it is across the content swap so the tab bar
      // stays in view — don't jump to the top (or a per-tab remembered spot).
      const container = findScrollContainer(button);
      const current = getScrollTop(container);
      onChange(optionId);
      button.focus({ preventScroll: true });
      restoreScrollAfterPaint(container, current);
      return;
    }

    onChange(optionId);
    button.focus({ preventScroll: true });
  }

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
            onClick={(event) => handleSelect(option.id, event)}
          >
            {option.icon ? <Icon name={option.icon} size={18} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
