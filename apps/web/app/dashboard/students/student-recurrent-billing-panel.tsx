"use client";

import { useTranslations } from "next-intl";
import { formatMMK } from "../../lib/money";
import Link from "next/link";
import { TrailLink } from "../../../components/shared/trail-link";
import { useState } from "react";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { EmptyState } from "../../../components/shared/empty-state";
import { SelectionCard } from "../../../components/shared/selection-card";
import { StatCard, StatGrid } from "../../../components/shared/stat-card";
import { DomainStatusPill } from "../../../components/pds/subcomponents/status-pill";
import { useApiMutation } from "../../lib/api";
import { Icon } from "../../lib/material-icon";
import { toastSuccess } from "../../lib/toast";
import { BillingInvoicePreviewModal } from "../finance/invoices/_components/invoice-preview-modal";
import { StudentAddServiceSheet } from "./student-add-service-sheet";

export type RecurrentBillingInvoice = {
  id: string;
  invoiceNumber: string;
  source: "enrollment" | "recurring" | "ad_hoc";
  total: string;
  status: string;
};

export type RecurrentBillingService = {
  id: string;
  feeItemId: string;
  feeItemName: string;
  billingType: string;
  effectiveFrom: string;
  monthlyAmount?: number | null;
};

export type StudentRecurrentBillingData = {
  totalOutstanding: number;
  totalPaid: number;
  invoices: RecurrentBillingInvoice[];
  activeServices: RecurrentBillingService[];
};

function formatMoney(value: number): string {
  return formatMMK(value);
}

const DEFAULT_CURRENCY = "MMK";

function serviceIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("transport") || lower.includes("bus")) {
    return "directions_bus";
  }
  if (lower.includes("meal") || lower.includes("lunch")) {
    return "restaurant";
  }
  return "handshake";
}

type Props = {
  studentId: string;
  studentName: string;
  data: StudentRecurrentBillingData | undefined;
  loading: boolean;
  error: boolean;
  canManage: boolean;
  onRefresh: () => void;
};

