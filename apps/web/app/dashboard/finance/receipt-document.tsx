"use client";

import { useTranslations } from "next-intl";
import { formatMMK, formatMoneyDigits } from "../../lib/money";
import { Icon } from "../../lib/material-icon";
import { printDocument } from "../../lib/print-document";
import { useSchoolBrand } from "../../lib/use-school-brand";
import { useTenantFormats } from "../../lib/use-tenant-formats";

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

/** Fallback money formatter for contexts without tenant preferences (e.g. stories). */
export function formatReceiptAmount(value: number): string {
  return formatMMK(value);
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
  const { formatDate } = useTenantFormats();
  const { logoUrl } = useSchoolBrand();
  // Date-only slice keeps the issued day stable across timezones before formatting.
  const issuedDate = receipt.issuedAt ? formatDate(receipt.issuedAt.slice(0, 10)) : "";
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
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="receipt__logo-img" src={logoUrl} alt="" />
              ) : (
                <Icon name="school" size={20} filled />
              )}
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
              {formatMoneyDigits(receipt.amountPaid)} {receipt.currency}
            </strong>
            <span className="pds-type-body-s-regular receipt__summary-foot">{t("currencyName")}</span>
          </div>
          <div className="receipt__summary-right">
            <span className="pds-type-caption-s receipt__summary-label">{t("remainingBalance")}</span>
            <strong className="receipt__remaining">
              {formatMoneyDigits(receipt.remainingBalance)}
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
  _labels?: {
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
  printDocument(".receipt", {
    title: receipt.receiptNumber,
    width: "narrow"
  });
}
