"use client";

import { paymentMethods } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { Field } from "../../../../lib/form";
import { Icon } from "../../../../lib/material-icon";
import { toastSuccess } from "../../../../lib/toast";
import { hasAnyPermission } from "../../../../lib/permissions";
import { getSession } from "../../../../lib/session";
import { PageHeader } from "../../../page-header-context";
import { StatusBadge } from "../../../../../components/shared/badge";
import {
  InvoiceDocumentBody,
  mapInvoiceDetailToDocument,
  printInvoiceDocument
} from "../../invoice-document";
import {
  PaymentReceiptDocument,
  printPaymentReceipt,
  formatReceiptAmount,
  type PaymentReceiptPayload
} from "../../receipt-document";

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  subtotal: string;
  discountTotal: string;
  total: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  studentFullName: string;
  gradeName: string | null;
  classroomName: string | null;
  room: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  schoolName: string;
  schoolAddress: string | null;
  schoolContactPhone: string | null;
  academicYearName: string;
  termName: string | null;
  items: Array<{ id: string; description: string; unitAmount: string; quantity: string; total?: string }>;
  discountLines: Array<{
    id: string;
    name: string;
    amount: string;
    source: string;
    stackable: boolean;
    eligibilityReason: string | null;
  }>;
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

type RecordPaymentResult = {
  payment: { id: string };
  receipt: PaymentReceiptPayload;
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
  const tDoc = useTranslations("finance.invoiceDocument");
  const tReceipt = useTranslations("finance.receipt");
  const tPay = useTranslations("enrollments");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [transactionId, setTransactionId] = useState("");
  const [paidAt, setPaidAt] = useState(defaultPaidAtLocal);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceiptPayload | null>(null);

  const canVerifyPayments = hasAnyPermission(getSession()?.permissions, ["finance.manage"]);

  const invoice = useApiQuery<InvoiceDetail>(
    (tenant) => `/tenants/${tenant}/finance/invoices/${invoiceId}`
  );

  const pay = useApiMutation<
    { amount: number; method: string; referenceNumber?: string; paidAt?: string },
    RecordPaymentResult
  >(
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
      showSuccessToast: false
    }
  );

  const send = useApiMutation<undefined, { sent: boolean }>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/finance/invoices/${invoiceId}/send-guardian`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    { showSuccessToast: false }
  );

  const data = invoice.data;
  const document = useMemo(() => (data ? mapInvoiceDetailToDocument(data) : null), [data]);

  const verifiedTotal = document?.paidToDate ?? 0;
  const remaining = document?.balanceDue ?? 0;
  const canRecordPayment = data ? !CLOSED_STATUSES.has(data.status) : false;
  const needsTxnId = method !== "cash";

  const printLabels = {
    billedTo: tDoc("billedTo"),
    title: tDoc("title"),
    subtotalBilled: tDoc("subtotalBilled"),
    paidToDate: tDoc("paidToDate"),
    balanceDue: tDoc("balanceDue"),
    dueOn: (date: string) => tDoc("dueOn", { date })
  };

  const handlePrint = () => {
    if (!document) return;
    printInvoiceDocument(document, printLabels);
  };

  const handleSend = async () => {
    await send.mutateAsync(undefined);
    toastSuccess(tDoc("sentToGuardian"));
  };

  const printReceipt = () => {
    if (!paymentReceipt) return;
    printPaymentReceipt(paymentReceipt, {
      header: tReceipt("officialHeader"),
      receiptLabel: tReceipt("numberLabel"),
      student: tReceipt("student"),
      gradeRoom: tReceipt("gradeRoom"),
      guardian: tReceipt("guardian"),
      contact: tReceipt("contact"),
      methodLabel: tReceipt("method"),
      appliedTo: tReceipt("appliedTo"),
      reference: tReceipt("reference"),
      cashier: tReceipt("cashier"),
      amountPaid: tReceipt("amountPaid"),
      remaining: tReceipt("remainingBalance"),
      methodName: tPay(`paymentMethods.${paymentReceipt.method}`)
    });
  };

  if (invoice.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (invoice.isError || !data || !document) {
    return (
      <div className="page-stack">
        <p className="error-text">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="page-stack invoice-page">
      <PageHeader
        title={data.invoiceNumber}
        breadcrumbs={[
          { label: nav("finance"), href: "/dashboard/finance/billing" },
          { label: t("invoices"), href: "/dashboard/finance/invoices" },
          { label: data.invoiceNumber }
        ]}
      />

      {paymentReceipt ? (
        <section className="invoice-receipt-confirmation">
          <PaymentReceiptDocument
            receipt={paymentReceipt}
            methodName={tPay(`paymentMethods.${paymentReceipt.method}`)}
            onPrint={printReceipt}
            title={tReceipt("title")}
            subtitle={`${tReceipt("numberLabel")} #${paymentReceipt.receiptNumber} · ${paymentReceipt.issuedAt.slice(0, 10)}`}
            documentLabel={tReceipt("officialHeader")}
            footer={
              <footer className="invoice-receipt-confirmation__actions">
                <button type="button" className="btn-ghost" onClick={() => setPaymentReceipt(null)}>
                  {tReceipt("backToInvoice")}
                </button>
                <button type="button" className="btn-primary" onClick={printReceipt}>
                  <Icon name="print" size={18} />
                  {tReceipt("print")}
                </button>
              </footer>
            }
          />
        </section>
      ) : (
        <>
          <article className="invoice-doc invoice-doc--page">
            <InvoiceDocumentBody
              data={document}
              onPrint={handlePrint}
              onSend={handleSend}
              sendPending={send.isPending}
              canVerifyPayments={canVerifyPayments}
            />
          </article>

          <section className="panel invoice-document__payments">
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
                        {formatReceiptAmount(Number(payment.amount))} ({tPay(`paymentMethods.${payment.method}`)})
                      </span>
                      {payment.kind === "refund" ? (
                        <StatusBadge status="refund" label={t("kindRefund")} />
                      ) : payment.verifiedAt ? (
                        <StatusBadge status="verified" label={t("verified")} />
                      ) : (
                        <StatusBadge status="pending" label={t("pendingVerification")} />
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
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canRecordPayment ? (
            <section className="panel invoice-record-form">
              <h3>{t("recordPayment")}</h3>
              <div className="entity-form">
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
                      const result = await pay.mutateAsync({
                        amount: Number(amount),
                        method,
                        referenceNumber: needsTxnId ? transactionId.trim() : undefined,
                        paidAt: new Date(paidAt).toISOString()
                      });
                      setPaymentReceipt(result.receipt);
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
            </section>
          ) : (
            <p className="muted">{t("invoiceClosedNoPayment")}</p>
          )}
        </>
      )}
    </div>
  );
}
