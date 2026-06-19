"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { Icon } from "../../../../lib/material-icon";
import { toastSuccess } from "../../../../lib/toast";
import { hasAnyPermission } from "../../../../lib/permissions";
import { getSession } from "../../../../lib/session";
import { PageHeader } from "../../../page-header-context";
import { StatusBadge } from "../../../../../components/shared/badge";
import { EmptyState } from "../../../../../components/shared/empty-state";
import {
  InvoiceDocumentBody,
  mapInvoiceDetailToDocument,
  printInvoiceDocument
} from "../../invoice-document";
import { formatReceiptAmount } from "../../receipt-document";
import {
  RecordPaymentModal,
  type InvoicePaymentContext
} from "../_components/record-payment-modal";

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

const CLOSED_STATUSES = new Set(["paid", "cancelled", "waived", "refunded"]);

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params.invoiceId;
  const t = useTranslations("finance");
  const tDoc = useTranslations("finance.invoiceDocument");
  const tPay = useTranslations("enrollments");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const [payModalOpen, setPayModalOpen] = useState(false);

  const canVerifyPayments = hasAnyPermission(getSession()?.permissions, ["finance.manage"]);

  const invoice = useApiQuery<InvoiceDetail>(
    (tenant) => `/tenants/${tenant}/finance/invoices/${invoiceId}`
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
  const canRecordPayment = data ? !CLOSED_STATUSES.has(data.status) && remaining > 0 : false;

  const paymentContext: InvoicePaymentContext | null = useMemo(() => {
    if (!data || !document) return null;
    return {
      invoiceNumber: data.invoiceNumber,
      studentFullName: data.studentFullName,
      balanceDue: remaining,
      billed: document.subtotal,
      paid: verifiedTotal
    };
  }, [data, document, remaining, verifiedTotal]);

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

  if (invoice.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (invoice.isError || !data || !document || !paymentContext) {
    return (
      <div className="page-stack">
        <p className="pds-type-body-m-medium error-text">{t("notFound")}</p>
      </div>
    );
  }

  return (
    <div className="page-stack invoice-page">
      <PageHeader
        title={data.invoiceNumber}
        breadcrumbs={[
          { label: nav("finance"), href: "/dashboard/finance/invoices" },
          { label: t("invoices"), href: "/dashboard/finance/invoices" },
          { label: data.invoiceNumber }
        ]}
      />

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
        <div className="invoice-payments-head">
          <h3 className="pds-type-title-xxs-extrabold">{t("payments")}</h3>
          {canRecordPayment ? (
            <button type="button" className="pds-type-body-m-bold btn-primary" onClick={() => setPayModalOpen(true)}>
              <Icon name="point_of_sale" size={18} />
              {t("recordPayment")}
            </button>
          ) : null}
        </div>
        {!data.payments.length ? (
          <EmptyState compact embedded icon="payments" title={t("noPayments")} />
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
                    {formatReceiptAmount(Number(payment.amount))} (
                    {tPay(`paymentMethods.${payment.method}`)})
                  </span>
                  {payment.kind === "refund" ? (
                    <StatusBadge status="refund" label={t("kindRefund")} />
                  ) : payment.verifiedAt ? (
                    <StatusBadge status="verified" label={t("verified")} />
                  ) : (
                    <StatusBadge status="pending" label={t("pendingVerification")} />
                  )}
                </div>
                <p className="pds-type-body-s-regular muted payment-row__meta">
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
        {!canRecordPayment && CLOSED_STATUSES.has(data.status) ? (
          <p className="pds-type-body-s-regular muted">{t("invoiceClosedNoPayment")}</p>
        ) : null}
        {canRecordPayment ? <p className="pds-type-body-s-regular muted">{t("refundOnPaymentsTab")}</p> : null}
      </section>

      <RecordPaymentModal
        open={payModalOpen}
        onOpenChange={setPayModalOpen}
        variant="invoice"
        invoiceId={invoiceId}
        context={paymentContext}
        onCollected={() => void invoice.refetch()}
      />
    </div>
  );
}
