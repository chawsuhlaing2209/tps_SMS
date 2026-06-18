"use client";

import { paymentMethods } from "@sms/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { Field } from "../../../../lib/form";
import { Icon } from "../../../../lib/icon";
import { RecordFormSheet } from "../../../../lib/record-sheet";
import { PageHeader } from "../../../page-header-context";

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  total: string;
  status: string;
  items: Array<{ id: string; description: string; unitAmount: string; quantity: number }>;
  payments: Array<{
    id: string;
    kind: "payment" | "refund";
    amount: string;
    method: string;
    referenceNumber: string | null;
    paidAt: string | null;
    verifiedAt: string | null;
  }>;
};

const CLOSED_STATUSES = new Set(["paid", "cancelled", "waived", "refunded"]);

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function defaultPaidAtLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params.invoiceId;
  const t = useTranslations("finance");
  const tPay = useTranslations("enrollments");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [transactionId, setTransactionId] = useState("");
  const [paidAt, setPaidAt] = useState(defaultPaidAtLocal);
  const [verifyTargetId, setVerifyTargetId] = useState<string | null>(null);
  const [verifyReason, setVerifyReason] = useState("");

  const invoice = useApiQuery<InvoiceDetail>(
    (tenant) => `/tenants/${tenant}/finance/invoices/${invoiceId}`
  );

  const pay = useApiMutation<{
    amount: number;
    method: string;
    referenceNumber?: string;
    paidAt?: string;
  }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/finance/invoices/${invoiceId}/payments`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/finance/invoices/${invoiceId}`,
        `/tenants/${tenant}/finance/invoices`,
        `/tenants/${tenant}/finance/payments`
      ],
      successMessage: t("paymentRecorded")
    }
  );

  const verify = useApiMutation<
    { paymentId: string; body: { reason: string } },
    unknown
  >(
    ({ paymentId, body }, tenant) => ({
      path: `/tenants/${tenant}/finance/payments/${paymentId}/verify`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_id, tenant) => [
        `/tenants/${tenant}/finance/invoices/${invoiceId}`,
        `/tenants/${tenant}/finance/invoices`,
        `/tenants/${tenant}/finance/payments`
      ],
      successMessage: t("paymentVerified")
    }
  );

  if (invoice.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (invoice.isError || !invoice.data) {
    return (
      <div className="page-stack">
        <p className="error-text">{t("notFound")}</p>
        <Link href="/dashboard/finance/invoices">{t("backToInvoices")}</Link>
      </div>
    );
  }

  const data = invoice.data;
  const canRecordPayment = !CLOSED_STATUSES.has(data.status);
  const verifiedTotal = data.payments.reduce((sum, payment) => {
    if (!payment.verifiedAt) return sum;
    const value = Number(payment.amount);
    return payment.kind === "refund" ? sum - value : sum + value;
  }, 0);
  const remaining = Math.max(0, Number(data.total) - verifiedTotal);
  const unverifiedPayments = data.payments.filter(
    (payment) => payment.kind === "payment" && !payment.verifiedAt
  );
  const needsTxnId = method !== "cash";

  return (
    <div className="page-stack">
      <PageHeader
        title={data.invoiceNumber}
        breadcrumbs={[
          { label: nav("group_business") },
          { label: t("invoices"), href: "/dashboard/finance/invoices" }
        ]}
        backHref="/dashboard/finance/invoices"
        backLabel={t("backToInvoices")}
      />
      <section className="panel">
        <div className="panel-head">
          <h2>{data.invoiceNumber}</h2>
        </div>
        <p>
          {c("status")}:{" "}
          <span className={`badge badge--${data.status}`}>{data.status}</span> · {t("total")}:{" "}
          {data.total}
          {canRecordPayment ? (
            <>
              {" "}
              · {t("remainingBalance")}: {remaining}
            </>
          ) : null}
        </p>

        {unverifiedPayments.length ? (
          <div className="verify-banner" role="status">
            <strong>{t("verifyPendingTitle")}</strong>
            <p className="muted">{t("verifyPendingHelp")}</p>
          </div>
        ) : null}

        <h3>{t("lineItems")}</h3>
        <ul>
          {data.items.map((item) => (
            <li key={item.id}>
              {item.description} — {item.unitAmount} × {item.quantity}
            </li>
          ))}
        </ul>

        <h3>{t("payments")}</h3>
        {!data.payments.length ? (
          <p className="muted">{t("noPayments")}</p>
        ) : (
          <ul className="payment-list">
            {data.payments.map((payment) => (
              <li
                key={payment.id}
                className={
                  payment.kind === "refund"
                    ? "payment-row payment-row--refund"
                    : payment.verifiedAt
                      ? "payment-row payment-row--verified"
                      : "payment-row payment-row--pending"
                }
              >
                <div className="payment-row__main">
                  <span>
                    {payment.kind === "refund" ? "−" : ""}
                    {payment.amount} ({tPay(`paymentMethods.${payment.method}`)})
                  </span>
                  {payment.kind === "refund" ? (
                    <span className="badge badge--archived">{t("kindRefund")}</span>
                  ) : payment.verifiedAt ? (
                    <span className="badge badge--active">{t("verified")}</span>
                  ) : (
                    <span className="badge badge--pending">{t("pendingVerification")}</span>
                  )}
                </div>
                <p className="muted payment-row__meta">
                  {t("paidAt")}: {formatDateTime(payment.paidAt)}
                  {payment.referenceNumber ? (
                    <>
                      {" "}
                      · {t("transactionId")}: {payment.referenceNumber}
                    </>
                  ) : null}
                </p>
                {payment.kind === "payment" && !payment.verifiedAt ? (
                  <button
                    type="button"
                    className="btn-primary btn-verify"
                    disabled={verify.isPending}
                    onClick={() => {
                      setVerifyTargetId(payment.id);
                      setVerifyReason("");
                    }}
                  >
                    <Icon name="check_circle" />
                    {t("verifyPaymentNow")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canRecordPayment ? (
          <div className="entity-form">
            <h3>{t("recordPayment")}</h3>
            <Field label={t("amount")}>
              <input
                type="number"
                step="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label={t("method")}>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {paymentMethods.map((option) => (
                  <option key={option} value={option}>
                    {tPay(`paymentMethods.${option}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("paidAt")}>
              <input
                type="datetime-local"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </Field>
            {needsTxnId ? (
              <Field label={t("transactionId")}>
                <input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder={t("transactionIdPlaceholder")}
                />
              </Field>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={
                  !amount ||
                  pay.isPending ||
                  Number(amount) <= 0 ||
                  Number(amount) > remaining ||
                  (needsTxnId && !transactionId.trim())
                }
                onClick={async () => {
                  await pay.mutateAsync({
                    amount: Number(amount),
                    method,
                    referenceNumber: needsTxnId ? transactionId.trim() : undefined,
                    paidAt: new Date(paidAt).toISOString()
                  });
                  setAmount("");
                  setTransactionId("");
                  setPaidAt(defaultPaidAtLocal());
                }}
              >
                <Icon name="payments" />
                {pay.isPending ? c("loading") : t("recordPayment")}
              </button>
            </div>
            <p className="muted">{t("refundOnPaymentsTab")}</p>
          </div>
        ) : (
          <p className="muted">{t("invoiceClosedNoPayment")}</p>
        )}
      </section>

      {verifyTargetId ? (
        <RecordFormSheet
          open={Boolean(verifyTargetId)}
          onOpenChange={(open) => {
            if (!open) {
              setVerifyTargetId(null);
              setVerifyReason("");
            }
          }}
          title={t("verifyPaymentNow")}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setVerifyTargetId(null);
                  setVerifyReason("");
                }}
              >
                {c("cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={verify.isPending || !verifyReason.trim()}
                onClick={async () => {
                  if (!verifyTargetId) return;
                  await verify.mutateAsync({
                    paymentId: verifyTargetId,
                    body: { reason: verifyReason.trim() }
                  });
                  setVerifyTargetId(null);
                  setVerifyReason("");
                }}
              >
                <Icon name="check_circle" />
                {verify.isPending ? c("loading") : t("verifyPaymentNow")}
              </button>
            </>
          }
        >
          <Field label={t("verifyReason")}>
            <textarea
              rows={3}
              value={verifyReason}
              placeholder={t("verifyReasonPlaceholder")}
              onChange={(e) => setVerifyReason(e.target.value)}
            />
          </Field>
        </RecordFormSheet>
      ) : null}
    </div>
  );
}
