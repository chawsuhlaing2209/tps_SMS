"use client";

import { paymentMethods } from "@sms/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { Field } from "../../../../lib/form";
import { Icon } from "../../../../lib/icon";
import { PageHeader } from "../../../page-header-context";

type SalaryRecordDetail = {
  id: string;
  staffId: string;
  salaryMonth: string;
  grossAmount: string;
  deductionAmount: string;
  netAmount: string;
  status: string;
};

export default function SalaryRecordDetailPage() {
  const params = useParams<{ recordId: string }>();
  const recordId = params.recordId;
  const t = useTranslations("salary");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const [reason, setReason] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");

  const record = useApiQuery<SalaryRecordDetail>(
    (tenant) => `/tenants/${tenant}/salary/records/${recordId}`
  );

  const adjust = useApiMutation<{ reason: string; adjustmentAmount?: number }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/salary/records/${recordId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/salary/records/${recordId}`] }
  );

  const approve = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/salary/records/${recordId}/approve`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/salary/records/${recordId}`] }
  );

  const pay = useApiMutation<{ paymentMethod: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/salary/records/${recordId}/pay`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/salary/records/${recordId}`] }
  );

  if (record.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (record.isError || !record.data) {
    return (
      <div className="page-stack">
        <p className="error-text">{t("notFound")}</p>
        <Link href="/dashboard/salary/records">{t("backToRecords")}</Link>
      </div>
    );
  }

  const data = record.data;

  return (
    <div className="page-stack">
      <PageHeader
        title={data.staffId.slice(0, 8)}
        breadcrumbs={[
          { label: nav("group_business") },
          { label: t("records"), href: "/dashboard/salary/records" }
        ]}
        backHref="/dashboard/salary/records"
        backLabel={t("backToRecords")}
      />
      <section className="panel">
      <div className="panel-head">
        <h2>{data.staffId.slice(0, 8)}</h2>
      </div>
      <p>
        {t("month")}: {data.salaryMonth} · {c("status")}: {data.status}
      </p>
      <p>
        {t("grossAmount")}: {data.grossAmount} · {t("netAmount")}: {data.netAmount}
      </p>

      <div className="entity-form">
        <h3>{t("adjustRecord")}</h3>
        <Field label={t("adjustmentAmount")}>
          <input type="number" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} />
        </Field>
        <Field label={t("reason")}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="form-actions">
          <button
            type="button"
            className="btn-ghost"
            disabled={!reason || adjust.isPending}
            onClick={() =>
              void adjust.mutateAsync({
                reason,
                adjustmentAmount: adjustment ? Number(adjustment) : undefined
              })
            }
          >
            <Icon name="check" />
            {adjust.isPending ? c("loading") : t("saveAdjustment")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={approve.isPending}
            onClick={() => void approve.mutateAsync({})}
          >
            <Icon name="check_circle" />
            {approve.isPending ? c("loading") : t("approveRecord")}
          </button>
        </div>
      </div>

      <div className="entity-form">
        <h3>{t("markPaid")}</h3>
        <Field label={t("paymentMethod")}>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {paymentMethods.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={pay.isPending}
            onClick={() => void pay.mutateAsync({ paymentMethod })}
          >
            <Icon name="payments" />
            {pay.isPending ? c("loading") : t("markPaid")}
          </button>
        </div>
      </div>
      </section>
    </div>
  );
}
