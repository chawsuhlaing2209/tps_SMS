"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";

type MonthlyReport = {
  month: string;
  revenue: number;
  salaryExpenses: number;
  net: number;
  revenueBySource?: {
    enrollment: number;
    recurring: number;
    ad_hoc: number;
  };
};

export default function FinanceReportsPage() {
  const t = useTranslations("finance");
  const c = useTranslations("common");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const monthly = useApiQuery<MonthlyReport>(
    (tenant) => `/tenants/${tenant}/finance/reports/monthly?month=${encodeURIComponent(month)}`
  );
  const receivables = useApiQuery<Record<string, unknown>>(
    (tenant) => `/tenants/${tenant}/finance/reports/receivables`
  );

  const formatAmount = (value: number) =>
    new Intl.NumberFormat(undefined, { style: "decimal" }).format(value);

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-head">
          <h2>{t("monthlyReport")}</h2>
        </div>
        <Field>
          <input
            type="month"
            aria-label={t("month")}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
        {monthly.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : monthly.isError ? (
          <p className="error-text">{c("somethingWrong")}</p>
        ) : monthly.data ? (
          <div className="finance-report-grid">
            <article className="finance-report-stat">
              <span className="muted">{t("totalRevenue")}</span>
              <strong>{formatAmount(monthly.data.revenue)}</strong>
            </article>
            <article className="finance-report-stat">
              <span className="muted">{t("salaryExpenses")}</span>
              <strong>{formatAmount(monthly.data.salaryExpenses)}</strong>
            </article>
            <article className="finance-report-stat">
              <span className="muted">{t("netIncome")}</span>
              <strong>{formatAmount(monthly.data.net)}</strong>
            </article>
            {monthly.data.revenueBySource ? (
              <>
                <article className="finance-report-stat">
                  <span className="muted">{t("reportEnrollmentRevenue")}</span>
                  <strong>{formatAmount(monthly.data.revenueBySource.enrollment)}</strong>
                </article>
                <article className="finance-report-stat">
                  <span className="muted">{t("reportRecurringRevenue")}</span>
                  <strong>{formatAmount(monthly.data.revenueBySource.recurring)}</strong>
                </article>
                <article className="finance-report-stat">
                  <span className="muted">{t("reportAdHocRevenue")}</span>
                  <strong>{formatAmount(monthly.data.revenueBySource.ad_hoc)}</strong>
                </article>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("receivables")}</h2>
          <button type="button" className="btn-ghost" onClick={() => void receivables.refetch()}>
            <Icon name="refresh" />
            {c("refresh")}
          </button>
        </div>
        {receivables.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : receivables.isError ? (
          <p className="error-text">{c("somethingWrong")}</p>
        ) : (
          <pre className="muted">{JSON.stringify(receivables.data, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
