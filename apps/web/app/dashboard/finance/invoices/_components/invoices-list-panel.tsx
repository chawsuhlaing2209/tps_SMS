"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApiQuery } from "../../../../lib/api";
import { useDashPageTitleActionsTarget } from "../../../dashboard-page-title";
import { fetchAllPaginated } from "../../../../lib/export-csv";
import { getSession } from "../../../../lib/session";
import { DirectoryMemberCell } from "../../../../lib/data-table";
import { Icon } from "../../../../lib/material-icon";
import { PadaukTableWrap } from "../../../../lib/padauk-table-wrap";
import { PaginationControls } from "../../../../lib/pagination-controls";
import { useFinanceYear } from "../../finance-year-context";
import { useTenantFormats } from "../../../../lib/use-tenant-formats";
import { Badge, type BadgeTone } from "../../../../../components/shared/badge";
import { FinanceTableShell } from "../../finance-table-shell";
import { appendIssueDateRangeParams } from "../../format-finance";
import { PadaukSortHeader, usePadaukSort } from "../../table-sort";
import { useListParams } from "../../../../lib/use-list-params";
import { appendNavigationTrail } from "../../../../lib/navigation-trail";
import { isPadaukRowInteractiveTarget } from "../../../../lib/table-row-interaction";
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

// "Partial" stays as a row badge but not as a filter: Due now includes partial
// payers (open + not past due), so Due + Overdue = everything owing.
const STATUS_FILTER_OPTIONS: StatusFilter[] = ["all", "paid", "due", "overdue"];
const PAGE_SIZE = 50;

const STATUS_TONES: Record<string, BadgeTone> = {
  paid: "success",
  partial: "warning",
  unpaid: "info",
  overdue: "danger"
};

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
  isLifetime = false,
  status,
  source,
  searchDebounced,
  sortKey,
  sortDir,
  loading
}: {
  academicYearId: string;
  isLifetime?: boolean;
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
      disabled={loading || (!academicYearId && !isLifetime)}
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
  const { formatDate, formatDateTime, formatMonth, formatMoney } = useTenantFormats();
  const router = useRouter();

  const { academicYearId, isLifetime, yearsLoading } = useFinanceYear();

  // Filters live in the URL so opening an invoice and coming back restores them.
  const { get, patch, currentUrl } = useListParams();
  const status = (get("status") || "all") as StatusFilter;
  const source = (get("source") || "all") as SourceFilter;
  const page = Math.max(0, Number(get("page", "0")) || 0);
  const searchDebounced = get("q");
  const [search, setSearch] = useState(searchDebounced);
  const { issueDateRange } = useInvoicesActionsContext();
  const { sortKey, sortDir, toggleSort } = usePadaukSort({
    defaultKey: "createdAt",
    defaultDir: "desc"
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      if (next !== searchDebounced) {
        patch({ q: next || null, page: null });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, searchDebounced, patch]);

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
    academicYearId || isLifetime ? `/tenants/${tenant}/finance/invoices${listQuery}` : null
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
        isLifetime={isLifetime}
        status={status}
        source={source}
        searchDebounced={searchDebounced}
        sortKey={sortKey}
        sortDir={sortDir}
        loading={yearsLoading || invoices.isLoading}
      />
      <p className="pds-type-body-s-regular muted panel-help">{tFees("invoicesViewHelp")}</p>

      <PdsSearchFiltersRow
        filters={
          <>
            <PdsSearchBar
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
            />
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={source}
                onValueChange={(value) => {
                  const next = typeof value === "string" ? value : "all";
                  patch({ source: next === "all" ? null : next, page: null });
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
                  const next = typeof value === "string" ? value : "all";
                  patch({ status: next === "all" ? null : next, page: null });
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
        loading={yearsLoading || invoices.isLoading}
        error={invoices.isError}
        empty={!rows.length}
        emptyMessage={t("empty")}
      >
        <PadaukTableWrap>
          <table className="pds-type-body-m-medium padauk-table padauk-table--pinned-end">
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
                      patch({ page: null });
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
                const dueLabel = row.dueDate ? formatDate(row.dueDate) : null;
                const gradeRoom = [row.gradeName, row.classroomName].filter(Boolean).join(" · ");
                const openInvoice = () => {
                  appendNavigationTrail({ label: tFees("title"), href: currentUrl });
                  router.push(`/dashboard/finance/invoices/${row.id}`);
                };
                return (
                  <tr
                    key={row.id}
                    className="table-row--clickable"
                    tabIndex={0}
                    onClick={(event) => {
                      if (isPadaukRowInteractiveTarget(event.target)) return;
                      openInvoice();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      if (isPadaukRowInteractiveTarget(event.target)) return;
                      event.preventDefault();
                      openInvoice();
                    }}
                  >
                    <td>
                      <Link
                        href={`/dashboard/finance/invoices/${row.id}`}
                        className="padauk-table__link"
                      >
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className="padauk-table__muted">{formatDateTime(row.createdAt)}</td>
                    <td>{formatMonth(row.billingMonth)}</td>
                    <td>{sourceLabel(row.source)}</td>
                    <td>
                      <DirectoryMemberCell
                        name={row.studentFullName ?? "—"}
                        subtitle={gradeRoom || "—"}
                      />
                    </td>
                    <td className="padauk-table__num">{formatMoney(Number(row.total))}</td>
                    <td className="padauk-table__num">
                      <div className="pds-type-body-s-regular padauk-table__stack">
                        <strong>{formatMoney(row.balanceDue)}</strong>
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
        </PadaukTableWrap>
      </FinanceTableShell>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={invoices.data?.total ?? 0}
        onPageChange={(next) => patch({ page: next > 0 ? String(next) : null })}
      />
    </>
  );
}
