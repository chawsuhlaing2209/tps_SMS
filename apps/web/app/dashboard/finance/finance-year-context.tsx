"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { PdsSelectField } from "../../../components/pds";
import { useReferenceApiQuery } from "../../lib/api";
import { DASH_PAGE_TITLE_ACTIONS_ID } from "../dashboard-page-title";
import { useResolvedPageHeader } from "../page-header-context";

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

/**
 * Module-wide year filter. Rendered into the page-title actions row (next to
 * Export CSV etc.) so it sits at the top of every finance page; falls back to
 * its own right-aligned row on pages without a title actions area.
 */
/** Finance list routes that get the year filter. Detail/form pages (an invoice
 *  belongs to exactly one year) deliberately don't show it. */
const YEAR_BAR_ROUTES = new Set([
  "/dashboard/finance/overview",
  "/dashboard/finance/billing",
  "/dashboard/finance/invoices",
  "/dashboard/finance/payments",
  "/dashboard/finance/fee-structures",
  "/dashboard/finance/discounts"
]);

export function FinanceYearBar() {
  const t = useTranslations("finance");
  const { selection, setSelection, years, yearsLoading } = useFinanceYear();
  const pathname = usePathname();
  const { actions, actionsPortal } = useResolvedPageHeader();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setTarget(document.getElementById(DASH_PAGE_TITLE_ACTIONS_ID));
  }, [pathname, actions, actionsPortal]);

  if (!YEAR_BAR_ROUTES.has(pathname)) {
    return null;
  }

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

  const field = (
    <div className="finance-year-filter">
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

  if (target) {
    return createPortal(field, target);
  }

  return <div className="finance-year-bar">{field}</div>;
}