export function StudentRecurrentBillingPanel({
  studentId,
  studentName,
  data,
  loading,
  error,
  canManage,
  onRefresh
}: Props) {
  const t = useTranslations("students");
  const f = useTranslations("finance");
  const tServices = useTranslations("finance.studentServices");
  const c = useTranslations("common");

  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const removeService = useApiMutation<string, { removed: boolean }>(
    (serviceId, tenant) => ({
      path: `/tenants/${tenant}/student-services/${serviceId}`,
      init: { method: "DELETE" }
    }),
    {
      invalidatePaths: (_, tenant) => [
        `/tenants/${tenant}/finance/students/${studentId}/summary`,
        `/tenants/${tenant}/student-services`
      ]
    }
  );

  async function confirmRemove() {
    if (!removeId) {
      return;
    }
    await removeService.mutateAsync(removeId);
    toastSuccess(tServices("removed"));
    setRemoveId(null);
    onRefresh();
  }

  if (loading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (error) {
    return <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>;
  }

  if (!data) {
    return null;
  }

  return (
    <>
      <div className="student-recurrent-billing">
        <StatGrid>
          <StatCard
            layout
            label={f("totalOutstanding")}
            value={formatMoney(data.totalOutstanding)}
            hint={DEFAULT_CURRENCY}
          />
          <StatCard
            dark
            label={f("totalPaid")}
            value={formatMoney(data.totalPaid)}
            hint={DEFAULT_CURRENCY}
          />
        </StatGrid>

        <h3 className="pds-type-caption-s student-recurrent-billing__section-label">
          {t("invoiceHistory")}
        </h3>

        {!data.invoices.length ? (
          <EmptyState compact embedded icon="receipt_long" title={f("noInvoices")} />
        ) : (
          <ul className="student-recurrent-billing__invoices">
            {data.invoices.map((invoice) => (
              <li key={invoice.id} className="student-recurrent-billing__invoice-row">
                <div className="student-recurrent-billing__invoice-main">
                  <TrailLink
                    href={`/dashboard/finance/invoices/${invoice.id}`}
                    className="pds-type-body-m-bold student-recurrent-billing__invoice-number"
                    from={{ label: studentName, href: `/dashboard/students/${studentId}` }}
                  >
                    {invoice.invoiceNumber}
                  </TrailLink>
                  <span className="student-recurrent-billing__invoice-source">
                    {f(`source_${invoice.source}`)}
                  </span>
                </div>
                <div className="student-recurrent-billing__invoice-amount">
                  <span className="pds-type-title-xxs-extrabold student-recurrent-billing__invoice-amount-value">
                    {formatMoney(Number(invoice.total))}
                  </span>
                  <span className="pds-type-body-s-regular student-recurrent-billing__invoice-amount-currency">
                    {DEFAULT_CURRENCY}
                  </span>
                </div>
                <div className="student-recurrent-billing__invoice-actions">
                  <DomainStatusPill
                    status={invoice.status}
                    label={
                      ["paid", "partial", "due", "overdue", "unpaid", "cancelled", "waived", "refunded"].includes(
                        invoice.status
                      )
                        ? f(`feesBilling.statusLabels.${invoice.status}` as "paid")
                        : invoice.status
                    }
                    className="student-recurrent-billing__invoice-badge"
                  />
                  <button
                    type="button"
                    className="pds-type-body-s-semibold student-recurrent-billing__invoice-view"
                    onClick={() => setPreviewInvoiceId(invoice.id)}
                  >
                    <Icon name="description" size={15} />
                    {c("view")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {data.activeServices.map((service) => (
          <article key={service.id} className="student-recurrent-billing__service-card">
            <span className="student-recurrent-billing__service-icon" aria-hidden="true">
              <Icon name={serviceIcon(service.feeItemName)} />
            </span>
            <div className="student-recurrent-billing__service-main">
              <strong className="pds-type-body-m-bold">{service.feeItemName}</strong>
              <span className="pds-type-body-s-regular student-recurrent-billing__service-source">
                {t("recurringAddon")}
              </span>
            </div>
            <div className="student-recurrent-billing__service-trailing">
              <span className="pds-type-body-m-bold student-recurrent-billing__service-status">
                {service.monthlyAmount != null
                  ? t("serviceActiveMonthly", { amount: formatMoney(service.monthlyAmount) })
                  : t("serviceActive")}
              </span>
              {canManage ? (
                <button
                  type="button"
                  className="pds-type-body-s-semibold student-recurrent-billing__service-remove"
                  onClick={() => setRemoveId(service.id)}
                >
                  <Icon name="delete" size={15} />
                  {tServices("remove")}
                </button>
              ) : null}
            </div>
          </article>
        ))}

        {canManage ? (
          <div className="student-recurrent-billing__manage">
            <SelectionCard
              icon={<Icon name="add_circle" size={24} />}
              title={tServices("addService")}
              description={tServices("addServiceHelp")}
              onClick={() => setAddOpen(true)}
            />
            <p className="pds-type-body-s-regular muted student-recurrent-billing__hint">
              {tServices("manageHint")}{" "}
              <Link href="/dashboard/finance/fee-structures" className="padauk-table__link">
                {tServices("feeStructuresLink")}
              </Link>
            </p>
          </div>
        ) : null}
      </div>

      <StudentAddServiceSheet
        studentId={studentId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={onRefresh}
      />

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveId(null);
          }
        }}
        title={tServices("removeTitle")}
        description={tServices("removeHelp")}
        confirmLabel={tServices("remove")}
        cancelLabel={c("cancel")}
        onConfirm={() => void confirmRemove()}
        loading={removeService.isPending}
      />

      <BillingInvoicePreviewModal
        invoiceId={previewInvoiceId}
        open={Boolean(previewInvoiceId)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewInvoiceId(null);
          }
        }}
      />
    </>
  );
}
