"use client";

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import type { PdsSubjectColorKey } from "../palettes";

export type SubjectChipProps = {
  colorKey: PdsSubjectColorKey;
  children: ReactNode;
  className?: string;
};

/**
 * Categorical subject chip — solid color encoding for a subject or chart series.
 * Not for decoration; one color = one category.
 */
export function SubjectChip({ colorKey, children, className }: SubjectChipProps) {
  return (
    <span
      className={cn(
        "pds-type-body-s-bold pds-subject-chip",
        `pds-subject-chip--${colorKey}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SubjectChipGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("pds-subject-chip-group", className)}>{children}</div>;
}
