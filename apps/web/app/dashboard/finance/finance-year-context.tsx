"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { PdsSelectField } from "../../../components/pds";
import { useReferenceApiQuery } from "../../lib/api";

export const LIFETIME = "lifetime";

export type FinanceAcademicYear = {
  id: string;
  name: string;
  status: string;
  startsOn: string;
  endsOn: string;
};

type FinanceYearContextValue = {
  /** Academic year id, or "lifetime". */
  selection: string;
  setSelection: (value: string) => void;
  years: FinanceAcademicYear[];
  yearsLoading: boolean;
  /** Selected year id — empty string when Lifetime is chosen. */
  academicYearId: string;
  isLifetime: boolean;
  activeYearId: string;
};

const FinanceYearContext = createContext<FinanceYearContextValue | null>(null);

/** Module-wide academic year filter state for every finance page. */
export function FinanceYearProvider({ children }: { children: ReactNode }) {
  const years = useReferenceApiQuery<FinanceAcademicYear[]>(
    (tenant) => `/tenants/${tenant}/finance/academic-years`
  );
  const [picked, setPicked] = useState<string | null>(null);

  const value = useMemo<FinanceYearContextValue>(() => {
    const list = years.data ?? [];
    const activeYearId = list.find((year) => year.status === "active")?.id ?? "";
    const fallback = activeYearId || list[0]?.id || LIFETIME;
    const selection = picked ?? fallback;
    return {
      selection,
      setSelection: setPicked,
      years: list,
      yearsLoading: years.isLoading,
      academicYearId: selection === LIFETIME ? "" : selection,
      isLifetime: selection === LIFETIME,
      activeYearId
    };
  }, [picked, years.data, years.isLoading]);

  return <FinanceYearContext.Provider value={value}>{children}</FinanceYearContext.Provider>;
}

export function useFinanceYear(): FinanceYearContextValue {
  const ctx = useContext(FinanceYearContext);
  if (!ctx) {
    throw new Error("useFinanceYear must be used inside FinanceYearProvider");
  }
  return ctx;
}

/** Right-aligned year filter rendered at the top of every finance page. */
export function FinanceYearBar() {
  const t = useTranslations("finance");
  const { selection, setSelection, years, yearsLoading } = useFinanceYear();

  if (yearsLoading && years.length === 0) {
    return null;
  }

  const options = [
    ...years.map((year) => ({
      value: year.id,
      label:
        year.status === "active" ? t("yearFilterActive", { name: year.name }) : year.name
    })),
    { value: LIFETIME, label: t("yearFilterLifetime") }
  ];

  return (
    <div className="finance-year-bar">
      <PdsSelectField
        variant="filter"
        value={selection}
        onValueChange={(value) => {
          if (typeof value === "string" && value) setSelection(value);
        }}
        options={options}
      />
    </div>
  );
}
