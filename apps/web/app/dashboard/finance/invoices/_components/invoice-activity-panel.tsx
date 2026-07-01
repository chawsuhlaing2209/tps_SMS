"use client";

import { useTranslations } from "next-intl";
import { useApiQuery } from "../../../../lib/api";
import { EmptyState } from "../../../../../components/shared/empty-state";

type InvoiceActivityEvent = {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  actorUserId: string | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function InvoiceActivityPanel({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("finance");

  const { data, isLoading } = useApiQuery<{ data: InvoiceActivityEvent[] }>(
    (tid) => `/tenants/${tid}/finance/invoices/${invoiceId}/activity`
  );

  const events = data?.data ?? [];

  const actionLabel = (event: InvoiceActivityEvent) => {
    const key = `activityActions.${event.recordType}.${event.action}`;
    return t.has(key) ? t(key) : event.action;
  };

  return (
    <section className="panel invoice-document__payments">
      <div className="invoice-payments-head">
        <h3 className="pds-type-title-xxs-extrabold">{t("activityLogTitle")}</h3>
      </div>
      {isLoading ? null : !events.length ? (
        <EmptyState compact embedded icon="history" title={t("activityLogEmpty")} />
      ) : (
        <ul className="payment-list">
          {events.map((event) => (
            <li key={event.id} className="payment-row">
              <div className="payment-row__main">
                <span>{actionLabel(event)}</span>
                {event.actorName ? (
                  <span className="pds-type-body-s-regular muted">{event.actorName}</span>
                ) : null}
              </div>
              <p className="pds-type-body-s-regular muted payment-row__meta">
                {formatDateTime(event.createdAt)}
                {event.reason ? (
                  <>
                    {" "}
                    · {event.reason}
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
