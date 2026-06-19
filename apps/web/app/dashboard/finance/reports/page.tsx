"use client";
import { FormDatePicker } from "../../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApiQuery } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { Badge, type BadgeTone } from "../../../../components/shared/badge";
import { FinanceTableShell } from "../finance-table-shell";
import { financeBreadcrumbs } from "../../../lib/page-header-utils";
import { PageHeader } from "../../page-header-context";

type ReceivableRow = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentFullName: string | null;
  gradeName: string | null;
  dueDate: string | null;
  balanceDue: number;
  status: string;
  daysOverdue: number | null;
};

type StatusFilter = "" | "unpaid" | "partial" | "overdue";

const STATUS_FILTERS: StatusFilter[] = ["", "unpaid", "partial", "overdue"];

const STATUS_TONES: Record<string, BadgeTone> = {
  unpaid: "info",
  partial: "warning",
  overdue: "danger"
};

function fullNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatDueDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export default function FinanceReportsPage() {
  const t = useTranslations("finance");
  const tFees = useTranslations("finance.feesBilling");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState<StatusFilter>("");

  const monthly = useApiQuery<{
    month: string;
    revenue: number;
    salaryExpenses: number;
    net: number;
    revenueBySource?: { enrollment: number; recurring: number; ad_hoc: number };
  }>((tenant) => `/tenants/${tenant}/finance/reports/monthly?month=${encodeURIComponent(month)}`);

  const receivablesQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [status]);

  const receivables = useApiQuery<ReceivableRow[]>(
    (tenant) => `/tenants/${tenant}/finance/reports/receivables${receivablesQuery}`
  );

  const rows = receivables.data ?? [];

  const formatAmount = (value: number) =>
    new Intl.NumberFormat(undefined, { style: "decimal" }).format(value);

  const statusLabel = (value: string) => {
    if (value === "unpaid") return tFees("statusLabels.due");
    if (value === "partial") return tFees("statusLabels.partial");
    if (value === "overdue") return tFees("statusLabels.overdue");
    return value;
  };

  return (
    <div className="page-stack">
      <PageHeader
        title={t("reports")}
        breadcrumbs={financeBreadcrumbs(nav, [{ label: t("reports") }])}
      />
      <section className="panel">
        <div className="panel-head">
          <h2 className="pds-type-title-xs-bold">{t("monthlyReport")}</h2>
        </div>
        <label className="form-inline">
          <span className="pds-type-body-s-regular muted">{t("month")}</span>
          <FormDatePicker
            type="month"
            variant="filter"
            ariaLabel={t("month")}
            placeholder={t("month")}
            value={month}
            onValueChange={setMonth}
          />
        </label>
        {monthly.isLoading ? (
          <p className="pds-type-body-s-regular muted">{c("loading")}</p>
        ) : monthly.isError ? (
          <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
        ) : monthly.data ? (
          <div className="finance-report-grid">
            <article className="finance-report-stat">
              <span className="pds-type-body-s-regular muted">{t("totalRevenue")}</span>
              <strong>{formatAmount(monthly.data.revenue)}</strong>
            </article>
            <article className="finance-report-stat">
              <span className="pds-type-body-s-regular muted">{t("salaryExpenses")}</span>
              <strong>{formatAmount(monthly.data.salaryExpenses)}</strong>
            </article>
            <article className="finance-report-stat">
              <span className="pds-type-body-s-regular muted">{t("netIncome")}</span>
              <strong>{formatAmount(monthly.data.net)}</strong>
            </article>
            {monthly.data.revenueBySource ? (
              <>
                <article className="finance-report-stat">
                  <span className="pds-type-body-s-regular muted">{t("reportEnrollmentRevenue")}</span>
                  <strong>{formatAmount(monthly.data.revenueBySource.enrollment)}</strong>
                </article>
                <article className="finance-report-stat">
                  <span className="pds-type-body-s-regular muted">{t("reportRecurringRevenue")}</span>
                  <strong>{formatAmount(monthly.data.revenueBySource.recurring)}</strong>
                </article>
                <article className="finance-report-stat">
                  <span className="pds-type-body-s-regular muted">{t("reportAdHocRevenue")}</span>
                  <strong>{formatAmount(monthly.data.revenueBySource.ad_hoc)}</strong>
                </article>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="pds-type-title-xs-bold">{t("receivables")}</h2>
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => void receivables.refetch()}>
            <Icon name="refresh" />
            {c("refresh")}
          </button>
        </div>
        <p className="pds-type-body-s-regular muted panel-help">{t("receivablesHelp")}</p>

        <div className="fees-segmented" role="tablist" aria-label={c("status")}>
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || "all"}
              type="button"
              role="tab"
              aria-selected={status === value}
              className={status === value ? "fees-segment fees-segment--active" : "fees-segment"}
              onClick={() => setStatus(value)}
            >
              {value ? statusLabel(value) : t("allStatuses")}
            </button>
          ))}
        </div>

        <FinanceTableShell
          loading={receivables.isLoading}
          error={receivables.isError}
          empty={!rows.length}
          emptyMessage={t("receivablesEmpty")}
        >
          <div className="padauk-table-wrap">
            <table className="pds-type-body-m-medium padauk-table">
              <thead>
                <tr>
                  <th className="pds-type-caption-s">{t("student")}</th>
                  <th className="pds-type-caption-s">{t("grade")}</th>
                  <th className="pds-type-caption-s">{t("invoiceNumber")}</th>
                  <th className="pds-type-caption-s">{t("dueDate")}</th>
                  <th className="pds-type-caption-s padauk-table__num">{t("balanceDue")}</th>
                  <th className="pds-type-caption-s padauk-table__num">{t("daysOverdue")}</th>
                  <th className="pds-type-caption-s">{c("status")}</th>
                  <th className="pds-type-caption-s padauk-table__actions">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.studentFullName ?? "—"}</td>
                    <td className="padauk-table__muted">{row.gradeName ?? "—"}</td>
                    <td>
                      <Link
                        href={`/dashboard/finance/invoices/${row.id}`}
                        className="padauk-table__link"
                      >
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className="padauk-table__muted">{formatDueDate(row.dueDate)}</td>
                    <td className="padauk-table__num">{fullNumber(row.balanceDue)}</td>
                    <td className="padauk-table__num">
                      {row.daysOverdue != null && row.daysOverdue > 0 ? row.daysOverdue : "—"}
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
                        {t("viewInvoice")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FinanceTableShell>
      </section>
    </div>
  );
}
