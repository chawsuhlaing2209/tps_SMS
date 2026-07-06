"use client";
import { FormInput, TextAreaInput } from "../../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApiMutation, useLiveApiQuery } from "../../../lib/api";
import { appendNavigationTrail } from "../../../lib/navigation-trail";
import { useDashPageTitleActionsTarget } from "../../dashboard-page-title";
import { fetchAllPaginated } from "../../../lib/export-csv";
import { getSession } from "../../../lib/session";
import { DirectoryMemberCell } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { PadaukTableWrap } from "../../../lib/padauk-table-wrap";
import { PaginationControls } from "../../../lib/pagination-controls";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { useTenantFormats } from "../../../lib/use-tenant-formats";
import { PageHeader } from "../../page-header-context";
import { FinanceTableShell } from "../finance-table-shell";
import { PdsSearchBar, PdsSearchFiltersRow, SegmentedControl } from "../../../../components/pds";
import { ExportCsvButton } from "../../../../components/shared/export-csv-button";
import { RowMoreActionsMenu, type RowMoreActionItem } from "../../../../components/shared/row-more-actions";

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
  paymentNumber: string | null;
  createdAt: string;
  billingMonth: string | null;
  paymentPlan: "enrollment" | "monthly" | "one_off";
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

function defaultPaidAtLocal() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

function PaymentsExportPortal({
  academicYearId,
  method,
  searchDebounced,
  loading,
  methodLabel
}: {
  academicYearId: string;
  method: MethodFilter;
  searchDebounced: string;
  loading: boolean;
  methodLabel: (method: string) => string;
}) {
  const t = useTranslations("finance.paymentList");
  const tFinance = useTranslations("finance");
  const tPay = useTranslations("enrollments");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <ExportCsvButton
      disabled={loading || !academicYearId}
      onExport={async () => {
        const tenantId = getSession()?.tenantId;
        if (!tenantId) {
          throw new Error("Not signed in.");
        }
        const rows = await fetchAllPaginated<PaymentRow>(
          (limit, offset) => {
            const params = new URLSearchParams({
              limit: String(limit),
              offset: String(offset)
            });
            if (academicYearId) params.set("academicYearId", academicYearId);
            if (method) params.set("method", method);
            if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
            return `/tenants/${tenantId}/finance/payments?${params.toString()}`;
          },
          (json) => {
            const payload = json as PaymentList;
            return { rows: payload.data, total: payload.total };
          }
        );
        return {
          filename: "payments.csv",
          columns: [
            { key: "receipt", header: t("receipt") },
            { key: "student", header: tFinance("student") },
            { key: "invoice", header: tFinance("invoiceNumber") },
            { key: "amount", header: tFinance("amount") },
            { key: "method", header: tPay("paymentMethod") },
            { key: "paidAt", header: t("date") },
            { key: "billingMonth", header: tFinance("billingMonth") }
          ],
          rows: rows.map((row) => ({
            receipt: row.receiptNumber ?? row.paymentNumber ?? row.id,
            student: row.studentFullName ?? "",
            invoice: row.invoiceNumber ?? "",
            amount: row.amount,
            method: methodLabel(row.method),
            paidAt: row.paidAt ?? "",
            billingMonth: row.billingMonth ?? ""
          }))
        };
      }}
    />,
    target
  );
}

