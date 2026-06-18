"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DirectoryMemberCell } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { PaginationControls } from "../../../lib/pagination-controls";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { FinanceTableShell } from "../finance-table-shell";

type PaymentRow = {
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
  receiptNumber: string | null;
  studentFullName: string | null;
  studentId?: string;
  gradeName: string | null;
  classroomName: string | null;
  recordedByName: string | null;
};

type PaymentList = { data: PaymentRow[]; total: number; limit: number; offset: number };

type PaymentMetrics = {
  receivedTotal: number;
  receivedCount: number;
  todayTotal: number;
  todayCount: number;
  topMethod: string | null;
  topMethodShare: number;
  averageReceipt: number;
  termName: string | null;
};

type MethodFilter = "" | "kbzpay" | "wavepay" | "bank_transfer" | "cash";

const METHOD_FILTERS: MethodFilter[] = ["", "kbzpay", "wavepay", "bank_transfer", "cash"];
const PAGE_SIZE = 50;

const METHOD_ICONS: Record<string, string> = {
  kbzpay: "qr_code_2",
  wavepay: "account_balance_wallet",
  bank_transfer: "account_balance",
  cash: "payments"
};

function compactMMK(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function fullNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function defaultPaidAtLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

export default function PaymentsPage() {
  const t = useTranslations("finance.paymentList");
  const tFinance = useTranslations("finance");
  const tPay = useTranslations("enrollments");
  const nav = useTranslations("nav");
  const c = useTranslations("common");

  const currentYear = useCurrentAcademicYear();
  const academicYearId = currentYear.data?.id ?? "";

  const [method, setMethod] = useState<MethodFilter>("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [refundTarget, setRefundTarget] = useState<PaymentRow | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundTxnId, setRefundTxnId] = useState("");
  const [refundPaidAt, setRefundPaidAt] = useState(defaultPaidAtLocal);
  const [verifyTarget, setVerifyTarget] = useState<PaymentRow | null>(null);
  const [verifyReason, setVerifyReason] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const metricsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (academicYearId) params.set("academicYearId", academicYearId);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [academicYearId]);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE)
    });
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (method) params.set("method", method);
    if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
    return `?${params.toString()}`;
  }, [academicYearId, method, page, searchDebounced]);

  const metrics = useApiQuery<PaymentMetrics>((tenant) =>
    academicYearId ? `/tenants/${tenant}/finance/payments/metrics${metricsQuery}` : null
  );

  const payments = useApiQuery<PaymentList>((tenant) =>
    academicYearId ? `/tenants/${tenant}/finance/payments${listQuery}` : null
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
        `/tenants/${tenant}/finance/payments/metrics`,
        `/tenants/${tenant}/finance/invoices`
      ],
      successMessage: tFinance("refundRecorded")
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
        `/tenants/${tenant}/finance/payments/metrics`,
        `/tenants/${tenant}/finance/invoices`
      ],
      successMessage: tFinance("paymentVerified")
    }
  );

  const rows = payments.data?.data ?? [];
  const metricData = metrics.data;
  const termName = metricData?.termName ?? null;
  const topMethodLabel = metricData?.topMethod
    ? tPay(`paymentMethods.${metricData.topMethod}`)
    : "—";

  const closeVerify = () => {
    setVerifyTarget(null);
    setVerifyReason("");
  };

  const openVerify = (payment: PaymentRow) => {
    setVerifyTarget(payment);
    setVerifyReason("");
  };

  const openRefund = (payment: PaymentRow) => {
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

  const needsTxnId = refundTarget ? refundTarget.method !== "cash" : false;
  const maxRefund = refundTarget?.refundableAmount ?? 0;

  return (
    <div className="fees-page">
      <PageHeader title={t("title")} breadcrumbs={[{ label: nav("financeCrumb") }]} />

      <section className="fees-metrics" aria-label={t("title")}>
        <article className="fees-metric fees-metric--accent">
          <span className="fees-metric__label">
            <Icon name="account_balance_wallet" size={16} />
            {t("received")}
            {termName ? <span className="fees-metric__chip">{termName}</span> : null}
          </span>
          <strong className="fees-metric__value">
            {compactMMK(metricData?.receivedTotal ?? 0)}
          </strong>
          <span className="fees-metric__sub">
            {t("transactionCount", { count: metricData?.receivedCount ?? 0 })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="today" size={16} />
            {t("today")}
          </span>
          <strong className="fees-metric__value">{compactMMK(metricData?.todayTotal ?? 0)}</strong>
          <span className="fees-metric__sub">
            {t("receiptsToday", { count: metricData?.todayCount ?? 0 })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="qr_code_2" size={16} />
            {t("topMethod")}
          </span>
          <strong className="fees-metric__value fees-metric__value--compact">
            {topMethodLabel}
          </strong>
          <span className="fees-metric__sub">
            {metricData?.topMethod
              ? t("methodShare", {
                  share: metricData.topMethodShare ?? 0
                })
              : "—"}
          </span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="trending_up" size={16} />
            {t("avgReceipt")}
          </span>
          <strong className="fees-metric__value">
            {compactMMK(metricData?.averageReceipt ?? 0)}
          </strong>
          <span className="fees-metric__sub">{t("perTransaction")}</span>
        </article>
      </section>

      <section className="fees-toolbar">
        <div className="fees-search">
          <Icon name="search" size={18} className="fees-search__icon" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <div className="fees-segmented" role="tablist" aria-label={tFinance("method")}>
          {METHOD_FILTERS.map((value) => (
            <button
              key={value || "all"}
              type="button"
              role="tab"
              aria-selected={method === value}
              className={method === value ? "fees-segment fees-segment--active" : "fees-segment"}
              onClick={() => {
                setMethod(value);
                setPage(0);
              }}
            >
              {value ? t(`methodFilters.${value}`) : t("methodFilters.all")}
            </button>
          ))}
        </div>
      </section>

      <FinanceTableShell
        loading={payments.isLoading || currentYear.isLoading}
        error={payments.isError}
        empty={!rows.length}
        emptyMessage={t("empty")}
      >
        <div className="padauk-table-wrap">
          <table className="padauk-table">
            <thead>
              <tr>
                <th>{t("receipt")}</th>
                <th>{t("date")}</th>
                <th>{t("student")}</th>
                <th>{tFinance("method")}</th>
                <th className="padauk-table__num">{t("amountRecordedBy")}</th>
                <th className="padauk-table__actions">{tFinance("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const gradeRoom = [row.gradeName, row.classroomName].filter(Boolean).join(" · ");
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.receiptNumber ?? row.referenceNumber ?? "—"}</strong>
                    </td>
                    <td className="padauk-table__muted">{formatDate(row.paidAt)}</td>
                    <td>
                      <DirectoryMemberCell
                        name={row.studentFullName ?? "—"}
                        subtitle={gradeRoom || "—"}
                        colorKey={row.invoiceId}
                      />
                    </td>
                    <td>
                      <span className={`fees-method fees-method--${row.method}`}>
                        <Icon name={METHOD_ICONS[row.method] ?? "payments"} size={14} />
                        {tPay(`paymentMethods.${row.method}`)}
                      </span>
                    </td>
                    <td className="padauk-table__num">
                      <div className="padauk-table__stack">
                        <strong className="padauk-table__amount">
                          +{fullNumber(Number(row.amount))}
                        </strong>
                        <span>{row.recordedByName ?? "—"}</span>
                      </div>
                    </td>
                    <td className="padauk-table__actions">
                      <div className="table-row-actions">
                        {!row.verifiedAt ? (
                          <button
                            type="button"
                            className="table-row-action table-row-action--primary"
                            disabled={verify.isPending}
                            onClick={() => openVerify(row)}
                          >
                            {tFinance("verifyPaymentNow")}
                          </button>
                        ) : null}
                        {row.kind === "payment" &&
                        row.verifiedAt &&
                        (row.refundableAmount ?? 0) > 0 ? (
                          <button
                            type="button"
                            className="table-row-action"
                            onClick={() => openRefund(row)}
                          >
                            {tFinance("refundPayment")}
                          </button>
                        ) : null}
                        {row.invoiceId ? (
                          <Link
                            href={`/dashboard/finance/invoices/${row.invoiceId}`}
                            className="table-row-action"
                          >
                            <Icon name="visibility" size={16} />
                            {t("viewInvoice")}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FinanceTableShell>

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
          title={tFinance("verifyPaymentNow")}
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
                {verify.isPending ? c("loading") : tFinance("verifyPaymentNow")}
              </button>
            </>
          }
        >
          <Field label={tFinance("verifyReason")}>
            <textarea
              rows={3}
              value={verifyReason}
              placeholder={tFinance("verifyReasonPlaceholder")}
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
          title={tFinance("refundPayment")}
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
                {refund.isPending ? c("loading") : tFinance("recordRefund")}
              </button>
            </>
          }
        >
          <Field label={tFinance("refundAmount")}>
            <input
              type="number"
              step="0.01"
              min={0.01}
              max={maxRefund}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          </Field>
          <Field label={tFinance("paidAt")}>
            <input
              type="datetime-local"
              value={refundPaidAt}
              onChange={(e) => setRefundPaidAt(e.target.value)}
            />
          </Field>
          {needsTxnId ? (
            <Field label={tFinance("transactionId")}>
              <input
                value={refundTxnId}
                onChange={(e) => setRefundTxnId(e.target.value)}
                placeholder={tFinance("transactionIdPlaceholder")}
              />
            </Field>
          ) : null}
          <Field label={tFinance("refundReason")}>
            <input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder={tFinance("refundReasonPlaceholder")}
            />
          </Field>
        </RecordFormSheet>
      ) : null}
    </div>
  );
}
