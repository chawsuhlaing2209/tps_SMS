"use client";

import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";
import type { PdsGradeLetter } from "../palettes";

export type GradeChipProps = {
  grade: PdsGradeLetter | string;
  children?: ReactNode;
  className?: string;
};

/**
 * Grade letter chip — tinted background + saturated matching text (A–F).
 */
export function GradeChip({ grade, children, className }: GradeChipProps) {
  const letter = grade.toString().charAt(0).toUpperCase();
  const tone = ["A", "B", "C", "D", "E", "F"].includes(letter)
    ? letter.toLowerCase()
    : "neutral";

  return (
    <span
      className={cn(
        "pds-type-body-s-bold pds-grade-chip",
        `pds-grade-chip--${tone}`,
        className,
      )}
    >
      {children ?? letter}
    </span>
  );
}

export function GradeChipGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("pds-grade-chip-group", className)}>{children}</div>;
}
