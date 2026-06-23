"use client";

import "./invoice-modal.css";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Invoice, type InvoiceDetailsSection } from "../../../components/pds/composites/invoice";
import { printDocument } from "../../lib/print-document";
import { formatReceiptAmount } from "./receipt-document";
import {
  InvoiceVerifyPayments,
  type InvoicePaymentRow
} from "./invoice-verify-payments";

export type { InvoicePaymentRow };

export type InvoiceLineItem = {
  id: string;
  description: string;
  amount: number;
};

export type InvoiceDocumentData = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  schoolName: string;
  schoolAddress: string | null;
  schoolContactPhone: string | null;
  studentFullName: string;
  gradeName: string | null;
  classroomName: string | null;
  guardianName: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  paidToDate: number;
  balanceDue: number;
  items: InvoiceLineItem[];
  discountLines: Array<{ id: string; name: string; amount: number }>;
  payments: InvoicePaymentRow[];
};

function formatInvoiceDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function schoolContactLine(address: string | null, phone: string | null) {
  return [address, phone].filter(Boolean).join(" · ");
}

function billedToMeta(data: InvoiceDocumentData) {
  const gradeRoom = [data.gradeName, data.classroomName].filter(Boolean).join(" · ");
  const guardian = data.guardianName ? `Guardian ${data.guardianName}` : null;
  return [gradeRoom, guardian].filter(Boolean).join(" · ");
}

function buildInvoiceDetailSections(
  data: InvoiceDocumentData,
  labels: { lineItems: string; discounts: string; paid: string; paidToDate: string },
): InvoiceDetailsSection[] {
  const sections: InvoiceDetailsSection[] = [
    {
      id: "items",
      title: labels.lineItems,
      lines: data.items.map((item) => ({
        id: item.id,
        label: item.description,
        amount: item.amount,
      })),
    },
  ];

  if (data.discountLines.length > 0) {
    sections.push({
      id: "discounts",
      title: labels.discounts,
      emphasis: true,
      lines: data.discountLines.map((line) => ({
        id: line.id,
        label: line.name,
        amount: line.amount,
        variant: "discount",
      })),
    });
  }

  sections.push({
    id: "paid",
    title: labels.paid,
    emphasis: true,
    lines: [
      {
        id: "paid-to-date",
        label: labels.paidToDate,
        amount: data.paidToDate,
        variant: "credit",
      },
    ],
  });

  return sections;
}

export function InvoiceDocumentBody({
  data,
  showActions = true,
  isModal = false,
  onClose,
  onPrint,
  onSend,
  sendPending = false,
  canVerifyPayments = false
}: {
  data: InvoiceDocumentData;
  showActions?: boolean;
  isModal?: boolean;
  onClose?: () => void;
  onPrint?: () => void;
  onSend?: () => void;
  sendPending?: boolean;
  canVerifyPayments?: boolean;
}) {
  const t = useTranslations("finance.invoiceDocument");
  const dueLabel = data.dueDate ? t("dueOn", { date: formatInvoiceDate(data.dueDate) ?? data.dueDate }) : null;
  const contact = schoolContactLine(data.schoolAddress, data.schoolContactPhone);

  const actions = showActions
    ? [
        {
          id: "print",
          label: t("print"),
          icon: "print",
          variant: "outline" as const,
          onClick: onPrint,
        },
        {
          id: "send",
          label: sendPending ? "…" : t("sendToGuardian"),
          icon: "send",
          variant: "primary" as const,
          disabled: sendPending,
          onClick: onSend,
        },
      ]
    : undefined;

  return (
    <Invoice
      schoolName={data.schoolName}
      schoolContact={contact || null}
      billedToLabel={t("billedTo")}
      studentName={data.studentFullName}
      studentMeta={billedToMeta(data) || null}
      documentTitle={t("title")}
      invoiceNumber={data.invoiceNumber}
      dueLabel={dueLabel}
      details={{
        sections: buildInvoiceDetailSections(data, {
          lineItems: t("lineItemsSection"),
          discounts: t("discountsSection"),
          paid: t("paidSection"),
          paidToDate: t("paidToDate"),
        }),
        totalDue: data.balanceDue,
        totalLabel: t("balanceDue"),
        formatAmount: formatReceiptAmount,
      }}
      actions={actions}
      onClose={onClose}
      closeLabel={t("close")}
    >
      <InvoiceVerifyPayments
        invoiceId={data.id}
        payments={data.payments}
        canVerify={canVerifyPayments}
      />
    </Invoice>
  );
}

export function InvoicePreviewModal({
  invoiceId,
  open,
  onOpenChange,
  title,
  children
}: {
  invoiceId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Screen-reader title; defaults to finance invoice document title. */
  title?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("finance.invoiceDocument");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="invoice-modal__overlay" />
        <DialogPrimitive.Content
          className="invoice-modal"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">{title ?? t("title")}</DialogPrimitive.Title>
          <div className="invoice-doc invoice-doc--modal" data-invoice-id={invoiceId ?? undefined}>
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function printInvoiceDocument(
  data: InvoiceDocumentData,
  _labels?: {
    billedTo: string;
    title: string;
    subtotalBilled: string;
    paidToDate: string;
    balanceDue: string;
    dueOn: (date: string) => string;
  }
) {
  printDocument(".pds-invoice", {
    title: data.invoiceNumber,
    width: "narrow"
  });
}

export function mapInvoiceDetailToDocument(
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string | null;
    subtotal: string;
    discountTotal: string;
    total: string;
    studentFullName: string;
    gradeName: string | null;
    classroomName: string | null;
    guardianName: string | null;
    schoolName: string;
    schoolAddress?: string | null;
    schoolContactPhone?: string | null;
    items: Array<{ id: string; description: string; unitAmount: string; quantity: string; total?: string }>;
    discountLines: Array<{ id: string; name: string; amount: string }>;
    payments: Array<{
      id?: string;
      kind: "payment" | "refund";
      amount: string;
      method?: string;
      referenceNumber?: string | null;
      paidAt?: string | null;
      verifiedAt: string | null;
    }>;
  }
): InvoiceDocumentData {
  const paidToDate = invoice.payments.reduce((sum, payment) => {
    if (!payment.verifiedAt) return sum;
    const value = Number(payment.amount);
    return payment.kind === "refund" ? sum - value : sum + value;
  }, 0);

  const total = Number(invoice.total);
  const balanceDue = Math.max(0, total - paidToDate);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    schoolName: invoice.schoolName,
    schoolAddress: invoice.schoolAddress ?? null,
    schoolContactPhone: invoice.schoolContactPhone ?? null,
    studentFullName: invoice.studentFullName,
    gradeName: invoice.gradeName,
    classroomName: invoice.classroomName,
    guardianName: invoice.guardianName,
    subtotal: Number(invoice.subtotal),
    discountTotal: Number(invoice.discountTotal),
    total,
    paidToDate,
    balanceDue,
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: Number(item.total ?? Number(item.unitAmount) * Number(item.quantity))
    })),
    discountLines: invoice.discountLines.map((line) => ({
      id: line.id,
      name: line.name,
      amount: Number(line.amount)
    })),
    payments: (invoice.payments ?? []).map((payment, index) => ({
      id: payment.id ?? `payment-${index}`,
      kind: payment.kind,
      amount: payment.amount,
      method: payment.method ?? "cash",
      referenceNumber: payment.referenceNumber ?? null,
      paidAt: payment.paidAt ?? null,
      verifiedAt: payment.verifiedAt ?? null
    }))
  };
}
