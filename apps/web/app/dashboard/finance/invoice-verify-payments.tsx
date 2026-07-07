"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApiMutation } from "../../lib/api";
import { TextAreaInput } from "../../../components/shared/form-input";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { StatusBadge } from "../../../components/shared/badge";
import { formatReceiptAmount } from "./receipt-document";
import { formatCreatedAt } from "./format-finance";

export type InvoicePaymentRow = {
  id: string;
  kind: "payment" | "refund";
  amount: string;
  method: string;
  referenceNumber: string | null;
  paidAt: string | null;
  verifiedAt: string | null;
};

const METHOD_ICONS: Record<string, string> = {
  kbzpay: "qr_code_2",
  wavepay: "account_balance_wallet",
  aya_pay: "account_balance_wallet",
  cb_pay: "account_balance_wallet",
  bank_transfer: "account_balance",
  cash: "payments"
};

export function InvoiceVerifyPayments({
  invoiceId,
  payments,
  canVerify
}: {
  invoiceId: string;
  payments: InvoicePaymentRow[];
  canVerify: boolean;
}) {
  const t = useTranslations("finance");
  const tPay = useTranslations("enrollments");
  const c = useTranslations("common");
  const [verifyTargetId, setVerifyTargetId] = useState<string | null>(null);
  const [verifyReason, setVerifyReason] = useState("");

  const unverified = payments.filter(
    (payment) => payment.kind === "payment" && !payment.verifiedAt
  );

  const verify = useApiMutation<{ paymentId: string; body: { reason: string } }, unknown>(
    ({ paymentId, body }, tenant) => ({
      path: `/tenants/${tenant}/finance/payments/${paymentId}/verify`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_id, tenant) => [
        `/tenants/${tenant}/finance/invoices/${invoiceId}`,
        `/tenants/${tenant}/finance/invoices/${invoiceId}/activity`,
        `/tenants/${tenant}/finance/invoices`,
        `/tenants/${tenant}/finance/payments`
      ],
      successMessage: t("paymentVerified")
    }
  );

  if (!canVerify || !unverified.length) {
    return null;
  }

  const closeVerify = () => {
    setVerifyTargetId(null);
    setVerifyReason("");
  };

  return (
    <>
      <section className="invoice-doc__verify">
        <div className="pds-type-body-m-medium invoice-doc__verify-head">
          <strong>{t("verifyPendingTitle")}</strong>
          <p className="pds-type-body-s-regular muted">{t("verifyPendingHelp")}</p>
        </div>
        <ul className="invoice-doc__verify-list">
          {unverified.map((payment) => (
            <li key={payment.id} className="invoice-doc__verify-item">
              <div className="invoice-doc__verify-main">
                <span>
                  {formatReceiptAmount(Number(payment.amount))} ({tPay(`paymentMethods.${payment.method}`)})
                </span>
                <StatusBadge status="pending" label={t("pendingVerification")} />
              </div>
              <p className="pds-type-body-s-regular muted invoice-doc__verify-meta">
                {t("paidAt")}: {formatCreatedAt(payment.paidAt)}
                {payment.referenceNumber ? (
                  <>
                    {" "}
                    · {t("transactionId")}: {payment.referenceNumber}
                  </>
                ) : null}
              </p>
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary btn-verify"
                disabled={verify.isPending}
                onClick={() => {
                  setVerifyTargetId(payment.id);
                  setVerifyReason("");
                }}
              >
                <Icon name="check_circle" />
                {t("verifyPaymentNow")}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {verifyTargetId ? (
        (() => {
          const target = unverified.find((payment) => payment.id === verifyTargetId) ?? null;
          return (
        <RecordFormSheet
          open={Boolean(verifyTargetId)}
          onOpenChange={(open) => {
            if (!open) closeVerify();
          }}
          title={t("verifyPaymentNow")}
          onSubmit={(event) => {
            event.preventDefault();
          }}
          footer={
            <>
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={closeVerify}>
                {c("cancel")}
              </button>
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                disabled={verify.isPending || !verifyReason.trim()}
                onClick={async () => {
                  if (!verifyTargetId) return;
                  await verify.mutateAsync({
                    paymentId: verifyTargetId,
                    body: { reason: verifyReason.trim() }
                  });
                  closeVerify();
                }}
              >
                <Icon name="check_circle" />
                {verify.isPending ? c("loading") : t("verifyPaymentNow")}
              </button>
            </>
          }
        >
          {target ? (
            <dl className="verify-summary">
              <div className="verify-summary__row">
                <dt className="pds-type-body-s-regular muted">{t("amount")}</dt>
                <dd className="pds-type-title-xxs-extrabold verify-summary__amount">
                  {formatReceiptAmount(Number(target.amount))}
                </dd>
              </div>
              <div className="verify-summary__row">
                <dt className="pds-type-body-s-regular muted">{t("method")}</dt>
                <dd className="pds-type-body-m-medium verify-summary__method">
                  <Icon name={METHOD_ICONS[target.method] ?? "payments"} size={16} />
                  {tPay(`paymentMethods.${target.method}`)}
                </dd>
              </div>
              <div className="verify-summary__row">
                <dt className="pds-type-body-s-regular muted">{t("transactionId")}</dt>
                <dd className="pds-type-body-m-medium">{target.referenceNumber ?? "—"}</dd>
              </div>
              <div className="verify-summary__row">
                <dt className="pds-type-body-s-regular muted">{t("paidAt")}</dt>
                <dd className="pds-type-body-m-medium">{formatCreatedAt(target.paidAt)}</dd>
              </div>
            </dl>
          ) : null}
          <Field label={t("verifyReason")}>
            <TextAreaInput
              rows={3}
              showCount={false}
              value={verifyReason}
              placeholder={t("verifyReasonPlaceholder")}
              onChange={(e) => setVerifyReason(e.target.value)}
            />
          </Field>
        </RecordFormSheet>
          );
        })()
      ) : null}
    </>
  );
}
