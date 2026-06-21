"use client";

import { useTranslations } from "next-intl";
import { EntityAvatar } from "../../../../components/pds/subcomponents/entity-avatar";
import { Icon } from "../../../lib/material-icon";
import type { PayrollComponentOption, PayrollIncentiveOption, PayrollPackageOption } from "./payroll-staff-config-modal";
import { resolvePayrollRowIconTone, type PayrollConfigRowIconTone } from "./payroll-config-row";
import "./payroll-salary-breakdown-view.css";

export type PayrollBreakdownLine = {
  id: string;
  label: string;
  amount: number;
  icon?: string;
  kind?: string;
  tone?: PayrollConfigRowIconTone;
  variant: "allowance" | "bonus";
};

function formatMoney(value: number) {
  return Math.round(value).toLocaleString();
}

function personInitials(name: string | null | undefined) {
  if (!name?.trim()) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

function formatSalaryMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type Props = {
  staffId: string;
  staffFullName: string | null;
  staffRole: string | null;
  department: string | null;
  salaryMonth: string;
  baseSalary: number;
  packages: PayrollPackageOption[];
  components: PayrollComponentOption[];
  incentives: PayrollIncentiveOption[];
  allowancesTotal: number;
  bonusesTotal: number;
  deductionsTotal: number;
  grossPay: number;
  netPay: number;
  /** When set, shows a status pill on the payslip header (e.g. approved vs paid). */
  recordStatus?: "approved" | "paid";
};

function buildAllowanceLines(
  packages: PayrollPackageOption[],
  components: PayrollComponentOption[]
): PayrollBreakdownLine[] {
  const lines: PayrollBreakdownLine[] = [];

  for (const item of components.filter((row) => row.enabled && row.kind !== "deduction")) {
    lines.push({
      id: item.componentId,
      label: item.name,
      amount: item.amount,
      icon: "payments",
      kind: item.kind,
      tone: resolvePayrollRowIconTone("payments", item.kind),
      variant: "allowance"
    });
  }

  for (const item of packages.filter((row) => row.enabled)) {
    lines.push({
      id: item.packageId,
      label: item.name,
      amount: item.amount,
      icon: item.icon,
      tone: resolvePayrollRowIconTone(item.icon),
      variant: "allowance"
    });
  }

  return lines;
}

function buildBonusLines(incentives: PayrollIncentiveOption[]): PayrollBreakdownLine[] {
  return incentives
    .filter((row) => row.enabled)
    .map((item) => ({
      id: item.programId,
      label: item.name,
      amount: item.amount,
      icon: "event_available",
      tone: "amber" as const,
      variant: "bonus" as const
    }));
}

export function PayrollSalaryBreakdownView({
  staffId,
  staffFullName,
  staffRole,
  department,
  salaryMonth,
  baseSalary,
  packages,
  components,
  incentives,
  allowancesTotal,
  bonusesTotal,
  deductionsTotal,
  grossPay,
  netPay,
  recordStatus = "paid"
}: Props) {
  const t = useTranslations("salary");

  const allowanceLines = buildAllowanceLines(packages, components);
  const bonusLines = buildBonusLines(incentives);
  const staffSubtitleParts = [
    staffRole,
    department,
    t("breakdownStaffId", { id: staffId.slice(0, 8).toUpperCase() })
  ].filter(Boolean);

  return (
    <div className="payroll-salary-breakdown" id="payroll-salary-breakdown-print" data-node-id="96:24618">
      <div className="payroll-salary-breakdown__staff-card">
        <EntityAvatar
          initials={personInitials(staffFullName)}
          nameForColor={staffFullName ?? staffId}
        />
        <div className="payroll-salary-breakdown__staff-meta">
          <p className="payroll-salary-breakdown__staff-name">
            {staffFullName ?? staffId}
          </p>
          <p className="pds-type-body-s-regular payroll-salary-breakdown__staff-subtitle">
            {staffSubtitleParts.join(" · ")}
          </p>
        </div>
        <span className="payroll-salary-breakdown__paid-badge">
          {recordStatus === "approved" ? t("breakdownApprovedBadge") : t("breakdownPaidBadge")}
        </span>
      </div>

      <div className="payroll-salary-breakdown__panel">
        <div className="payroll-salary-breakdown__row payroll-salary-breakdown__row--base">
          <p className="payroll-salary-breakdown__row-label">{t("breakdownBaseSalary")}</p>
          <span className="payroll-salary-breakdown__amount">{formatMoney(baseSalary)}</span>
        </div>

        {allowanceLines.length > 0 ? (
          <>
            <div className="payroll-salary-breakdown__row payroll-salary-breakdown__row--section">
              <p className="payroll-salary-breakdown__row-label payroll-salary-breakdown__row-label--section">
                {t("breakdownAllowancesSection")}
              </p>
              <span className="payroll-salary-breakdown__amount payroll-salary-breakdown__amount--item">
                +{formatMoney(allowancesTotal)}
              </span>
            </div>
            {allowanceLines.map((line) => (
              <div key={line.id} className="payroll-salary-breakdown__row payroll-salary-breakdown__row--item">
                <p className="payroll-salary-breakdown__row-label payroll-salary-breakdown__row-label-group">
                  <span
                    className={[
                      "payroll-salary-breakdown__dot",
                      `payroll-salary-breakdown__dot--${line.tone ?? "default"}`
                    ].join(" ")}
                    aria-hidden
                  />
                  {line.label}
                </p>
                <span className="payroll-salary-breakdown__amount payroll-salary-breakdown__amount--item">
                  +{formatMoney(line.amount)}
                </span>
              </div>
            ))}
          </>
        ) : null}

        {bonusLines.length > 0 ? (
          <>
            <div className="payroll-salary-breakdown__row payroll-salary-breakdown__row--section">
              <p className="payroll-salary-breakdown__row-label payroll-salary-breakdown__row-label--section">
                {t("breakdownBonusesSection")}
              </p>
              <span className="payroll-salary-breakdown__amount payroll-salary-breakdown__amount--bonus">
                +{formatMoney(bonusesTotal)}
              </span>
            </div>
            {bonusLines.map((line) => (
              <div key={line.id} className="payroll-salary-breakdown__row payroll-salary-breakdown__row--item">
                <p className="payroll-salary-breakdown__row-label payroll-salary-breakdown__row-label-group">
                  <span className="payroll-salary-breakdown__incentive-icon" aria-hidden>
                    <Icon name="event_available" size={14} />
                  </span>
                  {line.label}
                </p>
                <span className="payroll-salary-breakdown__amount payroll-salary-breakdown__amount--bonus">
                  +{formatMoney(line.amount)}
                </span>
              </div>
            ))}
          </>
        ) : null}

        <div className="payroll-salary-breakdown__row payroll-salary-breakdown__row--gross">
          <p className="payroll-salary-breakdown__row-label payroll-salary-breakdown__row-label--gross">
            {t("breakdownGrossPay")}
          </p>
          <span className="payroll-salary-breakdown__amount">{formatMoney(grossPay)}</span>
        </div>

        {deductionsTotal > 0 ? (
          <div className="payroll-salary-breakdown__row">
            <p className="payroll-salary-breakdown__row-label">
              {t("breakdownDeductions")}
              <span className="payroll-salary-breakdown__deduction-hint">
                {" "}
                {t("breakdownDeductionsHint")}
              </span>
            </p>
            <span className="payroll-salary-breakdown__amount payroll-salary-breakdown__amount--deduction">
              −{formatMoney(deductionsTotal)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="payroll-salary-breakdown__net-banner">
        <div className="payroll-salary-breakdown__net-copy">
          <p className="payroll-salary-breakdown__net-title">
            {t("breakdownNetPayableMonth", { month: formatSalaryMonth(salaryMonth) })}
          </p>
          <p className="payroll-salary-breakdown__net-subtitle">
            {[department, staffRole].filter(Boolean).join(" · ")}
          </p>
        </div>
        <strong className="payroll-salary-breakdown__net-value">{formatMoney(netPay)}</strong>
      </div>
    </div>
  );
}
