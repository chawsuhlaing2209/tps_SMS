"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Icon } from "../../lib/material-icon";
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

function formatPaidToDate(value: number) {
  return `−${formatReceiptAmount(value)}`;
}

export function InvoiceDocumentBody({
  data,
  showActions = true,
  isModal = false,
  onPrint,
  onSend,
  sendPending = false,
  canVerifyPayments = false
}: {
  data: InvoiceDocumentData;
  showActions?: boolean;
  isModal?: boolean;
  onPrint?: () => void;
  onSend?: () => void;
  sendPending?: boolean;
  canVerifyPayments?: boolean;
}) {
  const t = useTranslations("finance.invoiceDocument");
  const dueLabel = data.dueDate ? t("dueOn", { date: formatInvoiceDate(data.dueDate) ?? data.dueDate }) : null;
  const contact = schoolContactLine(data.schoolAddress, data.schoolContactPhone);

  const closeButton = isModal ? (
    <DialogPrimitive.Close className="invoice-doc__close" aria-label={t("close")}>
      <Icon name="close" size={17} />
    </DialogPrimitive.Close>
  ) : null;

  return (
    <>
      <header className="invoice-doc__header">
        <div className="invoice-doc__header-main">
          <div className="invoice-doc__header-top">
            <span className="invoice-doc__logo" aria-hidden>
              <span className="invoice-doc__logo-mark" />
            </span>
            <strong className="invoice-doc__school">{data.schoolName}</strong>
          </div>
          {contact ? <span className="invoice-doc__contact">{contact}</span> : null}
        </div>
        {closeButton}
      </header>

      <div className="invoice-doc__body">
        <div className="invoice-doc__meta">
          <div className="invoice-doc__billed">
            <span className="invoice-doc__eyebrow">{t("billedTo")}</span>
            <strong className="invoice-doc__student">{data.studentFullName}</strong>
            <span className="invoice-doc__billed-meta">{billedToMeta(data) || "—"}</span>
          </div>
          <div className="invoice-doc__ref">
            <strong className="invoice-doc__title">{t("title")}</strong>
            <span className="invoice-doc__number">{data.invoiceNumber}</span>
            {dueLabel ? <span className="invoice-doc__due">{dueLabel}</span> : null}
          </div>
        </div>

        <section className="invoice-doc__table">
          <ul className="invoice-doc__lines">
            {data.items.map((item) => (
              <li key={item.id}>
                <span className="pds-type-body-s-semibold invoice-doc__line-label">{item.description}</span>
                <strong className="pds-type-body-s-semibold invoice-doc__line-amount">{formatReceiptAmount(item.amount)}</strong>
              </li>
            ))}
            {data.discountLines.map((line) => (
              <li key={line.id} className="invoice-doc__line--discount">
                <span className="pds-type-body-s-semibold invoice-doc__line-label">{line.name}</span>
                <strong className="pds-type-body-s-semibold invoice-doc__line-amount">−{formatReceiptAmount(line.amount)}</strong>
              </li>
            ))}
          </ul>
          <div className="pds-type-body-s-semibold invoice-doc__subtotal">
            <span>{t("subtotalBilled")}</span>
            <strong>{formatReceiptAmount(data.subtotal)}</strong>
          </div>
        </section>

        <div className="invoice-doc__summary">
          <div className="pds-type-body-s-semibold invoice-doc__paid-row">
            <span>{t("paidToDate")}</span>
            <strong>{formatPaidToDate(data.paidToDate)}</strong>
          </div>
          <div className="pds-type-body-s-semibold invoice-doc__balance">
            <span>{t("balanceDue")}</span>
            <strong>{formatReceiptAmount(data.balanceDue)}</strong>
          </div>
        </div>

        <InvoiceVerifyPayments
          invoiceId={data.id}
          payments={data.payments}
          canVerify={canVerifyPayments}
        />

        {showActions ? (
          <footer className="invoice-doc__actions">
            <button type="button" className="invoice-doc__print" onClick={onPrint}>
              <Icon name="print" size={17} />
              {t("print")}
            </button>
            <button
              type="button"
              className="invoice-doc__send"
              disabled={sendPending}
              onClick={onSend}
            >
              <Icon name="send" size={17} />
              {sendPending ? "…" : t("sendToGuardian")}
            </button>
          </footer>
        ) : null}
      </div>
    </>
  );
}

export function InvoicePreviewModal({
  invoiceId,
  open,
  onOpenChange,
  children
}: {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
          <DialogPrimitive.Title className="sr-only">{t("title")}</DialogPrimitive.Title>
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
  printDocument(".invoice-doc", {
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
