"use client";

import { useTranslations } from "next-intl";
import { useTenantFormats } from "../../../lib/use-tenant-formats";
import "./payroll-net-summary.css";

export type PayrollNetSummaryProps = {
  base: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  netPay: number;
};

export function PayrollNetSummary({
  base,
  allowances,
  bonuses,
  deductions,
  netPay
}: PayrollNetSummaryProps) {
  const t = useTranslations("salary");
  const { formatMoney } = useTenantFormats();

  return (
    <div className="payroll-net-summary" data-node-id="96:28544">
      <div className="payroll-net-summary__metrics">
        <div className="payroll-net-summary__metric">
          <span className="payroll-net-summary__label pds-type-caption-s">{t("summaryBase")}</span>
          <span className="payroll-net-summary__value">{formatMoney(base)}</span>
        </div>
        <div className="payroll-net-summary__metric">
          <span className="payroll-net-summary__label pds-type-caption-s">{t("summaryAllowances")}</span>
          <span className="payroll-net-summary__value">+{formatMoney(allowances)}</span>
        </div>
        <div className="payroll-net-summary__metric">
          <span className="payroll-net-summary__label pds-type-caption-s">{t("summaryBonuses")}</span>
          <span className="payroll-net-summary__value payroll-net-summary__value--accent">
            +{formatMoney(bonuses)}
          </span>
        </div>
        <div className="payroll-net-summary__metric">
          <span className="payroll-net-summary__label pds-type-caption-s">{t("summaryDeductions")}</span>
          <span className="payroll-net-summary__value">−{formatMoney(deductions)}</span>
        </div>
      </div>
      <div className="payroll-net-summary__footer">
        <span className="payroll-net-summary__net-label">{t("summaryNetPayable")}</span>
        <strong className="payroll-net-summary__net-value">{formatMoney(netPay)}</strong>
      </div>
    </div>
  );
}
