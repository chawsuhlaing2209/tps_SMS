"use client";
import { FormInput } from "../../../../../components/shared/form-input";

import { paymentMethods } from "@sms/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { use, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { Field } from "../../../../lib/form";
import { Icon } from "../../../../lib/material-icon";
import { PdsSelectField } from "../../../../../components/pds";
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

export default function SalaryRecordDetailPage({
  params
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = use(params);
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
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (record.isError || !record.data) {
    return (
      <div className="page-stack">
        <p className="pds-type-body-m-medium error-text">{t("notFound")}</p>
      </div>
    );
  }

  const data = record.data;

  return (
    <div className="page-stack">
      <PageHeader
        title={data.staffId.slice(0, 8)}
        breadcrumbs={[
          { label: nav("group_hr") },
          { label: t("records"), href: "/dashboard/salary/records" }
        ]}
      />
      <section className="panel">
      <div className="panel-head">
        <h2 className="pds-type-title-xs-bold">{data.staffId.slice(0, 8)}</h2>
      </div>
      <p>
        {t("month")}: {data.salaryMonth} · {c("status")}: {data.status}
      </p>
      <p>
        {t("grossAmount")}: {data.grossAmount} · {t("netAmount")}: {data.netAmount}
      </p>

      <div className="entity-form">
        <h3 className="pds-type-title-xxs-extrabold">{t("adjustRecord")}</h3>
        <Field label={t("adjustmentAmount")}>
          <FormInput type="number" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} />
        </Field>
        <Field label={t("reason")}>
          <FormInput value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="form-actions">
          <button
            type="button"
            className="pds-type-body-m-bold btn-ghost"
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
            className="pds-type-body-m-bold btn-primary"
            disabled={approve.isPending}
            onClick={() => void approve.mutateAsync({})}
          >
            <Icon name="check_circle" />
            {approve.isPending ? c("loading") : t("approveRecord")}
          </button>
        </div>
      </div>

      <div className="entity-form">
        <h3 className="pds-type-title-xxs-extrabold">{t("markPaid")}</h3>
        <Field label={t("paymentMethod")}>
          <PdsSelectField
            variant="form"
            value={paymentMethod}
            onValueChange={(value) => setPaymentMethod(typeof value === "string" ? value : paymentMethods[0])}
            options={paymentMethods.map((option) => ({ value: option, label: option }))}
          />
        </Field>
        <div className="form-actions">
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
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
