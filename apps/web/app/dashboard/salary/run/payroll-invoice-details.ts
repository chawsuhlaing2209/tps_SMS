import type { InvoiceDetailsSection } from "../../../../components/pds/composites/invoice-details";
import type { PayrollComponentOption, PayrollIncentiveOption, PayrollPackageOption } from "./payroll-staff-config-modal";

export type PayrollInvoiceDetailLabels = {
  baseSalary: string;
  allowances: string;
  bonuses: string;
  grossPay: string;
  deductions: string;
  deductionsStatutory: string;
};

export function formatPayrollAmount(value: number) {
  return Math.round(value).toLocaleString();
}

export function computePayrollBreakdownTotals({
  baseSalary,
  packages,
  components,
  incentives,
}: {
  baseSalary: number;
  packages: PayrollPackageOption[];
  components: PayrollComponentOption[];
  incentives: PayrollIncentiveOption[];
}) {
  const allowances =
    packages
      .filter((row) => row.enabled)
      .reduce((sum, row) => sum + row.amount, 0) +
    components
      .filter((row) => row.enabled && row.kind !== "deduction")
      .reduce((sum, row) => sum + row.amount, 0);
  const bonuses = incentives
    .filter((row) => row.enabled)
    .reduce((sum, row) => sum + row.amount, 0);
  const deductions = components
    .filter((row) => row.enabled && row.kind === "deduction")
    .reduce((sum, row) => sum + row.amount, 0);
  const grossPay = baseSalary + allowances + bonuses;
  const netPay = grossPay - deductions;

  return { allowances, bonuses, deductions, grossPay, netPay };
}

function allowanceLines(
  packages: PayrollPackageOption[],
  components: PayrollComponentOption[]
) {
  const lines: Array<{ id: string; label: string; amount: number }> = [];

  for (const item of components.filter((row) => row.enabled && row.kind !== "deduction")) {
    lines.push({
      id: item.componentId,
      label: item.name,
      amount: item.amount,
    });
  }

  for (const item of packages.filter((row) => row.enabled)) {
    lines.push({
      id: item.packageId,
      label: item.name,
      amount: item.amount,
    });
  }

  return lines;
}

function bonusLines(incentives: PayrollIncentiveOption[]) {
  return incentives
    .filter((row) => row.enabled)
    .map((item) => ({
      id: item.programId,
      label: item.name,
      amount: item.amount,
    }));
}

function deductionLines(components: PayrollComponentOption[]) {
  return components
    .filter((row) => row.enabled && row.kind === "deduction")
    .map((item) => ({
      id: item.componentId,
      label: item.name,
      amount: item.amount,
    }));
}

export function buildPayrollInvoiceDetails({
  labels,
  baseSalary,
  packages,
  components,
  incentives,
  grossPay,
  deductionsTotal,
  netPay,
  totalLabel,
}: {
  labels: PayrollInvoiceDetailLabels;
  baseSalary: number;
  packages: PayrollPackageOption[];
  components: PayrollComponentOption[];
  incentives: PayrollIncentiveOption[];
  grossPay: number;
  deductionsTotal: number;
  netPay: number;
  totalLabel: string;
}): {
  sections: InvoiceDetailsSection[];
  totalDue: number;
  totalLabel: string;
} {
  const sections: InvoiceDetailsSection[] = [
    {
      id: "base",
      title: labels.baseSalary,
      lines: [{ id: "base-salary", label: labels.baseSalary, amount: baseSalary }],
    },
  ];

  const allowances = allowanceLines(packages, components);
  if (allowances.length > 0) {
    sections.push({
      id: "allowances",
      title: labels.allowances,
      lines: allowances,
    });
  }

  const bonuses = bonusLines(incentives);
  if (bonuses.length > 0) {
    sections.push({
      id: "bonuses",
      title: labels.bonuses,
      lines: bonuses,
    });
  }

  sections.push({
    id: "gross",
    title: labels.grossPay,
    emphasis: true,
    lines: [{ id: "gross-pay", label: labels.grossPay, amount: grossPay }],
  });

  const deductions = deductionLines(components);
  if (deductions.length > 0 || deductionsTotal > 0) {
    sections.push({
      id: "deductions",
      title: labels.deductions,
      emphasis: true,
      lines:
        deductions.length > 0
          ? deductions.map((line) => ({
              ...line,
              variant: "discount" as const,
            }))
          : [
              {
                id: "deductions-total",
                label: labels.deductionsStatutory,
                amount: deductionsTotal,
                variant: "discount" as const,
              },
            ],
    });
  }

  return {
    sections,
    totalDue: netPay,
    totalLabel,
  };
}

/** Demo fixture for Storybook and local previews. */
export const payrollInvoiceDemoFixture = {
  schoolName: "Demo Alpha International School",
  schoolContact: "No. 12 Pyay Road · Yangon · +95 1 234 5678",
  staffFullName: "Daw Ei Mon",
  staffRole: "Teacher",
  department: "Teaching",
  staffId: "a1b2c3d4",
  salaryMonth: "2026-06",
  recordStatus: "paid" as const,
  baseSalary: 650_000,
  packages: [
    {
      packageId: "transport",
      name: "Transport package",
      icon: "directions_bus",
      amount: 80_000,
      enabled: true,
    },
  ] satisfies PayrollPackageOption[],
  components: [
    {
      componentId: "meal",
      name: "Meal allowance",
      kind: "earning",
      amount: 50_000,
      enabled: true,
    },
    {
      componentId: "ferry",
      name: "Ferry allowance",
      kind: "earning",
      amount: 80_000,
      enabled: true,
    },
    {
      componentId: "ssb",
      name: "SSB",
      kind: "deduction",
      amount: 30_000,
      enabled: true,
    },
    {
      componentId: "health",
      name: "Health insurance",
      kind: "deduction",
      amount: 20_000,
      enabled: true,
    },
  ] satisfies PayrollComponentOption[],
  incentives: [] satisfies PayrollIncentiveOption[],
  allowancesTotal: 210_000,
  bonusesTotal: 0,
  deductionsTotal: 50_000,
  grossPay: 860_000,
  netPay: 810_000,
};