export default function PaymentsPage() {
  const t = useTranslations("finance.paymentList");
  const tFinance = useTranslations("finance");
  const tPay = useTranslations("enrollments");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const router = useRouter();
  const { formatDate, formatDateTime, formatMonth, formatMoney } = useTenantFormats();

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

  const metrics = useLiveApiQuery<PaymentMetrics>((tenant) =>
    academicYearId ? `/tenants/${tenant}/finance/payments/metrics${metricsQuery}` : null
  );

  const payments = useLiveApiQuery<PaymentList>((tenant) =>
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
      <PageHeader title={t("title")} breadcrumbs={[{ label: nav("financeCrumb") }]} actionsPortal />
      <PaymentsExportPortal
        academicYearId={academicYearId}
        method={method}
        searchDebounced={searchDebounced}
        loading={payments.isLoading || currentYear.isLoading}
        methodLabel={(value) => tPay(`paymentMethods.${value}` as "paymentMethods.cash")}
      />

      <section className="fees-metrics" aria-label={t("title")}>
        <article className="fees-metric fees-metric--accent">
          <span className="pds-type-body-s-semibold fees-metric__label">
            <Icon name="account_balance_wallet" size={16} />
            {t("received")}
            {termName ? <span className="pds-type-caption-s fees-metric__chip">{termName}</span> : null}
          </span>
          <strong className="pds-type-title-m-extrabold fees-metric__value">
            {formatMoney(metricData?.receivedTotal ?? 0)}
          </strong>
          <span className="pds-type-body-s-regular fees-metric__sub">
            {t("transactionCount", { count: metricData?.receivedCount ?? 0 })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="pds-type-body-s-semibold fees-metric__label">
            <Icon name="today" size={16} />
            {t("today")}
          </span>
          <strong className="pds-type-title-m-extrabold fees-metric__value">{formatMoney(metricData?.todayTotal ?? 0)}</strong>
          <span className="pds-type-body-s-regular fees-metric__sub">
            {t("receiptsToday", { count: metricData?.todayCount ?? 0 })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="pds-type-body-s-semibold fees-metric__label">
            <Icon name="qr_code_2" size={16} />
            {t("topMethod")}
          </span>
          <strong className="pds-type-title-m-extrabold fees-metric__value fees-metric__value--compact">
            {topMethodLabel}
          </strong>
          <span className="pds-type-body-s-regular fees-metric__sub">
            {metricData?.topMethod
              ? t("methodShare", {
                  share: metricData.topMethodShare ?? 0
                })
              : "—"}
          </span>
        </article>

        <article className="fees-metric">
          <span className="pds-type-body-s-semibold fees-metric__label">
            <Icon name="trending_up" size={16} />
            {t("avgReceipt")}
          </span>
          <strong className="pds-type-title-m-extrabold fees-metric__value">
            {formatMoney(metricData?.averageReceipt ?? 0)}
          </strong>
          <span className="pds-type-body-s-regular fees-metric__sub">{t("perTransaction")}</span>
        </article>
      </section>

      <PdsSearchFiltersRow
        filters={
          <PdsSearchBar
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
        }
        statusControl={
          <SegmentedControl
            ariaLabel={tFinance("method")}
            value={method || "all"}
            onChange={(id) => {
              setMethod(id === "all" ? "" : (id as MethodFilter));
              setPage(0);
            }}
            options={METHOD_FILTERS.map((value) => ({
              id: value || "all",
              label: value ? t(`methodFilters.${value}`) : t("methodFilters.all")
            }))}
          />
        }
      />

      <FinanceTableShell
        loading={payments.isLoading || currentYear.isLoading}
        error={payments.isError}
        empty={!rows.length}
        emptyMessage={t("empty")}
      >
        <PadaukTableWrap>
          <table className="pds-type-body-m-medium padauk-table padauk-table--pinned-end">
            <thead>
              <tr>
                <th className="pds-type-caption-s">{t("paymentId")}</th>
                <th className="pds-type-caption-s">{t("created")}</th>
                <th className="pds-type-caption-s">{tFinance("billingMonth")}</th>
                <th className="pds-type-caption-s">{tFinance("paymentPlan")}</th>
                <th className="pds-type-caption-s">{t("date")}</th>
                <th className="pds-type-caption-s">{t("student")}</th>
                <th className="pds-type-caption-s">{tFinance("method")}</th>
                <th className="pds-type-caption-s padauk-table__num">{t("amountRecordedBy")}</th>
                <th className="pds-type-caption-s padauk-table__actions">{tFinance("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const gradeRoom = [row.gradeName, row.classroomName].filter(Boolean).join(" · ");
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.paymentNumber ?? row.receiptNumber ?? row.referenceNumber ?? "—"}</strong>
                    </td>
                    <td className="padauk-table__muted">{formatDateTime(row.createdAt)}</td>
                    <td>{formatMonth(row.billingMonth)}</td>
                    <td>{tFinance(`paymentPlanLabels.${row.paymentPlan}`)}</td>
                    <td className="padauk-table__muted">{formatDate(row.paidAt)}</td>
                    <td>
                      <DirectoryMemberCell
                        name={row.studentFullName ?? "—"}
                        subtitle={gradeRoom || "—"}
                      />
                    </td>
                    <td>
                      <span className={`pds-type-body-s-semibold fees-method fees-method--${row.method}`}>
                        <Icon name={METHOD_ICONS[row.method] ?? "payments"} size={14} />
                        {tPay(`paymentMethods.${row.method}`)}
                      </span>
                    </td>
                    <td className="padauk-table__num">
                      <div className="pds-type-body-s-regular padauk-table__stack">
                        <strong className="padauk-table__amount">
                          +{formatMoney(Number(row.amount))}
                        </strong>
                        <span>{row.recordedByName ?? "—"}</span>
                      </div>
                    </td>
                    <td className="padauk-table__actions">
                      {(() => {
                        const items: RowMoreActionItem[] = [];
                        if (!row.verifiedAt) {
                          items.push({
                            id: "verify",
                            label: tFinance("verifyPaymentNow"),
                            icon: "verified",
                            disabled: verify.isPending,
                            onSelect: () => openVerify(row)
                          });
                        }
                        if (
                          row.kind === "payment" &&
                          row.verifiedAt &&
                          (row.refundableAmount ?? 0) > 0
                        ) {
                          items.push({
                            id: "refund",
                            label: tFinance("refundPayment"),
                            icon: "undo",
                            onSelect: () => openRefund(row)
                          });
                        }
                        if (row.invoiceId) {
                          items.push({
                            id: "invoice",
                            label: t("viewInvoice"),
                            icon: "visibility",
                            onSelect: () => {
                              appendNavigationTrail({
                                label: t("title"),
                                href: "/dashboard/finance/payments"
                              });
                              router.push(`/dashboard/finance/invoices/${row.invoiceId}`);
                            }
                          });
                        }
                        if (!items.length) {
                          return <span className="muted">—</span>;
                        }
                        return <RowMoreActionsMenu ariaLabel={c("moreActions")} items={items} />;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PadaukTableWrap>
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
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={closeVerify}>
                {c("cancel")}
              </button>
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
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
          <dl className="verify-summary">
            <div className="verify-summary__row">
              <dt className="pds-type-body-s-regular muted">{tFinance("amount")}</dt>
              <dd className="pds-type-title-xxs-extrabold verify-summary__amount">
                {formatMoney(Number(verifyTarget.amount))}
              </dd>
            </div>
            <div className="verify-summary__row">
              <dt className="pds-type-body-s-regular muted">{tFinance("method")}</dt>
              <dd className="pds-type-body-m-medium verify-summary__method">
                <Icon name={METHOD_ICONS[verifyTarget.method] ?? "payments"} size={16} />
                {tPay(`paymentMethods.${verifyTarget.method}`)}
              </dd>
            </div>
            <div className="verify-summary__row">
              <dt className="pds-type-body-s-regular muted">{tFinance("transactionId")}</dt>
              <dd className="pds-type-body-m-medium">{verifyTarget.referenceNumber ?? "—"}</dd>
            </div>
            <div className="verify-summary__row">
              <dt className="pds-type-body-s-regular muted">{tFinance("paidAt")}</dt>
              <dd className="pds-type-body-m-medium">
                {formatDateTime(verifyTarget.paidAt)}
              </dd>
            </div>
          </dl>
          <Field label={tFinance("verifyReason")}>
            <TextAreaInput
              rows={3}
              showCount={false}
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
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={closeRefund}>
                {c("cancel")}
              </button>
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
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
            <FormInput
              type="number"
              step="0.01"
              min={0.01}
              max={maxRefund}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          </Field>
          <Field label={tFinance("paidAt")}>
            <FormInput
              type="datetime-local"
              value={refundPaidAt}
              onChange={(e) => setRefundPaidAt(e.target.value)}
            />
          </Field>
          {needsTxnId ? (
            <Field label={tFinance("transactionId")}>
              <FormInput
                value={refundTxnId}
                onChange={(e) => setRefundTxnId(e.target.value)}
                placeholder={tFinance("transactionIdPlaceholder")}
              />
            </Field>
          ) : null}
          <Field label={tFinance("refundReason")}>
            <FormInput
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
