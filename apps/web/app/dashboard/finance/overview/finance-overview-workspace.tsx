"use client";

import { Button, SegmentedControl } from "../../../../components/pds";
import { formatMoneyDigits } from "../../../lib/money";
import { EmptyState } from "../../../../components/shared/empty-state";
import { ExportCsvButton } from "../../../../components/shared/export-csv-button";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { TrailLink } from "../../../../components/shared/trail-link";
import { useMemo, useState } from "react";
import { useApiQuery } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { moduleBreadcrumbs } from "../../../lib/page-header-utils";
import { useFinanceYear } from "../finance-year-context";
import { useTenantFormats } from "../../../lib/use-tenant-formats";
import { PageHeader } from "../../page-header-context";
import styles from "./finance-overview.module.css";

export type FinanceOverview = {
  academicYear: { id: string; name: string; status: string } | null;
  term: { id: string; name: string } | null;
  month: string;
  scope: "month" | "term";
  kpis: {
    revenue: { amount: number; trendPercent: number; subtitleKey: string };
    expenses: { amount: number; trendPercent: number; subtitleKey: string };
    netSurplus: { amount: number; marginPercent: number; subtitleKey: string };
    collectionRate: { percent: number; outstandingAmount: number; subtitleKey: string };
  };
  monthlyTrend: Array<{ month: string; label: string; revenue: number; expenses: number }>;
  expenseBreakdown: Array<{ key: string; amount: number; percent: number }>;
  statusCards: {
    collectable: { amount: number; invoiceCount: number };
    overdue: { amount: number; studentCount: number };
    payable: { amount: number; staffCount: number };
  };
  cashPosition: {
    total: number;
    accounts: Array<{ key: string; amount: number }>;
  };
  salaryByDepartment: Array<{
    departmentName: string;
    amount: number;
    staffCount: number;
    paidCount: number;
    pendingCount: number;
  }>;
  salarySummary: { totalAmount: number; staffCount: number };
  revenue: {
    billed: number;
    collected: number;
    outstanding: number;
    overdue: number;
    collectionRate: number;
    byGrade: Array<{
      gradeId: string;
      gradeName: string;
      billed: number;
      collected: number;
      outstanding: number;
      students: number;
    }>;
  };
  receivables: {
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

type OverviewScope = "month" | "term";

const EXPENSE_COLORS: Record<string, string> = {
  salaries: "var(--pds-primary)",
};

/** For values followed by their own MMK unit span or an i18n message with "MMK". */
function formatDigits(value: number): string {
  return formatMoneyDigits(value);
}

function formatTrend(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}%`;
}

function trendClass(value: number, invert = false) {
  const positive = invert ? value < 0 : value > 0;
  if (value === 0) return styles.trendNeutral;
  return positive ? styles.trendUp : styles.trendDown;
}

export function FinanceOverviewWorkspace() {
  const t = useTranslations("finance.overview");
  const tFees = useTranslations("finance.feesBilling");
  const tSalary = useTranslations("salary");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const { formatMoney } = useTenantFormats();

  const { academicYearId, isLifetime, yearsLoading } = useFinanceYear();
  const [scope, setScope] = useState<OverviewScope>("month");
  const month = new Date().toISOString().slice(0, 7);

  const overviewQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (isLifetime) {
      params.set("yearMode", "lifetime");
    } else if (academicYearId) {
      params.set("academicYearId", academicYearId);
    }
    params.set("month", month);
    params.set("scope", scope);
    return `?${params.toString()}`;
  }, [academicYearId, isLifetime, month, scope]);

  const overview = useApiQuery<FinanceOverview>((tenant) =>
    academicYearId || isLifetime
      ? `/tenants/${tenant}/finance/reports/overview${overviewQuery}`
      : null,
  );

  const data = overview.data;
  const maxTrendValue = useMemo(() => {
    if (!data?.monthlyTrend.length) return 1;
    return Math.max(
      1,
      ...data.monthlyTrend.flatMap((point) => [point.revenue, point.expenses]),
    );
  }, [data?.monthlyTrend]);

  const expenseTotal = data?.expenseBreakdown.reduce((sum, row) => sum + row.amount, 0) ?? 0;
  const donutGradient = useMemo(() => {
    if (!data?.expenseBreakdown.length || expenseTotal <= 0) {
      return "conic-gradient(var(--pds-border-color-secondary) 0 100%)";
    }
    let cursor = 0;
    const segments = data.expenseBreakdown.map((row) => {
      const start = cursor;
      cursor += row.percent;
      const color = EXPENSE_COLORS[row.key] ?? "var(--pds-border-color-secondary)";
      return `${color} ${start}% ${cursor}%`;
    });
    if (cursor < 100) {
      segments.push(`var(--pds-border-color-secondary) ${cursor}% 100%`);
    }
    return `conic-gradient(${segments.join(", ")})`;
  }, [data?.expenseBreakdown, expenseTotal]);

  const maxGradeCollected = useMemo(() => {
    if (!data?.revenue.byGrade.length) return 1;
    return Math.max(1, ...data.revenue.byGrade.map((grade) => grade.collected));
  }, [data?.revenue.byGrade]);

  const headerActions = (
    <div className={styles.toolbarActions}>
      <Button asChild buttonType="outlined" buttonColor="secondary">
        <Link href="/dashboard/finance/payments">
          <Icon name="add_card" />
          {t("recordPayment")}
        </Link>
      </Button>
      <ExportCsvButton
        disabled={overview.isLoading || !data}
        onExport={async () => {
          if (!data) throw new Error("No data");
          const yearSlug = data.academicYear?.name?.replace(/\s+/g, "-").toLowerCase() ?? "overview";
          return {
            filename: `finance-overview-${yearSlug}-${month}.csv`,
            sections: [
              {
                title: t("revenueByGrade"),
                columns: [
                  { key: "grade", header: tFees("grade") },
                  { key: "billed", header: tFees("billed") },
                  { key: "collected", header: tFees("collected") },
                  { key: "outstanding", header: tFees("outstanding") },
                ],
                rows: data.revenue.byGrade.map((grade) => ({
                  grade: grade.gradeName,
                  billed: grade.billed,
                  collected: grade.collected,
                  outstanding: grade.outstanding,
                })),
              },
            ],
          };
        }}
      />
    </div>
  );

  return (
    <div className={`page-stack ${styles.root}`}>
      <PageHeader
        title={t("title")}
        breadcrumbs={moduleBreadcrumbs("financeOverview", nav)}
        actions={headerActions}
      />

      <div className={styles.toolbar}>
        <SegmentedControl
          ariaLabel={t("periodScope")}
          value={scope}
          onChange={(value) => setScope(value as OverviewScope)}
          options={[
            { id: "month", label: t("scopeMonth") },
            { id: "term", label: t("scopeTerm") },
          ]}
        />
      </div>

      {data?.academicYear ? (
        <p className="pds-type-body-s-regular muted">
          {t("contextLine", {
            year: data.academicYear.name,
            term: data.term?.name ?? t("noTerm"),
          })}
        </p>
      ) : null}

      {overview.isLoading || yearsLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : overview.isError ? (
        <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
      ) : !data ? (
        <EmptyState title={t("empty")} />
      ) : (
        <>
          <section className={styles.kpiGrid} aria-label={t("kpiSection")}>
            <article className={styles.kpiCard}>
              <div className={styles.kpiHead}>
                <Icon name="trending_up" className={styles.kpiIconRevenue} />
                <span className="pds-type-label-s-bold">{t("kpiRevenue")}</span>
              </div>
              <p className={styles.kpiValue}>
                {formatDigits(data.kpis.revenue.amount)}{" "}
                <span className={styles.kpiUnit}>MMK</span>
              </p>
              <p className={`pds-type-label-s-bold ${trendClass(data.kpis.revenue.trendPercent)}`}>
                {t("trendVsLast", { value: formatTrend(data.kpis.revenue.trendPercent) })}
              </p>
              <p className={`pds-type-caption-s ${styles.kpiSubtitle}`}>
                {t(data.kpis.revenue.subtitleKey as "feesAndIncome")}
              </p>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiHead}>
                <Icon name="trending_down" className={styles.kpiIconExpense} />
                <span className="pds-type-label-s-bold">{t("kpiExpenses")}</span>
              </div>
              <p className={styles.kpiValue}>
                {formatDigits(data.kpis.expenses.amount)}{" "}
                <span className={styles.kpiUnit}>MMK</span>
              </p>
              <p className={`pds-type-label-s-bold ${trendClass(data.kpis.expenses.trendPercent, true)}`}>
                {t("trendVsLast", { value: formatTrend(data.kpis.expenses.trendPercent) })}
              </p>
              <p className={`pds-type-caption-s ${styles.kpiSubtitle}`}>
                {t(data.kpis.expenses.subtitleKey as "payrollAndOperating")}
              </p>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiHead}>
                <Icon name="savings" className={styles.kpiIconSurplus} />
                <span className="pds-type-label-s-bold">{t("kpiNetSurplus")}</span>
              </div>
              <p className={styles.kpiValue}>
                {formatDigits(data.kpis.netSurplus.amount)}{" "}
                <span className={styles.kpiUnit}>MMK</span>
              </p>
              <p className={`pds-type-label-s-bold ${styles.trendUp}`}>
                {t("marginPercent", { value: data.kpis.netSurplus.marginPercent })}
              </p>
              <p className={`pds-type-caption-s ${styles.kpiSubtitle}`}>
                {t(data.kpis.netSurplus.subtitleKey as "revenueMinusExpenses")}
              </p>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiHead}>
                <Icon name="verified" className={styles.kpiIconCollection} />
                <span className="pds-type-label-s-bold">{t("kpiCollectionRate")}</span>
              </div>
              <p className={styles.kpiValue}>{data.kpis.collectionRate.percent}%</p>
              <p className={`pds-type-label-s-bold ${styles.trendCollection}`}>
                {t("outstandingAmount", {
                  amount: formatDigits(data.kpis.collectionRate.outstandingAmount),
                })}
              </p>
              <p className={`pds-type-caption-s ${styles.kpiSubtitle}`}>
                {t(data.kpis.collectionRate.subtitleKey as "collectedDividedBilled")}
              </p>
            </article>
          </section>

          <section className={styles.chartsRow}>
            <article className={styles.chartPanel}>
              <div className={styles.chartPanelHead}>
                <h2 className="pds-type-title-xs-bold">{t("revenueVsExpenses")}</h2>
                <div className={styles.chartLegend}>
                  <span>
                    <i className={styles.legendSwatchRevenue} /> {t("kpiRevenue")}
                  </span>
                  <span>
                    <i className={styles.legendSwatchExpense} /> {t("kpiExpenses")}
                  </span>
                </div>
              </div>
              <div className={styles.barChart} role="img" aria-label={t("revenueVsExpenses")}>
                {data.monthlyTrend.map((point) => (
                  <div key={point.month} className={styles.barGroup}>
                    <div className={styles.barPair}>
                      <span
                        className={styles.barRevenue}
                        style={{ height: `${Math.max(4, (point.revenue / maxTrendValue) * 100)}%` }}
                      />
                      <span
                        className={styles.barExpense}
                        style={{ height: `${Math.max(4, (point.expenses / maxTrendValue) * 100)}%` }}
                      />
                    </div>
                    <span className="pds-type-caption-s">{point.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.chartPanel}>
              <h2 className="pds-type-title-xs-bold">{t("expenseBreakdown")}</h2>
              <div className={styles.donutRow}>
                <div className={styles.donutWrap}>
                  <div className={styles.donut} style={{ background: donutGradient }}>
                    <div className={styles.donutCenter}>
                      <span className="pds-type-caption-s">{t("total")}</span>
                      <strong className="pds-type-title-xs-bold">
                        {formatMoney(expenseTotal)}
                      </strong>
                    </div>
                  </div>
                </div>
                <ul className={styles.breakdownList}>
                  {data.expenseBreakdown.length ? (
                    data.expenseBreakdown.map((row) => (
                      <li key={row.key}>
                        <i
                          className={styles.breakdownSwatch}
                          style={{ background: EXPENSE_COLORS[row.key] ?? "var(--pds-muted)" }}
                        />
                        <span className="pds-type-body-s-semibold">{t(`expense.${row.key}`)}</span>
                        <span className={`pds-type-label-s-bold ${styles.breakdownPercent}`}>
                          {row.percent}%
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="pds-type-body-s-regular muted">{t("expenseEmpty")}</li>
                  )}
                </ul>
              </div>
            </article>
          </section>

          <section className={styles.statusGrid}>
            <article className={styles.statusCard}>
              <div className={styles.statusHead}>
                <Icon name="account_balance_wallet" className={styles.statusIconCollectable} />
                <span className="pds-type-label-s-bold">{t("collectableTitle")}</span>
              </div>
              <p className={styles.statusValue}>
                {formatDigits(data.statusCards.collectable.amount)}{" "}
                <span className={styles.kpiUnit}>MMK</span>
              </p>
              <p className="pds-type-body-s-regular muted">
                {t("collectableHint", { count: data.statusCards.collectable.invoiceCount })}
              </p>
              <Link href="/dashboard/finance/invoices" className={styles.statusLink}>
                {t("viewInvoices")} <Icon name="arrow_forward" size={16} />
              </Link>
            </article>

            <article className={`${styles.statusCard} ${styles.statusCardDanger}`}>
              <div className={styles.statusHead}>
                <Icon name="warning" className={styles.statusIconOverdue} />
                <span className="pds-type-label-s-bold">{t("overdueTitle")}</span>
              </div>
              <p className={`${styles.statusValue} ${styles.statusValueDanger}`}>
                {formatDigits(data.statusCards.overdue.amount)}{" "}
                <span className={styles.kpiUnitDanger}>MMK</span>
              </p>
              <p className={`pds-type-body-s-semibold ${styles.statusHintDanger}`}>
                {tFees("studentsPastDue", { count: data.statusCards.overdue.studentCount })}
              </p>
              <Button asChild buttonType="filled" buttonColor="primary" className={styles.collectNowBtn}>
                <Link href="/dashboard/finance/invoices">
                  <Icon name="sms" />
                  {t("collectNow")}
                </Link>
              </Button>
            </article>

            <article className={styles.statusCard}>
              <div className={styles.statusHead}>
                <Icon name="outbox" className={styles.statusIconPayable} />
                <span className="pds-type-label-s-bold">{t("payableTitle")}</span>
              </div>
              <p className={styles.statusValue}>
                {formatDigits(data.statusCards.payable.amount)}{" "}
                <span className={styles.kpiUnit}>MMK</span>
              </p>
              <p className="pds-type-body-s-regular muted">{t("payableHint")}</p>
              <Link href="/dashboard/salary/run" className={styles.statusLinkPayable}>
                {t("reviewPayables")} <Icon name="arrow_forward" size={16} />
              </Link>
            </article>
          </section>

          <section className={styles.lowerRow}>
            <article className={styles.cashCard}>
              <div className={styles.cashHead}>
                <Icon name="savings" className={styles.cashIcon} />
                <span className="pds-type-label-s-bold">{t("cashOnHand")}</span>
              </div>
              <p className={styles.cashValue}>
                {formatDigits(data.cashPosition.total)}{" "}
                <span className={styles.cashUnit}>MMK</span>
              </p>
              <ul className={styles.cashAccounts}>
                {data.cashPosition.accounts.map((account) => (
                  <li key={account.key}>
                    <div>
                      <p className="pds-type-body-s-semibold">{t(`cashAccount.${account.key}`)}</p>
                    </div>
                    <span className="pds-type-body-m-bold">{formatMoney(account.amount)}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className={styles.gradePanel}>
              <h2 className="pds-type-title-xs-bold">{t("revenueByGrade")}</h2>
              {data.revenue.byGrade.length ? (
                <ul className={styles.gradeList}>
                  {data.revenue.byGrade.map((grade) => {
                    const collectionRate =
                      grade.billed > 0 ? Math.round((grade.collected / grade.billed) * 100) : 0;
                    return (
                      <li key={grade.gradeId}>
                        <span className="pds-type-body-s-semibold">{grade.gradeName}</span>
                        <div className={styles.gradeBarTrack}>
                          <span
                            className={styles.gradeBarFill}
                            style={{
                              width: `${Math.max(4, (grade.collected / maxGradeCollected) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="pds-type-body-s-semibold">
                          {formatMoney(grade.collected)}
                        </span>
                        <span className={`pds-type-label-s-bold ${styles.gradeRate}`}>
                          {collectionRate}%
                        </span>
                        {grade.outstanding > 0 ? (
                          <TrailLink
                            href={`/dashboard/finance/invoices/grade/${grade.gradeId}`}
                            className={styles.gradeDueLink}
                            from={{ label: t("title"), href: "/dashboard/finance/overview" }}
                          >
                            {formatMoney(grade.outstanding)} {t("dueLink")}
                          </TrailLink>
                        ) : (
                          <span className={styles.gradeCleared}>{t("cleared")}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title={t("byGradeEmpty")} compact />
              )}
            </article>
          </section>

          <section className={styles.payrollSection}>
            <div className={styles.payrollHead}>
              <div>
                <h2 className="pds-type-title-xs-bold">{t("salaryByDepartment")}</h2>
                <p className="pds-type-body-s-regular muted">
                  {t("salarySummary", {
                    amount: formatDigits(data.salarySummary.totalAmount),
                    count: data.salarySummary.staffCount,
                    scope: scope === "month" ? t("scopeMonth") : t("scopeTerm"),
                  })}
                </p>
              </div>
              <Button asChild buttonType="filled" buttonColor="primary" className={styles.runPayrollBtn}>
                <Link href="/dashboard/salary/run">
                  <Icon name="account_balance_wallet" />
                  {tSalary("runPayroll")}
                </Link>
              </Button>
            </div>
            {data.salaryByDepartment.length ? (
              <div className={styles.deptGrid}>
                {data.salaryByDepartment.map((dept) => (
                  <article key={dept.departmentName} className={styles.deptCard}>
                    <div className={styles.deptIconWrap}>
                      <Icon name="school" />
                    </div>
                    <div className={styles.deptBody}>
                      <p className="pds-type-body-m-bold">{dept.departmentName}</p>
                      <p className="pds-type-body-s-regular muted">
                        {t("deptStaff", { count: dept.staffCount })}
                      </p>
                    </div>
                    <div className={styles.deptAmount}>
                      <strong className="pds-type-title-xs-bold">
                        {formatMoney(dept.amount)}
                      </strong>
                      <span className="pds-type-caption-s muted">
                        {t("deptPaidPending", {
                          paid: dept.paidCount,
                          pending: dept.pendingCount,
                        })}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title={t("salaryByDepartmentEmpty")} compact />
            )}
          </section>
        </>
      )}
    </div>
  );
}
