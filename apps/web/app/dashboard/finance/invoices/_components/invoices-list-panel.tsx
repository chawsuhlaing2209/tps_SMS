"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApiQuery } from "../../../../lib/api";
import { DirectoryMemberCell } from "../../../../lib/data-table";
import { Icon } from "../../../../lib/material-icon";
import { PaginationControls } from "../../../../lib/pagination-controls";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { Badge, type BadgeTone } from "../../../../../components/shared/badge";
import { FinanceTableShell } from "../../finance-table-shell";
import { formatBillingMonth, formatCreatedAt } from "../../format-finance";
import { PadaukSortHeader, usePadaukSort } from "../../table-sort";
import {
  PdsSearchBar,
  PdsSearchFiltersRow,
  PdsSelectField,
  SegmentedControl,
} from "../../../../../components/pds";
import { InvoicesBillingMonthFilter } from "./invoices-actions-provider";

type InvoiceSource = "enrollment" | "recurring" | "ad_hoc";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentFullName: string | null;
  gradeName: string | null;
  classroomName: string | null;
  total: string;
  balanceDue: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
  billingMonth: string | null;
  paymentPlan: "enrollment" | "monthly" | "one_off";
  source: InvoiceSource;
};

type InvoiceList = { data: InvoiceRow[]; total: number; limit: number; offset: number };

type StatusFilter = "" | "paid" | "partial" | "due" | "overdue";

const STATUS_FILTERS: StatusFilter[] = ["", "paid", "partial", "due", "overdue"];
const PAGE_SIZE = 50;

const STATUS_TONES: Record<string, BadgeTone> = {
  paid: "success",
  partial: "warning",
  unpaid: "info",
  overdue: "danger"
};

function fullNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatDueDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function InvoicesListPanel() {
  const t = useTranslations("finance.invoiceList");
  const tFees = useTranslations("finance.feesBilling");
  const tFinance = useTranslations("finance");

  const currentYear = useCurrentAcademicYear();
  const academicYearId = currentYear.data?.id ?? "";

  const [status, setStatus] = useState<StatusFilter>("");
  const [source, setSource] = useState<InvoiceSource | "">("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(0);
  const { sortKey, sortDir, toggleSort } = usePadaukSort({
    defaultKey: "createdAt",
    defaultDir: "desc"
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE)
    });
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
    params.set("sortBy", sortKey);
    params.set("sortDir", sortDir);
    return `?${params.toString()}`;
  }, [academicYearId, page, searchDebounced, sortDir, sortKey, source, status]);

  const invoices = useApiQuery<InvoiceList>((tenant) =>
    academicYearId ? `/tenants/${tenant}/finance/invoices${listQuery}` : null
  );

  const rows = invoices.data?.data ?? [];

  const statusLabel = (value: string) => {
    if (value === "unpaid") return tFees("statusLabels.due");
    if (value === "paid") return tFees("statusLabels.paid");
    if (value === "partial") return tFees("statusLabels.partial");
    if (value === "overdue") return tFees("statusLabels.overdue");
    return value;
  };

  const sourceLabel = (value: InvoiceSource) => {
    if (value === "enrollment") return tFinance("sourceEnrollment");
    if (value === "recurring") return tFinance("sourceRecurring");
    return tFinance("sourceOther");
  };

  const refetchAll = () => {
    void invoices.refetch();
  };

  return (
    <>
      <p className="pds-type-body-s-regular muted panel-help">{tFees("invoicesViewHelp")}</p>

      <PdsSearchFiltersRow
        filters={
          <>
            <PdsSearchBar
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
            />
            <PdsSelectField
              className="pds-search-filters-row__filter--160"
              variant="filter"
              value={source}
              onValueChange={(value) => {
                setSource((typeof value === "string" ? value : "") as InvoiceSource | "");
                setPage(0);
              }}
              placeholder={tFinance("allSources")}
              options={[
                { value: "enrollment", label: tFinance("sourceEnrollment") },
                { value: "recurring", label: tFinance("sourceRecurring") },
                { value: "ad_hoc", label: tFinance("sourceOther") },
              ]}
            />
            <div className="pds-search-filters-row__filter--160">
              <InvoicesBillingMonthFilter />
            </div>
          </>
        }
        statusControl={
          <SegmentedControl
            ariaLabel={tFees("status")}
            value={status}
            onChange={(next) => {
              setStatus(next as StatusFilter);
              setPage(0);
            }}
            options={STATUS_FILTERS.map((value) => ({
              id: value,
              label: value ? tFees(`statusFilters.${value}`) : tFees("statusFilters.all"),
            }))}
          />
        }
      />

      <FinanceTableShell
        loading={currentYear.isLoading || invoices.isLoading}
        error={invoices.isError}
        empty={!rows.length}
        emptyMessage={t("empty")}
      >
        <div className="padauk-table-wrap">
          <table className="pds-type-body-m-medium padauk-table">
            <thead>
              <tr>
                <th className="pds-type-caption-s">{t("invoice")}</th>
                <th className="pds-type-caption-s">
                  <PadaukSortHeader
                    label={t("created")}
                    active={sortKey === "createdAt"}
                    direction={sortDir}
                    onClick={() => {
                      toggleSort("createdAt");
                      setPage(0);
                    }}
                  />
                </th>
                <th className="pds-type-caption-s">{tFinance("billingMonth")}</th>
                <th className="pds-type-caption-s">{tFinance("source")}</th>
                <th className="pds-type-caption-s">{tFees("student")}</th>
                <th className="pds-type-caption-s padauk-table__num">{tFees("billed")}</th>
                <th className="pds-type-caption-s padauk-table__num">{t("balanceDue")}</th>
                <th className="pds-type-caption-s">{tFees("status")}</th>
                <th className="pds-type-caption-s padauk-table__actions">{tFees("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dueLabel = formatDueDate(row.dueDate);
                const gradeRoom = [row.gradeName, row.classroomName].filter(Boolean).join(" · ");
                return (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/dashboard/finance/invoices/${row.id}`}
                        className="padauk-table__link"
                      >
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className="padauk-table__muted">{formatCreatedAt(row.createdAt)}</td>
                    <td>{formatBillingMonth(row.billingMonth)}</td>
                    <td>{sourceLabel(row.source)}</td>
                    <td>
                      <DirectoryMemberCell
                        name={row.studentFullName ?? "—"}
                        subtitle={gradeRoom || "—"}
                        colorKey={row.studentId}
                      />
                    </td>
                    <td className="padauk-table__num">{fullNumber(Number(row.total))}</td>
                    <td className="padauk-table__num">
                      <div className="pds-type-body-s-regular padauk-table__stack">
                        <strong>{fullNumber(row.balanceDue)}</strong>
                        {dueLabel ? <span>{dueLabel}</span> : null}
                      </div>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONES[row.status] ?? "neutral"}>
                        {statusLabel(row.status)}
                      </Badge>
                    </td>
                    <td className="padauk-table__actions">
                      <Link
                        href={`/dashboard/finance/invoices/${row.id}`}
                        className="pds-type-body-s-semibold table-row-action"
                      >
                        <Icon name="visibility" size={16} />
                        {t("view")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FinanceTableShell>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={invoices.data?.total ?? 0}
        onPageChange={setPage}
      />
    </>
  );
}
