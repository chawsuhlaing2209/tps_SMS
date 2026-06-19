"use client";

import { useTranslations } from "next-intl";
import { Icon } from "../../lib/material-icon";

export type PaymentReceiptPayload = {
  id: string;
  receiptNumber: string;
  issuedAt: string;
  schoolName: string;
  studentName: string;
  gradeName: string | null;
  classroomName: string | null;
  room: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  method: string;
  academicYearName: string;
  termName: string | null;
  referenceNumber: string | null;
  cashier: string;
  amountPaid: number;
  remainingBalance: number;
  currency: string;
  invoiceNumber?: string | null;
};

export function formatReceiptAmount(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function shortAcademicYear(name: string) {
  const match = name.match(/(\d{4})\D+(\d{2,4})/);
  const start = match?.[1];
  const end = match?.[2];
  if (!start || !end) return name;
  return `${start}–${end.slice(-2)}`;
}

export function buildReceiptDetailLines(
  receipt: PaymentReceiptPayload,
  labels: {
    student: string;
    gradeRoom: string;
    guardian: string;
    contact: string;
    method: string;
    appliedTo: string;
    reference: string;
    cashier: string;
  },
  methodName: string
) {
  const appliedTo = receipt.invoiceNumber
    ? [receipt.termName, `AY ${shortAcademicYear(receipt.academicYearName)}`, receipt.invoiceNumber]
        .filter(Boolean)
        .join(" · ")
    : [receipt.termName, `AY ${shortAcademicYear(receipt.academicYearName)}`].filter(Boolean).join(" · ");
  const gradeRoom = [
    receipt.gradeName,
    receipt.room ? `Room ${receipt.room}` : receipt.classroomName
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    { label: labels.student, value: receipt.studentName },
    { label: labels.gradeRoom, value: gradeRoom || "—" },
    { label: labels.guardian, value: receipt.guardianName ?? "—" },
    { label: labels.contact, value: receipt.guardianPhone ?? "—" },
    { label: labels.method, value: methodName },
    { label: labels.appliedTo, value: appliedTo || "—" },
    { label: labels.reference, value: receipt.referenceNumber ?? "—" },
    { label: labels.cashier, value: receipt.cashier }
  ];
}

export function PaymentReceiptDocument({
  receipt,
  methodName,
  onPrint,
  title,
  subtitle,
  documentLabel,
  showBannerActions = true,
  footer
}: {
  receipt: PaymentReceiptPayload;
  methodName: string;
  onPrint?: () => void;
  title: string;
  subtitle: string;
  documentLabel: string;
  showBannerActions?: boolean;
  footer?: React.ReactNode;
}) {
  const t = useTranslations("finance.receipt");
  const issuedDate = receipt.issuedAt ? receipt.issuedAt.slice(0, 10) : "";
  const lines = buildReceiptDetailLines(
    receipt,
    {
      student: t("student"),
      gradeRoom: t("gradeRoom"),
      guardian: t("guardian"),
      contact: t("contact"),
      method: t("method"),
      appliedTo: t("appliedTo"),
      reference: t("reference"),
      cashier: t("cashier")
    },
    methodName
  );

  return (
    <div className="receipt">
      <header className="receipt__banner">
        <div className="receipt__banner-main">
          <span className="receipt__check">
            <Icon name="check" size={22} />
          </span>
          <div>
            <h2 className="pds-type-title-xs-bold receipt__title">{title}</h2>
            <p className="pds-type-body-s-regular receipt__subtitle">{subtitle}</p>
          </div>
        </div>
        {showBannerActions && onPrint ? (
          <button type="button" className="pds-type-body-s-semibold receipt__print" onClick={onPrint}>
            <Icon name="print" size={18} />
            {t("print")}
          </button>
        ) : null}
      </header>

      <div className="receipt__paper">
        <div className="receipt__paper-head">
          <div className="receipt__brand">
            <span className="receipt__logo">
              <Icon name="school" size={20} filled />
            </span>
            <div>
              <strong className="pds-type-title-xs-bold receipt__school">{receipt.schoolName}</strong>
              <span className="pds-type-body-s-regular receipt__doc">{documentLabel}</span>
            </div>
          </div>
          <div className="pds-type-title-xs-bold receipt__ref">
            <strong>#{receipt.receiptNumber}</strong>
            <span>{issuedDate}</span>
          </div>
        </div>

        <dl className="receipt__rows">
          {lines.map((line) => (
            <div key={line.label} className="pds-type-body-s-regular receipt__row">
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>

        <div className="receipt__summary">
          <div>
            <span className="pds-type-caption-s receipt__summary-label">{t("amountPaid")}</span>
            <strong className="receipt__amount">
              {formatReceiptAmount(receipt.amountPaid)} {receipt.currency}
            </strong>
            <span className="pds-type-body-s-regular receipt__summary-foot">{t("currencyName")}</span>
          </div>
          <div className="receipt__summary-right">
            <span className="pds-type-caption-s receipt__summary-label">{t("remainingBalance")}</span>
            <strong className="receipt__remaining">
              {formatReceiptAmount(receipt.remainingBalance)}
            </strong>
            <span className="pds-type-body-s-regular receipt__summary-foot">{receipt.currency}</span>
          </div>
        </div>

        <footer className="receipt__paper-foot">
          <div className="pds-type-body-s-regular receipt__paper-foot-meta">
            <span>{t("issuedBy", { name: receipt.cashier })}</span>
            <span>
              {receipt.schoolName} · AY {shortAcademicYear(receipt.academicYearName)}
            </span>
          </div>
          <span className="pds-type-body-s-semibold receipt__verified">
            <Icon name="verified" size={16} />
            {t("verified")}
          </span>
        </footer>
      </div>

      {footer}
    </div>
  );
}

export function printPaymentReceipt(
  receipt: PaymentReceiptPayload,
  labels: {
    header: string;
    receiptLabel: string;
    student: string;
    gradeRoom: string;
    guardian: string;
    contact: string;
    methodLabel: string;
    appliedTo: string;
    reference: string;
    cashier: string;
    amountPaid: string;
    remaining: string;
    methodName: string;
  }
) {
  const issuedDate = receipt.issuedAt ? receipt.issuedAt.slice(0, 10) : "";
  const lines = buildReceiptDetailLines(
    receipt,
    {
      student: labels.student,
      gradeRoom: labels.gradeRoom,
      guardian: labels.guardian,
      contact: labels.contact,
      method: labels.methodLabel,
      appliedTo: labels.appliedTo,
      reference: labels.reference,
      cashier: labels.cashier
    },
    labels.methodName
  );

  const row = (label: string, value: string) =>
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>${escapeHtml(receipt.receiptNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #14241b; margin: 0; padding: 32px; }
  .wrap { max-width: 640px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #14241b; padding-bottom: 16px; }
  .school { font-size: 20px; font-weight: 800; }
  .doc { color: #5b6b62; font-size: 13px; }
  .ref { text-align: right; }
  .ref strong { font-size: 18px; font-weight: 800; }
  .ref span { display: block; color: #8a958e; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; padding: 12px 8px; border-bottom: 1px solid #e6eae7; font-size: 14px; }
  th { color: #5b6b62; font-weight: 600; width: 38%; }
  .summary { margin-top: 24px; background: #14241b; color: #fff; border-radius: 16px; padding: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .summary .label { text-transform: uppercase; letter-spacing: .08em; font-size: 11px; color: #b9c6bd; }
  .amount { font-size: 32px; font-weight: 800; color: #c8f25d; }
  .remaining { font-size: 24px; font-weight: 800; text-align: right; }
</style></head>
<body><div class="wrap">
  <div class="head">
    <div><div class="school">${escapeHtml(receipt.schoolName)}</div><div class="doc">${escapeHtml(labels.header)}</div></div>
    <div class="ref"><strong>#${escapeHtml(receipt.receiptNumber)}</strong><span>${escapeHtml(issuedDate)}</span></div>
  </div>
  <table>
    ${lines.map((line) => row(line.label, line.value)).join("")}
  </table>
  <div class="summary">
    <div><div class="label">${escapeHtml(labels.amountPaid)}</div><div class="amount">${formatReceiptAmount(receipt.amountPaid)} ${escapeHtml(receipt.currency)}</div></div>
    <div><div class="label">${escapeHtml(labels.remaining)}</div><div class="remaining">${formatReceiptAmount(receipt.remainingBalance)} ${escapeHtml(receipt.currency)}</div></div>
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
