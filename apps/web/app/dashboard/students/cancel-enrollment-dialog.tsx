"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { paymentMethods, type PaymentMethod } from "@sms/shared";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { formatMMK } from "../../lib/money";
import { RecordFormSheet } from "../../lib/record-sheet";
import { toastSuccess } from "../../lib/toast";
import {
  FormSelect,
  TextAreaInput,
  TextInput
} from "../../../components/shared/form-input";

type RefundMode = "full" | "partial" | "none";

type InvoicePayments = {
  payments: Array<{ kind: "payment" | "refund"; amount: string; verifiedAt: string | null }>;
};

export function CancelEnrollmentDialog({
  open,
  onOpenChange,
  enrollmentId,
  invoiceId,
  studentName,
  onCancelled
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  invoiceId: string | null;
  studentName: string;
  onCancelled: () => void;
}) {
  const t = useTranslations("enrollments");
  const f = useTranslations("finance");
  const c = useTranslations("common");
  const tPay = useTranslations("enrollments.paymentMethods");

  const [refundMode, setRefundMode] = useState<RefundMode>("none");
  const [refundAmount, setRefundAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  // Net cash paid on the enrollment invoice = verified payments − verified refunds.
  const invoice = useApiQuery<InvoicePayments>((tenant) =>
    open && invoiceId ? `/tenants/${tenant}/finance/invoices/${invoiceId}` : null
  );
  const netCash = useMemo(() => {
    const rows = invoice.data?.payments ?? [];
    return rows.reduce((sum, p) => {
      if (!p.verifiedAt) return sum;
      return p.kind === "refund" ? sum - Number(p.amount) : sum + Number(p.amount);
    }, 0);
  }, [invoice.data]);

  const cancel = useApiMutation<
    { refundMode: RefundMode; refundAmount?: number; method?: string; referenceNumber?: string; reason: string },
    { refunded: number; forfeited: number }
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/enrollments/${enrollmentId}/cancel`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { showSuccessToast: false }
  );

  const close = () => {
    onOpenChange(false);
    setRefundMode("none");
    setRefundAmount("");
    setMethod("cash");
    setReference("");
    setReason("");
  };

  const partialValue = Number(refundAmount) || 0;
  const needsReference = refundMode !== "none" && method !== "cash";
  const refundPreview =
    refundMode === "full" ? netCash : refundMode === "partial" ? partialValue : 0;
  const forfeitPreview = Math.max(0, netCash - refundPreview);

  const canSubmit =
    reason.trim().length > 0 &&
    !cancel.isPending &&
    (refundMode !== "partial" || (partialValue > 0 && partialValue <= netCash)) &&
    (!needsReference || reference.trim().length > 0);

  const submit = async () => {
    await cancel.mutateAsync({
      refundMode,
      refundAmount: refundMode === "partial" ? partialValue : undefined,
      method: refundMode === "none" ? undefined : method,
      referenceNumber: needsReference ? reference.trim() : undefined,
      reason: reason.trim()
    });
    toastSuccess(t("cancelEnrollmentDone"));
    onCancelled();
    close();
  };

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={t("cancelEnrollmentTitle")}
      help={t("cancelEnrollmentHelp", { name: studentName })}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) void submit();
      }}
      footer={
        <>
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={close}>
            {c("cancel")}
          </button>
          <button
            type="submit"
            className="pds-type-body-m-bold btn-primary"
            disabled={!canSubmit}
          >
            <Icon name="cancel" />
            {cancel.isPending ? c("loading") : t("cancelEnrollmentConfirm")}
          </button>
        </>
      }
    >
      <div className="cancel-enrollment__summary">
        <span className="pds-type-body-s-regular muted">{t("netCashPaid")}</span>
        <strong className="pds-type-title-xxs-extrabold">{formatMMK(netCash)}</strong>
      </div>

      <Field label={t("refundMode")}>
        <FormSelect
          value={refundMode}
          onValueChange={(v) => setRefundMode((v as RefundMode) || "none")}
          options={[
            { value: "none", label: t("refundNone") },
            { value: "full", label: t("refundFull") },
            { value: "partial", label: t("refundPartial") }
          ]}
        />
      </Field>

      {refundMode === "partial" ? (
        <Field label={t("refundAmount")}>
          <TextInput
            type="number"
            min={1}
            max={netCash}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
          />
        </Field>
      ) : null}

      {refundMode !== "none" ? (
        <Field label={t("refundMethod")}>
          <FormSelect
            value={method}
            onValueChange={(v) => setMethod((v as PaymentMethod) || "cash")}
            options={paymentMethods.map((m) => ({ value: m, label: tPay(m) }))}
          />
        </Field>
      ) : null}

      {needsReference ? (
        <Field label={t("refundReference")}>
          <TextInput value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      ) : null}

      <Field label={t("cancelReason")}>
        <TextAreaInput
          rows={3}
          showCount={false}
          value={reason}
          placeholder={t("cancelReasonPlaceholder")}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>

      <p className="pds-type-body-s-regular muted cancel-enrollment__preview">
        {t("cancelPreview", {
          refunded: formatMMK(refundPreview),
          forfeited: formatMMK(forfeitPreview)
        })}
      </p>
    </RecordFormSheet>
  );
}
