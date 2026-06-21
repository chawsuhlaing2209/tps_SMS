"use client";

import { FormDatePicker } from "../../../../components/shared/form-input";
import { PdsSelectField, PdsSearchFiltersRow } from "../../../../components/pds";
import { StatCard, StatGrid } from "../../../../components/shared/stat-card";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApiQuery, useReferenceApiQuery } from "../../../lib/api";
import { useDashPageTitleActionsTarget } from "../../dashboard-page-title";
import { ExportCsvButton } from "../../../../components/shared/export-csv-button";
import { Icon } from "../../../lib/material-icon";
import { financeBreadcrumbs } from "../../../lib/page-header-utils";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { FinanceTableShell } from "../finance-table-shell";
import { formatBillingMonth } from "../format-finance";

type AcademicYearOption = {
  id: string;
  name: string;
  status: string;
};

type FinanceOverview = {
  academicYear: { id: string; name: string; status: string } | null;
  term: { id: string; name: string } | null;
  month: string;
  profile: {
    enrolledStudents: number;
    gradesWithStudents: number;
    averageBilledPerStudent: number;
    activeFeeItems: number;
    activeDiscountRules: number;
    studentsWithDiscounts: number;
    discountExposurePercent: number;
    paymentPlanMix: { enrollment: number; monthly: number; one_off: number };
  };
  revenue: {
    billed: number;
    collected: number;
    outstanding: number;
    overdue: number;
    collectionRate: number;
    owingStudents: number;
    overdueStudents: number;
    bySource: { enrollment: number; recurring: number; ad_hoc: number };
    byGrade: Array<{
      gradeId: string;
      gradeName: string;
      billed: number;
      collected: number;
      outstanding: number;
      students: number;
    }>;
  };
  monthly: {
    month: string;
    revenue: number;
    salaryExpenses: number;
    net: number;
    payrollPercentOfRevenue: number;
  };
  receivables: {
    aging: { current: number; days1to30: number; days31to60: number; days90Plus: number };
    topOverdue: Array<{
      id: string;
      invoiceNumber: string;
      studentFullName: string | null;
      gradeName: string | null;
      balanceDue: number;
      daysOverdue: number;
    }>;
  };
};

function formatAmount(value: number) {
  return Math.round(value).toLocaleString();
}

function formatPercent(value: number) {
  return `${value}%`;
}

function FinanceOverviewExportPortal({
  data,
  loading,
  academicYearId,
  month,
  planMixHint
}: {
  data: FinanceOverview | undefined;
  loading: boolean;
  academicYearId: string;
  month: string;
  planMixHint: (count: number) => string | undefined;
}) {
  const t = useTranslations("finance.overview");
  const tFees = useTranslations("finance.feesBilling");
  const tFinance = useTranslations("finance");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <ExportCsvButton
      disabled={loading || !academicYearId || !data}
      onExport={async () => {
        if (!data) {
          throw new Error("No data");
        }
        const yearSlug = data.academicYear?.name?.replace(/\s+/g, "-").toLowerCase() ?? "overview";
        return {
          filename: `finance-overview-${yearSlug}-${month}.csv`,
          sections: [
            {
              title: t("revenueTitle"),
              columns: [
                { key: "grade", header: tFees("grade") },
                { key: "billed", header: tFees("billed") },
                { key: "collected", header: tFees("collected") },
                { key: "outstanding", header: tFees("outstanding") },
                { key: "students", header: t("students") }
              ],
              rows: data.revenue.byGrade.map((grade) => ({
                grade: grade.gradeName,
                billed: grade.billed,
                collected: grade.collected,
                outstanding: grade.outstanding,
                students: grade.students
              }))
            },
            {
              title: `${t("receivablesTitle")} — ${tFinance("daysOverdue")}`,
              columns: [
                { key: "student", header: tFinance("student") },
                { key: "grade", header: tFees("grade") },
                { key: "invoice", header: tFinance("invoiceNumber") },
                { key: "balance", header: tFinance("balanceDue") },
                { key: "days", header: tFinance("daysOverdue") }
              ],
              rows: data.receivables.topOverdue.map((row) => ({
                student: row.studentFullName ?? "",
                grade: row.gradeName ?? "",
                invoice: row.invoiceNumber,
                balance: row.balanceDue,
                days: row.daysOverdue
              }))
            },
            {
              title: t("paymentPlanMix"),
              columns: [
                { key: "plan", header: t("paymentPlanMix") },
                { key: "count", header: t("students") },
                { key: "share", header: tFees("collectionRate") }
              ],
              rows: [
                {
                  plan: tFinance("paymentPlanLabels.enrollment"),
                  count: data.profile.paymentPlanMix.enrollment,
                  share: planMixHint(data.profile.paymentPlanMix.enrollment) ?? ""
                },
                {
                  plan: tFinance("paymentPlanLabels.monthly"),
                  count: data.profile.paymentPlanMix.monthly,
                  share: planMixHint(data.profile.paymentPlanMix.monthly) ?? ""
                },
                {
                  plan: tFinance("paymentPlanLabels.one_off"),
                  count: data.profile.paymentPlanMix.one_off,
                  share: planMixHint(data.profile.paymentPlanMix.one_off) ?? ""
                }
              ]
            }
          ]
        };
      }}
    />,
    target
  );
}

