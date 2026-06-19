"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { Icon } from "../../lib/material-icon";
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
  labels: {
    billedTo: string;
    title: string;
    subtotalBilled: string;
    paidToDate: string;
    balanceDue: string;
    dueOn: (date: string) => string;
  }
) {
  const dueLabel = data.dueDate
    ? labels.dueOn(formatInvoiceDate(data.dueDate) ?? data.dueDate)
    : "";
  const contact = schoolContactLine(data.schoolAddress, data.schoolContactPhone);
  const billedMeta = billedToMeta(data);

  const line = (left: string, right: string) =>
    `<tr><td>${escapeHtml(left)}</td><td style="text-align:right;font-weight:700">${escapeHtml(right)}</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(data.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #0a2a1d; margin: 0; padding: 32px; }
  .wrap { max-width: 520px; margin: 0 auto; border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px -30px rgba(0,0,0,0.5); }
  .head { background: #0a2a1d; color: #fff; padding: 22px 26px; }
  .school { font-size: 16px; font-weight: 800; }
  .contact { color: #9fb3a6; font-size: 11px; margin-top: 8px; display: block; }
  .body { padding: 24px 26px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 14px; }
  .eyebrow { text-transform: uppercase; letter-spacing: .055em; font-size: 11px; color: #9fb3a6; font-weight: 700; }
  .title { font-size: 20px; font-weight: 800; display: block; text-align: right; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #eef3ea; border-radius: 14px; overflow: hidden; }
  td { padding: 12px 16px; border-bottom: 1px solid #f4f7f1; font-size: 13px; }
  .subtotal td { background: #f7faf4; font-weight: 700; }
  .paid { display: flex; justify-content: space-between; margin-top: 14px; font-size: 13px; color: #7c917f; }
  .paid strong { color: #3a7d24; }
  .balance { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eef3ea; display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; }
  .balance strong { color: #c0392b; font-size: 22px; }
</style></head>
<body><div class="wrap">
  <div class="head">
    <div class="school">${escapeHtml(data.schoolName)}</div>
    ${contact ? `<span class="contact">${escapeHtml(contact)}</span>` : ""}
  </div>
  <div class="body">
    <div class="meta">
      <div>
        <div class="eyebrow">${escapeHtml(labels.billedTo)}</div>
        <strong style="font-size:15px">${escapeHtml(data.studentFullName)}</strong>
        <div style="color:#7c917f;font-size:12px">${escapeHtml(billedMeta || "—")}</div>
      </div>
      <div>
        <span class="title">${escapeHtml(labels.title)}</span>
        <div style="color:#7c917f;font-size:12px;text-align:right">${escapeHtml(data.invoiceNumber)}</div>
        ${dueLabel ? `<div style="color:#7c917f;font-size:12px;text-align:right">${escapeHtml(dueLabel)}</div>` : ""}
      </div>
    </div>
    <table>
      ${data.items.map((item) => line(item.description, formatReceiptAmount(item.amount))).join("")}
      <tr class="subtotal"><td>${escapeHtml(labels.subtotalBilled)}</td><td style="text-align:right;font-weight:800">${formatReceiptAmount(data.subtotal)}</td></tr>
    </table>
    <div class="paid"><span>${escapeHtml(labels.paidToDate)}</span><strong>−${formatReceiptAmount(data.paidToDate)}</strong></div>
    <div class="balance"><span>${escapeHtml(labels.balanceDue)}</span><strong>${formatReceiptAmount(data.balanceDue)}</strong></div>
  </div>
</div>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;

  const printWindow = window.open("", "_blank", "width=720,height=900");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
