"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  canRecordInvoicePayment,
  computeRecordablePaymentBalance,
  sumPendingVerificationAmount
} from "@sms/shared";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { Icon } from "../../../../lib/material-icon";
import { toastSuccess } from "../../../../lib/toast";
import { hasAnyPermission } from "../../../../lib/permissions";
import { getSession } from "../../../../lib/session";
import { PageHeader } from "../../../page-header-context";
import { StatusBadge } from "../../../../../components/shared/badge";
import { EmptyState } from "../../../../../components/shared/empty-state";
import { NavigationBackLink } from "../../../../../components/shared/navigation-back-link";
import {
  InvoiceDocumentBody,
  mapInvoiceDetailToDocument,
  printInvoiceDocument
} from "../../invoice-document";
import { useTenantFormats } from "../../../../lib/use-tenant-formats";
import { formatCreatedAt } from "../../format-finance";
import {
  RecordPaymentModal,
  type InvoicePaymentContext
} from "./record-payment-modal";
import { InvoiceActivityPanel } from "./invoice-activity-panel";

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

/**
 * Full invoice detail (document + payments + record payment + activity log).
 * Shared by the standalone page (`variant="page"`) and the intercepting-route
 * modal (`variant="modal"`). In modal mode the page chrome — breadcrumb header
 * and back link — is omitted since the modal floats over the originating list.
 */
export function InvoiceDetailView({
  invoiceId,
  variant = "page"
}: {
  invoiceId: string;
  variant?: "page" | "modal";
}) {
  const t = useTranslations("finance");
  const tDoc = useTranslations("finance.invoiceDocument");
  const tFees = useTranslations("finance.feesBilling");
  const tPay = useTranslations("enrollments");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const [payModalOpen, setPayModalOpen] = useState(false);
  const isModal = variant === "modal";
  const { formatMoney, preferences } = useTenantFormats();

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
  const pendingVerification = useMemo(
    () => (data ? sumPendingVerificationAmount(data.payments) : 0),
    [data]
  );
  const recordableBalance = computeRecordablePaymentBalance(remaining, pendingVerification);
  const canRecordPayment = data
    ? canRecordInvoicePayment({
        balanceDue: remaining,
        pendingVerificationAmount: pendingVerification,
        isClosed: CLOSED_STATUSES.has(data.status)
      })
    : false;
  const pendingBlocksRecord = Boolean(data && remaining > 0 && !canRecordPayment && pendingVerification > 0);

  const paymentContext: InvoicePaymentContext | null = useMemo(() => {
    if (!data || !document) return null;
    return {
      invoiceNumber: data.invoiceNumber,
      studentFullName: data.studentFullName,
      balanceDue: remaining,
      billed: document.subtotal,
      paid: verifiedTotal,
      pendingVerification,
      recordableBalance
    };
  }, [data, document, remaining, verifiedTotal, pendingVerification, recordableBalance]);

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

  const invoiceStatusLabel = tFees.has(`statusLabels.${data.status}`)
    ? tFees(`statusLabels.${data.status}`)
    : data.status;

  return (
    <div className="page-stack invoice-page">
      {isModal ? null : (
        <>
          <PageHeader
            title={data.invoiceNumber}
            segment={{ label: data.invoiceNumber, href: `/dashboard/finance/invoices/${invoiceId}` }}
            breadcrumbs={[
              { label: nav("finance"), href: "/dashboard/finance/invoices" },
              { label: t("invoices"), href: "/dashboard/finance/invoices" },
              { label: data.invoiceNumber }
            ]}
          />

          <NavigationBackLink fallback={{ label: t("invoices"), href: "/dashboard/finance/invoices" }} />
        </>
      )}

      <div className="invoice-page__meta">
        <StatusBadge status={data.status} label={invoiceStatusLabel} />
        {data.status === "refunded" ? (
          <p className="pds-type-body-s-regular muted">{t("invoiceRefundedNotice")}</p>
        ) : null}
      </div>

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
                    {formatMoney(Number(payment.amount))} (
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
                  {t("paidAt")}: {formatCreatedAt(payment.paidAt, preferences)}
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
        {pendingBlocksRecord ? (
          <p className="pds-type-body-s-regular muted">{t("recordPaymentFullyPending")}</p>
        ) : null}
        {canRecordPayment && pendingVerification > 0 ? (
          <p className="pds-type-body-s-regular muted">
            {t("recordPaymentPartialPending", {
              pending: formatMoney(pendingVerification),
              recordable: formatMoney(recordableBalance)
            })}
          </p>
        ) : null}
        {canRecordPayment && pendingVerification <= 0 ? (
          <p className="pds-type-body-s-regular muted">{t("refundOnPaymentsTab")}</p>
        ) : null}
      </section>

      <InvoiceActivityPanel invoiceId={invoiceId} />

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
