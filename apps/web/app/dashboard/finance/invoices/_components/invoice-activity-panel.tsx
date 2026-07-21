"use client";

import { useTranslations } from "next-intl";
import { useApiQuery } from "../../../../lib/api";
import { EmptyState } from "../../../../../components/shared/empty-state";
import { Icon } from "../../../../lib/material-icon";
import { formatMMK } from "../../../../lib/money";
import { formatCreatedAt } from "../../format-finance";

type InvoiceActivityEvent = {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  actorUserId: string | null;
  actorName: string | null;
  reason: string | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

/** Icon + accent per audit action; unknown actions get the neutral default. */
const ACTION_PRESENTATION: Record<string, { icon: string; tone: "neutral" | "positive" | "negative" | "info" }> = {
  "invoice.create": { icon: "receipt_long", tone: "neutral" },
  "invoice.generate_monthly": { icon: "bolt", tone: "neutral" },
  "invoice.send_guardian": { icon: "send", tone: "info" },
  "payment.collect": { icon: "payments", tone: "positive" },
  "payment.record": { icon: "payments", tone: "positive" },
  "payment.verify": { icon: "verified", tone: "positive" },
  "payment.refund": { icon: "undo", tone: "negative" }
};

export function InvoiceActivityPanel({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("finance");
  const tPay = useTranslations("enrollments");

  const { data, isLoading } = useApiQuery<{ data: InvoiceActivityEvent[] }>(
    (tid) => `/tenants/${tid}/finance/invoices/${invoiceId}/activity`
  );

  const events = data?.data ?? [];

  const methodLabel = (method: unknown): string => {
    if (typeof method !== "string" || !method) return "";
    const key = `paymentMethods.${method}`;
    return tPay.has(key as "paymentMethods.cash") ? tPay(key as "paymentMethods.cash") : method;
  };

  /** One human sentence per event — falls back to "{actor} · raw action". */
  const sentence = (event: InvoiceActivityEvent): string => {
    const actor = event.actorName ?? t("activitySystemActor");
    const rawAmount = event.after?.amount;
    const amount =
      typeof rawAmount === "string" || typeof rawAmount === "number"
        ? formatMMK(Number(rawAmount))
        : "";
    const method = methodLabel(event.after?.method);

    const key = `activityTimeline.${event.action}`;
    const needsAmount = event.action.startsWith("payment.");
    if (t.has(key as "activityLogTitle") && (!needsAmount || amount)) {
      return t(key as "activityLogTitle", { actor, amount, method });
    }
    return t("activityTimeline.generic", { actor, label: event.action });
  };

  return (
    <section className="panel invoice-document__payments">
      <div className="invoice-payments-head">
        <h3 className="pds-type-title-xxs-extrabold">{t("activityLogTitle")}</h3>
      </div>
      {isLoading ? null : !events.length ? (
        <EmptyState compact embedded icon="history" title={t("activityLogEmpty")} />
      ) : (
        <ol className="activity-timeline">
          {events.map((event) => {
            const presentation =
              ACTION_PRESENTATION[event.action] ?? { icon: "history", tone: "neutral" as const };
            return (
              <li key={event.id} className="activity-timeline__item">
                <span className="activity-timeline__marker" aria-hidden>
                  <span
                    className={`activity-timeline__dot activity-timeline__dot--${presentation.tone}`}
                  >
                    <Icon name={presentation.icon} size={16} />
                  </span>
                </span>
                <div className="activity-timeline__body">
                  <p className="pds-type-body-m-medium activity-timeline__sentence">
                    {sentence(event)}
                  </p>
                  <p className="pds-type-body-s-regular muted activity-timeline__meta">
                    {formatCreatedAt(event.createdAt)}
                    {event.reason ? <> · {event.reason}</> : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
