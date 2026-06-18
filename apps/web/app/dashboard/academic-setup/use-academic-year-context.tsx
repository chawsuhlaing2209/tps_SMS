"use client";

import type { CurrentAcademicYear } from "../../lib/use-current-academic-year";

export function useAcademicYearContext(currentYear: CurrentAcademicYear | null | undefined) {
  const contextYearId = currentYear?.id ?? "";
  const workingYear = currentYear ?? null;
  const openYears = currentYear ? [currentYear] : [];

  return { workingYear, contextYearId, openYears };
}