export default function FinanceOverviewPage() {
  const t = useTranslations("finance.overview");
  const tFees = useTranslations("finance.feesBilling");
  const tFinance = useTranslations("finance");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const currentYear = useCurrentAcademicYear();

  const [academicYearId, setAcademicYearId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const years = useReferenceApiQuery<AcademicYearOption[]>(
    (tenant) => `/tenants/${tenant}/academics/academic-years`
  );

  useEffect(() => {
    if (academicYearId) return;
    if (currentYear.data?.id) {
      setAcademicYearId(currentYear.data.id);
    } else if (years.data?.[0]?.id) {
      setAcademicYearId(years.data[0].id);
    }
  }, [academicYearId, currentYear.data?.id, years.data]);

  const overviewQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (month) params.set("month", month);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [academicYearId, month]);

  const overview = useApiQuery<FinanceOverview>(
    (tenant) => `/tenants/${tenant}/finance/reports/overview${overviewQuery}`
  );

  const yearOptions = useMemo(
    () =>
      (years.data ?? []).map((year) => ({
        value: year.id,
        label: year.name
      })),
    [years.data]
  );

  const data = overview.data;
  const planMixTotal =
    (data?.profile.paymentPlanMix.enrollment ?? 0) +
    (data?.profile.paymentPlanMix.monthly ?? 0) +
    (data?.profile.paymentPlanMix.one_off ?? 0);

  const planMixHint = (count: number) =>
    planMixTotal > 0 ? formatPercent(Math.round((count / planMixTotal) * 100)) : undefined;

  return (
    <div className="page-stack">
      <PageHeader
        title={t("title")}
        breadcrumbs={financeBreadcrumbs(nav, [{ label: t("nav") }])}
        actionsPortal
      />
      <FinanceOverviewExportPortal
        data={data}
        loading={overview.isLoading}
        academicYearId={academicYearId}
        month={month}
        planMixHint={planMixHint}
      />

      <PdsSearchFiltersRow
        filters={
          <>
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={academicYearId}
                onValueChange={(value) => {
                  if (typeof value === "string" && value) setAcademicYearId(value);
                }}
                options={yearOptions}
                placeholder={t("academicYear")}
                disabled={years.isLoading || !yearOptions.length}
              />
            </div>
            <div className="pds-search-filters-row__filter--160">
              <FormDatePicker
                type="month"
                variant="filter"
                ariaLabel={tFinance("month")}
                placeholder={tFinance("month")}
                value={month}
                onValueChange={setMonth}
              />
            </div>
          </>
        }
      />
      {data?.academicYear ? (
        <p className="pds-type-body-s-regular muted">
          {t("contextLine", {
            year: data.academicYear.name,
            term: data.term?.name ?? t("noTerm")
          })}
        </p>
      ) : null}

      {overview.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : overview.isError ? (
        <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
      ) : !data ? (
        <p className="pds-type-body-s-regular muted">{t("empty")}</p>
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2 className="pds-type-title-xs-bold">{t("profileTitle")}</h2>
              <Link href="/dashboard/finance/fee-structures" className="pds-type-body-s-semibold table-row-action">
                <Icon name="sell" size={16} />
                {t("viewFeeStructures")}
              </Link>
            </div>
            <StatGrid>
              <StatCard label={t("enrolledStudents")} value={formatAmount(data.profile.enrolledStudents)} />
              <StatCard label={t("gradesWithStudents")} value={formatAmount(data.profile.gradesWithStudents)} />
              <StatCard
                label={t("avgBilledPerStudent")}
                value={formatAmount(data.profile.averageBilledPerStudent)}
                hint="MMK"
              />
              <StatCard label={t("activeFeeItems")} value={formatAmount(data.profile.activeFeeItems)} />
              <StatCard label={t("activeDiscountRules")} value={formatAmount(data.profile.activeDiscountRules)} />
              <StatCard
                label={t("discountExposure")}
                value={formatPercent(data.profile.discountExposurePercent)}
                hint={t("studentsWithDiscounts", { count: data.profile.studentsWithDiscounts })}
              />
            </StatGrid>
            <div className="finance-report-grid finance-overview-plan-mix">
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{t("paymentPlanMix")}</span>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("paymentPlanLabels.enrollment")}</span>
                <strong>{formatAmount(data.profile.paymentPlanMix.enrollment)}</strong>
                {planMixHint(data.profile.paymentPlanMix.enrollment) ? (
                  <span className="pds-type-caption-s muted">{planMixHint(data.profile.paymentPlanMix.enrollment)}</span>
                ) : null}
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("paymentPlanLabels.monthly")}</span>
                <strong>{formatAmount(data.profile.paymentPlanMix.monthly)}</strong>
                {planMixHint(data.profile.paymentPlanMix.monthly) ? (
                  <span className="pds-type-caption-s muted">{planMixHint(data.profile.paymentPlanMix.monthly)}</span>
                ) : null}
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("paymentPlanLabels.one_off")}</span>
                <strong>{formatAmount(data.profile.paymentPlanMix.one_off)}</strong>
                {planMixHint(data.profile.paymentPlanMix.one_off) ? (
                  <span className="pds-type-caption-s muted">{planMixHint(data.profile.paymentPlanMix.one_off)}</span>
                ) : null}
              </article>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="pds-type-title-xs-bold">{t("revenueTitle")}</h2>
              <Link href="/dashboard/finance/invoices" className="pds-type-body-s-semibold table-row-action">
                <Icon name="description" size={16} />
                {tFinance("invoices")}
              </Link>
              <Link href="/dashboard/finance/payments" className="pds-type-body-s-semibold table-row-action">
                <Icon name="account_balance" size={16} />
                {tFinance("payments")}
              </Link>
            </div>
            <StatGrid>
              <StatCard accent label={tFees("billed")} value={formatAmount(data.revenue.billed)} hint="MMK" />
              <StatCard label={tFees("collected")} value={formatAmount(data.revenue.collected)} hint="MMK" />
              <StatCard label={tFees("outstanding")} value={formatAmount(data.revenue.outstanding)} hint="MMK" />
              <StatCard label={tFees("overdue")} value={formatAmount(data.revenue.overdue)} hint="MMK" />
              <StatCard
                label={tFees("collectionRate")}
                value={formatPercent(data.revenue.collectionRate)}
                hint={tFees("studentsOwing", { count: data.revenue.owingStudents })}
              />
              <StatCard
                label={t("overdueStudents")}
                value={formatAmount(data.revenue.overdueStudents)}
                hint={tFees("studentsPastDue", { count: data.revenue.overdueStudents })}
              />
            </StatGrid>
            <div className="finance-report-grid">
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("reportEnrollmentRevenue")}</span>
                <strong>{formatAmount(data.revenue.bySource.enrollment)}</strong>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("reportRecurringRevenue")}</span>
                <strong>{formatAmount(data.revenue.bySource.recurring)}</strong>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("reportAdHocRevenue")}</span>
                <strong>{formatAmount(data.revenue.bySource.ad_hoc)}</strong>
              </article>
            </div>
            <FinanceTableShell
              empty={!data.revenue.byGrade.length}
              emptyMessage={t("byGradeEmpty")}
            >
              <div className="padauk-table-wrap">
                <table className="pds-type-body-m-medium padauk-table">
                  <thead>
                    <tr>
                      <th className="pds-type-caption-s">{tFees("grade")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{tFees("billed")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{tFees("collected")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{tFees("outstanding")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{t("students")}</th>
                      <th className="pds-type-caption-s padauk-table__actions">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenue.byGrade.map((grade) => (
                      <tr key={grade.gradeId}>
                        <td>{grade.gradeName}</td>
                        <td className="padauk-table__num">{formatAmount(grade.billed)}</td>
                        <td className="padauk-table__num">{formatAmount(grade.collected)}</td>
                        <td className="padauk-table__num">{formatAmount(grade.outstanding)}</td>
                        <td className="padauk-table__num">{formatAmount(grade.students)}</td>
                        <td className="padauk-table__actions">
                          <Link
                            href={`/dashboard/finance/invoices/grade/${grade.gradeId}`}
                            className="pds-type-body-s-semibold table-row-action"
                          >
                            <Icon name="open_in_new" size={16} />
                            {t("viewGradeCollection")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FinanceTableShell>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="pds-type-title-xs-bold">{t("payrollTitle")}</h2>
              <span className="pds-type-body-s-regular muted">{formatBillingMonth(data.monthly.month)}</span>
            </div>
            <div className="finance-report-grid">
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("totalRevenue")}</span>
                <strong>{formatAmount(data.monthly.revenue)}</strong>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("salaryExpenses")}</span>
                <strong>{formatAmount(data.monthly.salaryExpenses)}</strong>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{tFinance("netIncome")}</span>
                <strong>{formatAmount(data.monthly.net)}</strong>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{t("payrollPercentOfRevenue")}</span>
                <strong>{formatPercent(data.monthly.payrollPercentOfRevenue)}</strong>
              </article>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="pds-type-title-xs-bold">{t("receivablesTitle")}</h2>
            </div>
            <div className="finance-report-grid">
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{t("agingCurrent")}</span>
                <strong>{formatAmount(data.receivables.aging.current)}</strong>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{t("aging1to30")}</span>
                <strong>{formatAmount(data.receivables.aging.days1to30)}</strong>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{t("aging31to60")}</span>
                <strong>{formatAmount(data.receivables.aging.days31to60)}</strong>
              </article>
              <article className="finance-report-stat">
                <span className="pds-type-body-s-regular muted">{t("aging90Plus")}</span>
                <strong>{formatAmount(data.receivables.aging.days90Plus)}</strong>
              </article>
            </div>
            <FinanceTableShell
              empty={!data.receivables.topOverdue.length}
              emptyMessage={t("topOverdueEmpty")}
            >
              <div className="padauk-table-wrap">
                <table className="pds-type-body-m-medium padauk-table">
                  <thead>
                    <tr>
                      <th className="pds-type-caption-s">{tFinance("student")}</th>
                      <th className="pds-type-caption-s">{tFees("grade")}</th>
                      <th className="pds-type-caption-s">{tFinance("invoiceNumber")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{tFinance("balanceDue")}</th>
                      <th className="pds-type-caption-s padauk-table__num">{tFinance("daysOverdue")}</th>
                      <th className="pds-type-caption-s padauk-table__actions">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.receivables.topOverdue.map((row) => (
                      <tr key={row.id}>
                        <td>{row.studentFullName ?? "—"}</td>
                        <td className="padauk-table__muted">{row.gradeName ?? "—"}</td>
                        <td>
                          <Link href={`/dashboard/finance/invoices/${row.id}`} className="padauk-table__link">
                            {row.invoiceNumber}
                          </Link>
                        </td>
                        <td className="padauk-table__num">{formatAmount(row.balanceDue)}</td>
                        <td className="padauk-table__num">{row.daysOverdue}</td>
                        <td className="padauk-table__actions">
                          <Link
                            href={`/dashboard/finance/invoices/${row.id}`}
                            className="pds-type-body-s-semibold table-row-action"
                          >
                            <Icon name="visibility" size={16} />
                            {tFinance("viewInvoice")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FinanceTableShell>
          </section>
        </>
      )}
    </div>
  );
}
