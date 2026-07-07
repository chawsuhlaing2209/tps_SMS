"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Invoice, type InvoiceAction } from "../../../../components/pds/composites/invoice";
import { useSchoolBrand } from "../../../lib/use-school-brand";
import { useTenantFormats } from "../../../lib/use-tenant-formats";
import type { PayrollComponentOption, PayrollIncentiveOption, PayrollPackageOption } from "./payroll-staff-config-modal";
import {
  buildPayrollInvoiceDetails,
  computePayrollBreakdownTotals,
} from "./payroll-invoice-details";

type Props = {
  staffId: string;
  staffFullName: string | null;
  staffRole: string | null;
  department: string | null;
  salaryMonth: string;
  schoolName?: string | null;
  schoolContact?: string | null;
  baseSalary: number;
  packages: PayrollPackageOption[];
  components: PayrollComponentOption[];
  incentives: PayrollIncentiveOption[];
  recordStatus?: "approved" | "paid";
  onClose?: () => void;
  closeLabel?: string;
  actions?: InvoiceAction[];
  children?: ReactNode;
};

export function PayrollSalaryBreakdownView({
  staffId,
  staffFullName,
  staffRole,
  department,
  salaryMonth,
  schoolName,
  schoolContact,
  baseSalary,
  packages,
  components,
  incentives,
  recordStatus = "paid",
  onClose,
  closeLabel,
  actions,
  children,
}: Props) {
  const t = useTranslations("salary");
  const { formatMonth, formatMoney } = useTenantFormats();
  const { logoUrl } = useSchoolBrand();
  const salaryMonthLabel = formatMonth(salaryMonth);
  const staffSubtitleParts = [
    staffRole,
    department,
    t("breakdownStaffId", { id: staffId.slice(0, 8).toUpperCase() }),
  ].filter(Boolean);

  const computedTotals = computePayrollBreakdownTotals({
    baseSalary,
    packages,
    components,
    incentives,
  });

  const invoiceDetails = buildPayrollInvoiceDetails({
    labels: {
      baseSalary: t("breakdownBaseSalary"),
      allowances: t("breakdownAllowancesSection"),
      bonuses: t("breakdownBonusesSection"),
      grossPay: t("breakdownGrossPay"),
      deductions: t("breakdownDeductions"),
      deductionsStatutory: `${t("breakdownDeductions")} ${t("breakdownDeductionsHint")}`,
    },
    baseSalary,
    packages,
    components,
    incentives,
    grossPay: computedTotals.grossPay,
    deductionsTotal: computedTotals.deductions,
    netPay: computedTotals.netPay,
    totalLabel: t("breakdownNetPayableMonth", { month: salaryMonthLabel }),
  });

  return (
    <Invoice
      id="payroll-salary-breakdown-print"
      className="payroll-salary-breakdown"
        schoolName={schoolName?.trim() || t("payslipSchoolFallback")}
        schoolContact={schoolContact}
        logoUrl={logoUrl}
        billedToLabel={t("payslipBilledTo")}
        studentName={staffFullName ?? staffId}
        studentMeta={staffSubtitleParts.join(" · ")}
        documentTitle={t("breakdownModalTitle")}
        invoiceNumber={salaryMonthLabel}
        dueLabel={
          recordStatus === "approved" ? t("breakdownApprovedBadge") : t("breakdownPaidBadge")
        }
        details={{
          ...invoiceDetails,
          formatAmount: formatMoney,
        }}
        actions={actions}
        onClose={onClose}
        closeLabel={closeLabel}
      >
        {children}
      </Invoice>
  );
}
