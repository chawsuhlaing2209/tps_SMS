"use client";

import { useTranslations } from "next-intl";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { toastSuccess } from "../../../lib/toast";
import {
  InvoiceDocumentBody,
  InvoicePreviewModal,
  mapInvoiceDetailToDocument,
  printInvoiceDocument,
  type InvoiceDocumentData
} from "../invoice-document";

type InvoiceDetail = {
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
  schoolAddress: string | null;
  schoolContactPhone: string | null;
  items: Array<{ id: string; description: string; unitAmount: string; quantity: string; total?: string }>;
  discountLines: Array<{ id: string; name: string; amount: string }>;
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

export function BillingInvoicePreviewModal({
  invoiceId,
  open,
  onOpenChange
}: {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("finance.invoiceDocument");
  const c = useTranslations("common");
  const canVerifyPayments = hasAnyPermission(getSession()?.permissions, ["finance.manage"]);

  const invoice = useApiQuery<InvoiceDetail>(
    (tenant) =>
      open && invoiceId ? `/tenants/${tenant}/finance/invoices/${invoiceId}` : null
  );

  const send = useApiMutation<undefined, { sent: boolean }>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/finance/invoices/${invoiceId}/send-guardian`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    { showSuccessToast: false }
  );

  const doc: InvoiceDocumentData | null = invoice.data
    ? mapInvoiceDetailToDocument(invoice.data)
    : null;

  const handlePrint = () => {
    if (!doc) return;
    printInvoiceDocument(doc, {
      billedTo: t("billedTo"),
      title: t("title"),
      subtotalBilled: t("subtotalBilled"),
      paidToDate: t("paidToDate"),
      balanceDue: t("balanceDue"),
      dueOn: (date) => t("dueOn", { date })
    });
  };

  const handleSend = async () => {
    if (!invoiceId) return;
    await send.mutateAsync(undefined);
    toastSuccess(t("sentToGuardian"));
  };

  return (
    <InvoicePreviewModal
      invoiceId={invoiceId}
      open={open}
      onOpenChange={onOpenChange}
    >
      {invoice.isLoading ? (
        <p className="invoice-modal__state muted">{c("loading")}</p>
      ) : invoice.isError || !doc ? (
        <p className="invoice-modal__state error-text">{c("somethingWrong")}</p>
      ) : (
        <InvoiceDocumentBody
          data={doc}
          isModal
          onClose={() => onOpenChange(false)}
          onPrint={handlePrint}
          onSend={handleSend}
          sendPending={send.isPending}
          canVerifyPayments={canVerifyPayments}
        />
      )}
    </InvoicePreviewModal>
  );
}
