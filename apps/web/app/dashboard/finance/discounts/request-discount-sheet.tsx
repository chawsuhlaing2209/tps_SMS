"use client";
import { FormInput } from "../../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { PdsSelectField } from "../../../../components/pds";
import { EmptyState } from "../../../../components/shared/empty-state";
import { type DiscountRuleRecord } from "./discount-form";

type StudentDiscountRow = {
  id: string;
  discountRuleId: string;
  status: string;
};

type RequestDiscountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName?: string;
  defaultRuleId?: string;
  onRequested?: () => void;
};

const RULES_PATH = (tenant: string) => `/tenants/${tenant}/discounts/rules`;
const REQUESTS_PATH = (tenant: string, studentId: string) =>
  `/tenants/${tenant}/discounts/student-discounts?studentId=${studentId}`;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function RequestDiscountSheet({
  open,
  onOpenChange,
  studentId,
  studentName,
  defaultRuleId,
  onRequested
}: RequestDiscountSheetProps) {
  const t = useTranslations("discounts");
  const c = useTranslations("common");

  const [ruleId, setRuleId] = useState("");
  const [reason, setReason] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIsoDate);
  const [effectiveTo, setEffectiveTo] = useState("");

  const rules = useApiQuery<DiscountRuleRecord[]>(open ? RULES_PATH : () => null);
  const existing = useApiQuery<StudentDiscountRow[]>(
    open && studentId ? (tenant) => REQUESTS_PATH(tenant, studentId) : () => null
  );

  const requestableRules = useMemo(() => {
    const blockedRuleIds = new Set(
      (existing.data ?? [])
        .filter((row) => !["rejected", "archived"].includes(row.status))
        .map((row) => row.discountRuleId)
    );
    return (rules.data ?? []).filter(
      (rule) =>
        rule.status === "active" &&
        rule.triggerMode === "request" &&
        !blockedRuleIds.has(rule.id)
    );
  }, [existing.data, rules.data]);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setEffectiveFrom(todayIsoDate());
    setEffectiveTo("");
    const preferred =
      defaultRuleId && requestableRules.some((rule) => rule.id === defaultRuleId)
        ? defaultRuleId
        : (requestableRules[0]?.id ?? "");
    setRuleId(preferred);
  }, [defaultRuleId, open, requestableRules]);

  const request = useApiMutation<
    {
      studentId: string;
      discountRuleId: string;
      reason: string;
      effectiveFrom: string;
      effectiveTo?: string;
    },
    unknown
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/discounts/student-discounts`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_body, tenant) => [
        `/tenants/${tenant}/discounts/student-discounts`,
        `/tenants/${tenant}/finance/students/${studentId}/summary`
      ],
      successMessage: t("requestSubmitted")
    }
  );

  const close = () => onOpenChange(false);

  const canSubmit =
    Boolean(studentId && ruleId && reason.trim() && effectiveFrom) && !request.isPending;

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("requestTitle")}
      onSubmit={(event) => {
        event.preventDefault();
      }}
      footer={
        <>
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={close}>
            {c("cancel")}
          </button>
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            disabled={!canSubmit}
            onClick={async () => {
              await request.mutateAsync({
                studentId,
                discountRuleId: ruleId,
                reason: reason.trim(),
                effectiveFrom,
                ...(effectiveTo.trim() ? { effectiveTo: effectiveTo.trim() } : {})
              });
              onRequested?.();
              close();
            }}
          >
            <Icon name="send" size={18} />
            {request.isPending ? t("creating") : t("request")}
          </button>
        </>
      }
    >
      {studentName ? (
        <p className="pds-type-body-s-regular muted">
          {t("student")}: <strong>{studentName}</strong>
        </p>
      ) : null}

      {rules.isLoading || existing.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : !requestableRules.length ? (
        <EmptyState compact embedded icon="sell" title={t("noRequestableRules")} />
      ) : (
        <>
          <Field label={t("rule")}>
            <PdsSelectField
              variant="form"
              value={ruleId}
              onValueChange={(value) => setRuleId(typeof value === "string" ? value : "")}
              placeholder={t("selectRule")}
              options={requestableRules.map((rule) => ({
                value: rule.id,
                label: rule.name
              }))}
            />
          </Field>
          <Field label={t("reason")}>
            <textarea
              rows={3}
              value={reason}
              placeholder={t("requestReasonPlaceholder")}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <Field label={t("effectiveFrom")}>
            <FormInput
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
          </Field>
          <Field label={t("effectiveTo")}>
            <FormInput
              type="date"
              value={effectiveTo}
              onChange={(event) => setEffectiveTo(event.target.value)}
            />
          </Field>
        </>
      )}
    </RecordFormSheet>
  );
}
