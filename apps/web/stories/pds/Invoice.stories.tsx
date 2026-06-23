import type { Meta, StoryObj } from "@storybook/react";
import { Invoice } from "../../components/pds/composites/invoice";
import { formatReceiptAmount } from "../../app/dashboard/finance/receipt-document";
import {
  buildPayrollInvoiceDetails,
  formatPayrollAmount,
  payrollInvoiceDemoFixture,
} from "../../app/dashboard/salary/run/payroll-invoice-details";
import { pdsCanvasDecorator } from "./decorators";

const financeInvoiceDetails = {
  sections: [
    {
      id: "items",
      title: "Invoice items",
      lines: [
        { id: "tuition", label: "Tuition fee · Term 1", amount: 600_000 },
        { id: "boarding", label: "Boarding fee", amount: 450_000 },
        { id: "transport", label: "Transport fee", amount: 80_000 },
      ],
    },
    {
      id: "discounts",
      title: "Discount applied",
      emphasis: true,
      lines: [
        { id: "sibling", label: "Sibling discount (2nd child)", amount: 50_000, variant: "discount" as const },
      ],
    },
    {
      id: "paid",
      title: "Paid",
      emphasis: true,
      lines: [{ id: "paid-to-date", label: "Paid to date", amount: 200_000, variant: "credit" as const }],
    },
  ],
  totalDue: 880_000,
  totalLabel: "Balance due (MMK)",
  formatAmount: formatReceiptAmount,
};

const payrollPayslipDetails = buildPayrollInvoiceDetails({
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

const meta: Meta<typeof Invoice> = {
  title: "PDS/Invoice",
  component: Invoice,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Invoice>;

export const FinanceInvoice: Story = {
  name: "Finance invoice",
  args: {
    schoolName: "Demo Alpha International School",
    schoolContact: "No. 12 Pyay Road · Yangon · +95 1 234 5678",
    billedToLabel: "Billed to",
    studentName: "Ma Thiri Aung",
    studentMeta: "Grade 8 · Room B · Guardian Daw Khin Khin",
    documentTitle: "Invoice",
    invoiceNumber: "INV-2026-0042",
    dueLabel: "Due 15 Jun 2026",
    details: financeInvoiceDetails,
    actions: [
      { id: "print", label: "Print", icon: "print", variant: "outline" },
      { id: "send", label: "Send to guardian", icon: "send", variant: "primary" },
    ],
    closeLabel: "Close",
  },
};

export const PayrollPayslip: Story = {
  name: "Payroll payslip",
  args: {
    schoolName: payrollInvoiceDemoFixture.schoolName,
    schoolContact: payrollInvoiceDemoFixture.schoolContact,
    billedToLabel: "Staff member",
    studentName: payrollInvoiceDemoFixture.staffFullName,
    studentMeta: "Teacher · Teaching · ID A1B2C3D4",
    documentTitle: "Salary breakdown",
    invoiceNumber: "June 2026",
    dueLabel: "Paid",
    details: {
      ...payrollPayslipDetails,
      formatAmount: formatPayrollAmount,
    },
  },
};
