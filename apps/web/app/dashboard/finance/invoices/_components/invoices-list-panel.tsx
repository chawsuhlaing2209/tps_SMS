"use client";

import { useTranslations } from "next-intl";
import { formatMMK } from "../../../../lib/money";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApiQuery } from "../../../../lib/api";
import { useDashPageTitleActionsTarget } from "../../../dashboard-page-title";
import { fetchAllPaginated } from "../../../../lib/export-csv";
import { getSession } from "../../../../lib/session";
import { DirectoryMemberCell } from "../../../../lib/data-table";
import { Icon } from "../../../../lib/material-icon";
import { PaginationControls } from "../../../../lib/pagination-controls";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { Badge, type BadgeTone } from "../../../../../components/shared/badge";
import { FinanceTableShell } from "../../finance-table-shell";
import { appendIssueDateRangeParams, formatBillingMonth, formatCreatedAt } from "../../format-finance";
import { PadaukSortHeader, usePadaukSort } from "../../table-sort";
import {
  PdsSearchBar,
  PdsSearchFiltersRow,
  PdsSelectField,
} from "../../../../../components/pds";
import { ExportCsvButton } from "../../../../../components/shared/export-csv-button";
import { InvoicesIssueDateRangeFilter, useInvoicesActionsContext } from "./invoices-actions-provider";

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

type StatusFilter = "all" | "paid" | "partial" | "due" | "overdue";
type SourceFilter = "all" | InvoiceSource;

const STATUS_FILTER_OPTIONS: StatusFilter[] = ["all", "paid", "partial", "due", "overdue"];
const PAGE_SIZE = 50;

const STATUS_TONES: Record<string, BadgeTone> = {
  paid: "success",
  partial: "warning",
  unpaid: "info",
  overdue: "danger"
};

function fullNumber(value: number): string {
  return formatMMK(value);
}

function formatDueDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

const INVOICES_PATH = (tenant: string) => `/tenants/${tenant}/finance/invoices`;

function buildExportQuery(input: {
  academicYearId: string;
  status: StatusFilter;
  source: SourceFilter;
  search: string;
  sortKey: string;
  sortDir: string;
  issueDateRange: string;
  limit: number;
  offset: number;
}) {
  const params = new URLSearchParams({
    limit: String(input.limit),
    offset: String(input.offset),
    sortBy: input.sortKey,
    sortDir: input.sortDir
  });
  if (input.academicYearId) params.set("academicYearId", input.academicYearId);
  if (input.status !== "all") params.set("status", input.status);
  if (input.source !== "all") params.set("source", input.source);
  if (input.search.trim()) params.set("search", input.search.trim());
  appendIssueDateRangeParams(params, input.issueDateRange);
  return `?${params.toString()}`;
}

export function InvoicesListExportPortal({
  academicYearId,
  status,
  source,
  searchDebounced,
  sortKey,
  sortDir,
  loading
}: {
  academicYearId: string;
  status: StatusFilter;
  source: SourceFilter;
  searchDebounced: string;
  sortKey: string;
  sortDir: string;
  loading: boolean;
}) {
  const t = useTranslations("finance.invoiceList");
  const tFinance = useTranslations("finance");
  const tFees = useTranslations("finance.feesBilling");
  const { issueDateRange } = useInvoicesActionsContext();
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <ExportCsvButton
      disabled={loading || !academicYearId}
      onExport={async () => {
        const tenantId = getSession()?.tenantId;
        if (!tenantId) {
          throw new Error("Not signed in.");
        }
        const rows = await fetchAllPaginated<InvoiceRow>(
          (limit, offset) =>
            `${INVOICES_PATH(tenantId)}${buildExportQuery({
              academicYearId,
              status,
              source,
              search: searchDebounced,
              sortKey,
              sortDir,
              issueDateRange,
              limit,
              offset
            })}`,
          (json) => {
            const payload = json as InvoiceList;
            return { rows: payload.data, total: payload.total };
          }
        );
        return {
          filename: "invoices.csv",
          columns: [
            { key: "invoiceNumber", header: t("invoice") },
            { key: "createdAt", header: t("created") },
            { key: "billingMonth", header: tFinance("billingMonth") },
            { key: "source", header: tFinance("source") },
            { key: "student", header: tFees("student") },
            { key: "gradeRoom", header: tFees("grade") },
            { key: "total", header: tFees("billed") },
            { key: "balanceDue", header: t("balanceDue") },
            { key: "status", header: tFees("status") }
          ],
          rows: rows.map((row) => ({
            invoiceNumber: row.invoiceNumber,
            createdAt: row.createdAt,
            billingMonth: row.billingMonth ?? "",
            source: row.source,
            student: row.studentFullName ?? "",
            gradeRoom: [row.gradeName, row.classroomName].filter(Boolean).join(" · "),
            total: row.total,
            balanceDue: row.balanceDue,
            status: row.status
          }))
        };
      }}
    />,
    target
  );
}

export function InvoicesListPanel() {
  const t = useTranslations("finance.invoiceList");
  const tFees = useTranslations("finance.feesBilling");
  const tFinance = useTranslations("finance");

  const currentYear = useCurrentAcademicYear();
  const academicYearId = currentYear.data?.id ?? "";

  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(0);
  const { issueDateRange } = useInvoicesActionsContext();
  const { sortKey, sortDir, toggleSort } = usePadaukSort({
    defaultKey: "createdAt",
    defaultDir: "desc"
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [issueDateRange]);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE)
    });
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("source", source);
    if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
    appendIssueDateRangeParams(params, issueDateRange);
    params.set("sortBy", sortKey);
    params.set("sortDir", sortDir);
    return `?${params.toString()}`;
  }, [academicYearId, issueDateRange, page, searchDebounced, sortDir, sortKey, source, status]);

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
      <InvoicesListExportPortal
        academicYearId={academicYearId}
        status={status}
        source={source}
        searchDebounced={searchDebounced}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={currentYear.isLoading || invoices.isLoading}
      />
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
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={source}
                onValueChange={(value) => {
                  setSource((typeof value === "string" ? value : "all") as SourceFilter);
                  setPage(0);
                }}
                placeholder={tFinance("allSources")}
                options={[
                  { value: "all", label: tFinance("allSources") },
                  { value: "enrollment", label: tFinance("sourceEnrollment") },
                  { value: "recurring", label: tFinance("sourceRecurring") },
                  { value: "ad_hoc", label: tFinance("sourceOther") },
                ]}
              />
            </div>
            <div className="pds-search-filters-row__filter--range">
              <InvoicesIssueDateRangeFilter />
            </div>
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={status}
                onValueChange={(value) => {
                  setStatus((typeof value === "string" ? value : "all") as StatusFilter);
                  setPage(0);
                }}
                placeholder={tFees("statusFilters.all")}
                options={STATUS_FILTER_OPTIONS.map((value) => ({
                  value,
                  label: tFees(`statusFilters.${value}`),
                }))}
              />
            </div>
          </>
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
