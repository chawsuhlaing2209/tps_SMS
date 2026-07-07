import type { Meta, StoryObj } from "@storybook/react";
import { InvoiceDetails } from "../../components/pds/composites/invoice-details";
import { formatReceiptAmount } from "../../app/dashboard/finance/receipt-document";
import {
  buildPayrollInvoiceDetails,
  formatPayrollAmount,
  payrollInvoiceDemoFixture,
} from "../../app/dashboard/salary/run/payroll-invoice-details";
import { pdsCanvasDecorator } from "./decorators";

const payrollDetails = buildPayrollInvoiceDetails({
  labels: {
    baseSalary: "Base salary",
    allowances: "Allowances",
    bonuses: "Bonuses",
    grossPay: "Gross pay",
    deductions: "Deductions",
    deductionsStatutory: "Deductions (statutory)",
  },
  baseSalary: payrollInvoiceDemoFixture.baseSalary,
  packages: payrollInvoiceDemoFixture.packages,
  components: payrollInvoiceDemoFixture.components,
  incentives: payrollInvoiceDemoFixture.incentives,
  grossPay: payrollInvoiceDemoFixture.grossPay,
  deductionsTotal: payrollInvoiceDemoFixture.deductionsTotal,
  netPay: payrollInvoiceDemoFixture.netPay,
  totalLabel: "Net payable · June 2026",
});

const meta: Meta<typeof InvoiceDetails> = {
  title: "PDS/InvoiceDetails",
  component: InvoiceDetails,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof InvoiceDetails>;

export const FinanceBreakdown: Story = {
  name: "Finance breakdown",
  args: {
    sections: [
      {
        id: "items",
        title: "Invoice items",
        lines: [
          { id: "tuition", label: "Tuition fee · Term 1", amount: 600_000 },
          { id: "boarding", label: "Boarding fee", amount: 450_000 },
        ],
      },
      {
        id: "discounts",
        title: "Discount applied",
        emphasis: true,
        lines: [
          { id: "sibling", label: "Sibling discount (2nd child)", amount: 50_000, variant: "discount" },
        ],
      },
      {
        id: "paid",
        title: "Paid",
        emphasis: true,
        lines: [{ id: "paid-to-date", label: "Paid to date", amount: 200_000, variant: "credit" }],
      },
    ],
    totalDue: 800_000,
    totalLabel: "Balance due (MMK)",
    formatAmount: formatReceiptAmount,
  },
};

export const PayrollBreakdown: Story = {
  name: "Payroll breakdown",
  args: {
    ...payrollDetails,
    formatAmount: formatPayrollAmount,
  },
};

export const WithBonuses: Story = {
  name: "Payroll with bonuses",
  args: {
    ...buildPayrollInvoiceDetails({
      labels: {
        baseSalary: "Base salary",
        allowances: "Allowances",
        bonuses: "Bonuses",
        grossPay: "Gross pay",
        deductions: "Deductions",
        deductionsStatutory: "Deductions (statutory)",
      },
      baseSalary: 950_000,
      packages: payrollInvoiceDemoFixture.packages,
      components: payrollInvoiceDemoFixture.components.filter((row) => row.kind !== "deduction"),
      incentives: [
        {
          programId: "performance",
          name: "Monthly performance",
          description: "Monthly performance allowance",
          amount: 100_000,
          enabled: true,
        },
        {
          programId: "service",
          name: "Long service",
          description: "Annual long-service recognition",
          amount: 500_000,
          enabled: true,
        },
      ],
      grossPay: 1_660_000,
      deductionsTotal: 50_000,
      netPay: 1_610_000,
      totalLabel: "Net payable · June 2026",
    }),
    formatAmount: formatPayrollAmount,
  },
};
