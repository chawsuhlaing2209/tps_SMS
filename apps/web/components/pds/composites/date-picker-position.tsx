"use client";

import * as React from "react";
import { cn } from "../../../lib/utils";

export type DatePickerPositionProps = {
  open?: boolean;
  children?: React.ReactNode;
  className?: string;
  panelClassName?: string;
};

/** Positions the calendar panel below the DatePicker trigger. */
export function DatePickerPosition({
  open = true,
  children,
  className,
  panelClassName,
}: DatePickerPositionProps) {
  if (!open) return null;

  return (
    <div className={cn("pds-date-picker-position", className)} data-figma-node="67:14915">
      <div className={cn("pds-date-picker-position__panel", panelClassName)}>{children}</div>
    </div>
  );
}
