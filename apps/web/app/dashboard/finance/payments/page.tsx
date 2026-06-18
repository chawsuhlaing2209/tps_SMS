"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/icon";
import { PaginationControls } from "../../../lib/pagination-controls";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";

type Payment = {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  kind: "payment" | "refund";
  amount: string;
  method: string;
  referenceNumber: string | null;
  paidAt: string | null;
  verifiedAt: string | null;
  notes: string | null;
  refundableAmount: number | null;
};

type PaymentList = { data: Payment[]; total: number; limit: number; offset: number };

const PAGE_SIZE = 50;

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function defaultPaidAtLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

export default function PaymentsPage() {
  const t = useTranslations("finance");
  const tPay = useTranslations("enrollments");
  const c = useTranslations("common");
  const [page, setPage] = useState(0);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundTxnId, setRefundTxnId] = useState("");
  const [refundPaidAt, setRefundPaidAt] = useState(defaultPaidAtLocal);
  const [verifyTarget, setVerifyTarget] = useState<Payment | null>(null);
  const [verifyReason, setVerifyReason] = useState("");

  const payments = useApiQuery<PaymentList>((tenant) =>
    `/tenants/${tenant}/finance/payments?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`
  );

  const refund = useApiMutation<
    { paymentId: string; body: { amount?: number; reason: string; transactionId?: string; paidAt?: string } },
    unknown
  >(
    ({ paymentId, body }, tenant) => ({
      path: `/tenants/${tenant}/finance/payments/${paymentId}/refund`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_v, tenant) => [
        `/tenants/${tenant}/finance/payments`,
        `/tenants/${tenant}/finance/invoices`
      ],
      successMessage: t("refundRecorded")
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
        `/tenants/${tenant}/finance/payments`,
        `/tenants/${tenant}/finance/invoices`
      ],
      successMessage: t("paymentVerified")
    }
  );

  const closeVerify = () => {
    setVerifyTarget(null);
    setVerifyReason("");
  };

  const openVerify = (payment: Payment) => {
    setVerifyTarget(payment);
    setVerifyReason("");
  };

  const openRefund = (payment: Payment) => {
    setRefundTarget(payment);
    setRefundAmount(String(payment.refundableAmount ?? payment.amount));
    setRefundReason("");
    setRefundTxnId("");
    setRefundPaidAt(defaultPaidAtLocal());
  };

  const closeRefund = () => {
    setRefundTarget(null);
    setRefundAmount("");
    setRefundReason("");
    setRefundTxnId("");
  };

  const columns: ColumnDef<Payment, unknown>[] = [
    {
      id: "invoice",
      header: t("invoiceNumber"),
      cell: ({ row }) =>
        row.original.invoiceNumber ? (
          <Link href={`/dashboard/finance/invoices/${row.original.invoiceId}`}>
            {row.original.invoiceNumber}
          </Link>
        ) : (
          "—"
        )
    },
    {
      id: "kind",
      header: t("paymentKind"),
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.kind === "refund" ? "archived" : "active"}`}>
          {row.original.kind === "refund" ? t("kindRefund") : t("kindPayment")}
        </span>
      )
    },
    {
      id: "amount",
      header: t("amount"),
      cell: ({ row }) =>
        row.original.kind === "refund" ? `−${row.original.amount}` : row.original.amount
    },
    {
      id: "method",
      header: t("method"),
      cell: ({ row }) => tPay(`paymentMethods.${row.original.method}`)
    },
    {
      id: "transactionId",
      header: t("transactionId"),
      accessorFn: (p) => p.referenceNumber ?? "—"
    },
    {
      id: "paidAt",
      header: t("paidAt"),
      accessorFn: (p) => formatDateTime(p.paidAt)
    },
    {
      id: "verified",
      header: t("verified"),
      accessorFn: (p) => (p.verifiedAt ? c("yes") : c("no"))
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => {
        const payment = row.original;

        return (
          <div className="row-actions">
            {!payment.verifiedAt ? (
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={verify.isPending}
                onClick={() => openVerify(payment)}
              >
                {t("verifyPaymentNow")}
              </button>
            ) : null}
            {payment.kind === "payment" && payment.verifiedAt && (payment.refundableAmount ?? 0) > 0 ? (
              <button type="button" className="btn-ghost btn-sm" onClick={() => openRefund(payment)}>
                {t("refundPayment")}
              </button>
            ) : null}
          </div>
        );
      }
    }
  ];

  const needsTxnId = refundTarget ? refundTarget.method !== "cash" : false;
  const maxRefund = refundTarget?.refundableAmount ?? 0;

  return (
    <section className="panel">
      <TablePanelHead title={t("payments")} onRefresh={() => void payments.refetch()} />
      <TablePanelBody
        loading={payments.isLoading}
        error={payments.isError ? c("somethingWrong") : null}
        empty={!payments.data?.data.length}
      >
        <DataTable columns={columns} data={payments.data?.data ?? []} />
      </TablePanelBody>
      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={payments.data?.total ?? 0}
        onPageChange={setPage}
      />

      {verifyTarget ? (
        <RecordFormSheet
          open={Boolean(verifyTarget)}
          onOpenChange={(open) => {
            if (!open) closeVerify();
          }}
          title={t("verifyPaymentNow")}
          help={verifyTarget.invoiceNumber ?? undefined}
          footer={
            <>
              <button type="button" className="btn-ghost" onClick={closeVerify}>
                {c("cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={verify.isPending || !verifyReason.trim()}
                onClick={async () => {
                  if (!verifyTarget) return;
                  await verify.mutateAsync({
                    paymentId: verifyTarget.id,
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

      {refundTarget ? (
        <RecordFormSheet
          open={Boolean(refundTarget)}
          onOpenChange={(open) => {
            if (!open) closeRefund();
          }}
          title={t("refundPayment")}
          help={
            refundTarget
              ? `${refundTarget.invoiceNumber ?? "—"} · ${refundTarget.amount} (${tPay(`paymentMethods.${refundTarget.method}`)})`
              : undefined
          }
          footer={
            <>
              <button type="button" className="btn-ghost" onClick={closeRefund}>
                {c("cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  refund.isPending ||
                  !refundReason.trim() ||
                  !refundAmount ||
                  Number(refundAmount) <= 0 ||
                  Number(refundAmount) > maxRefund ||
                  (needsTxnId && !refundTxnId.trim())
                }
                onClick={async () => {
                  if (!refundTarget) return;
                  await refund.mutateAsync({
                    paymentId: refundTarget.id,
                    body: {
                      amount: Number(refundAmount),
                      reason: refundReason.trim(),
                      transactionId: needsTxnId ? refundTxnId.trim() : undefined,
                      paidAt: new Date(refundPaidAt).toISOString()
                    }
                  });
                  closeRefund();
                }}
              >
                <Icon name="payments" />
                {refund.isPending ? c("loading") : t("recordRefund")}
              </button>
            </>
          }
        >
          <Field label={t("refundAmount")}>
            <input
              type="number"
              step="0.01"
              min={0.01}
              max={maxRefund}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          </Field>
          <Field label={t("paidAt")}>
            <input
              type="datetime-local"
              value={refundPaidAt}
              onChange={(e) => setRefundPaidAt(e.target.value)}
            />
          </Field>
          {needsTxnId ? (
            <Field label={t("transactionId")}>
              <input
                value={refundTxnId}
                onChange={(e) => setRefundTxnId(e.target.value)}
                placeholder={t("transactionIdPlaceholder")}
              />
            </Field>
          ) : null}
          <Field label={t("refundReason")}>
            <input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder={t("refundReasonPlaceholder")}
            />
          </Field>
        </RecordFormSheet>
      ) : null}
    </section>
  );
}
