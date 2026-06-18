"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApiQuery } from "../../../lib/api";
import { DirectoryMemberCell } from "../../../lib/data-table";
import { Icon } from "../../../lib/material-icon";
import { PaginationControls } from "../../../lib/pagination-controls";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { Badge, type BadgeTone } from "../../../../components/shared/badge";
import { InvoicesToolbar } from "./_components/invoices-workspace";
import { FinanceTableShell } from "../finance-table-shell";

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
};

type InvoiceList = { data: InvoiceRow[]; total: number; limit: number; offset: number };

type InvoiceMetrics = {
  allCount: number;
  allBilled: number;
  settledCount: number;
  openCount: number;
  openAmount: number;
  overdueCount: number;
  termName: string | null;
};

type StatusFilter = "" | "paid" | "partial" | "due" | "overdue";

const STATUS_FILTERS: StatusFilter[] = ["", "paid", "partial", "due", "overdue"];
const PAGE_SIZE = 50;

const STATUS_TONES: Record<string, BadgeTone> = {
  paid: "success",
  partial: "warning",
  unpaid: "info",
  overdue: "danger"
};

function compactMMK(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

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

export default function InvoicesPage() {
  const t = useTranslations("finance.invoiceList");
  const tFees = useTranslations("finance.feesBilling");
  const nav = useTranslations("nav");

  const currentYear = useCurrentAcademicYear();
  const academicYearId = currentYear.data?.id ?? "";

  const [status, setStatus] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const metricsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (academicYearId) params.set("academicYearId", academicYearId);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [academicYearId]);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE)
    });
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (status) params.set("status", status);
    if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
    return `?${params.toString()}`;
  }, [academicYearId, page, searchDebounced, status]);

  const metrics = useApiQuery<InvoiceMetrics>((tenant) =>
    academicYearId ? `/tenants/${tenant}/finance/invoices/metrics${metricsQuery}` : null
  );

  const invoices = useApiQuery<InvoiceList>((tenant) =>
    academicYearId ? `/tenants/${tenant}/finance/invoices${listQuery}` : null
  );

  const rows = invoices.data?.data ?? [];
  const metricData = metrics.data;

  const statusLabel = (value: string) => {
    if (value === "unpaid") return tFees("statusLabels.due");
    if (value === "paid") return tFees("statusLabels.paid");
    if (value === "partial") return tFees("statusLabels.partial");
    if (value === "overdue") return tFees("statusLabels.overdue");
    return value;
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const refetchAll = () => {
    void metrics.refetch();
    void invoices.refetch();
  };

  return (
    <div className="fees-page">
      <PageHeader title={t("title")} breadcrumbs={[{ label: nav("financeCrumb") }]} />

      <section className="fees-metrics" aria-label={t("title")}>
        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="description" size={16} />
            {t("allInvoices")}
          </span>
          <strong className="fees-metric__value">{metricData?.allCount ?? 0}</strong>
          <span className="fees-metric__sub">
            {t("allBilled", { amount: compactMMK(metricData?.allBilled ?? 0) })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="check_circle" size={16} />
            {t("settled")}
          </span>
          <strong className="fees-metric__value">{metricData?.settledCount ?? 0}</strong>
          <span className="fees-metric__sub">{t("fullyPaid")}</span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="hourglass_empty" size={16} />
            {t("open")}
          </span>
          <strong className="fees-metric__value">{metricData?.openCount ?? 0}</strong>
          <span className="fees-metric__sub">
            {t("openAmount", { amount: compactMMK(metricData?.openAmount ?? 0) })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="warning" size={16} />
            {t("overdue")}
          </span>
          <strong className="fees-metric__value fees-metric__value--danger">
            {metricData?.overdueCount ?? 0}
          </strong>
          <span className="fees-metric__sub">{t("needFollowUp")}</span>
        </article>
      </section>

      <section className="fees-toolbar">
        <div className="fees-search">
          <Icon name="search" size={18} className="fees-search__icon" />
          <input
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <div className="fees-segmented" role="tablist" aria-label={tFees("status")}>
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || "all"}
              type="button"
              role="tab"
              aria-selected={status === value}
              className={status === value ? "fees-segment fees-segment--active" : "fees-segment"}
              onClick={() => {
                setStatus(value);
                setPage(0);
              }}
            >
              {value ? tFees(`statusFilters.${value}`) : tFees("statusFilters.all")}
            </button>
          ))}
        </div>
        <div className="fees-toolbar__actions">
          <InvoicesToolbar onCreated={refetchAll} />
        </div>
      </section>

      <FinanceTableShell
        loading={currentYear.isLoading || invoices.isLoading}
        error={invoices.isError}
        empty={!rows.length}
        emptyMessage={t("empty")}
      >
        <div className="padauk-table-wrap">
          <table className="padauk-table">
            <thead>
              <tr>
                <th>{t("invoice")}</th>
                <th>{tFees("student")}</th>
                <th className="padauk-table__num">{tFees("billed")}</th>
                <th className="padauk-table__num">{t("balanceDue")}</th>
                <th>{tFees("status")}</th>
                <th className="padauk-table__actions">{tFees("actions")}</th>
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
                    <td>
                      <DirectoryMemberCell
                        name={row.studentFullName ?? "—"}
                        subtitle={gradeRoom || "—"}
                        colorKey={row.studentId}
                      />
                    </td>
                    <td className="padauk-table__num">{fullNumber(Number(row.total))}</td>
                    <td className="padauk-table__num">
                      <div className="padauk-table__stack">
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
                        className="table-row-action"
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
    </div>
  );
}
