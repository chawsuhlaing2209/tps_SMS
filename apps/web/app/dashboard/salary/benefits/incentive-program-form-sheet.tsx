"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormInput, FormTextarea } from "../../../../components/shared/form-input";
import { PdsSelectField } from "../../../../components/pds";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";

export type IncentiveProgramRecord = {
  id: string;
  name: string;
  description: string | null;
  cadence: string;
  awardType: string;
  amount: number;
  status: string;
  eligibleCount: number;
};

type FormValues = {
  name: string;
  description: string;
  cadence: string;
  awardType: string;
  amount: string;
};

const CADENCE_OPTIONS = ["monthly", "quarterly", "annual", "one_time"] as const;
const AWARD_TYPE_OPTIONS = ["fixed", "percent"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  record?: IncentiveProgramRecord | null;
  submitting?: boolean;
  onSubmit: (values: {
    name: string;
    description: string | null;
    cadence: string;
    awardType: string;
    amount: number;
  }) => Promise<void>;
};

export function IncentiveProgramFormSheet({
  open,
  onOpenChange,
  mode,
  record,
  submitting,
  onSubmit
}: Props) {
  const t = useTranslations("salary");
  const c = useTranslations("common");

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    description: z.string(),
    cadence: z.string().trim().min(1, c("required")),
    awardType: z.string().trim().min(1, c("required")),
    amount: z.string().trim().min(1, c("required"))
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      cadence: "monthly",
      awardType: "fixed",
      amount: ""
    }
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: record?.name ?? "",
      description: record?.description ?? "",
      cadence: record?.cadence ?? "monthly",
      awardType: record?.awardType ?? "fixed",
      amount: record ? String(record.amount) : ""
    });
  }, [form, open, record]);

  const awardType = form.watch("awardType");

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? t("addIncentiveProgram") : t("editIncentiveProgram")}
      help={t("incentiveProgramFormHelp")}
      headerIcon="emoji_events"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
          description: values.description.trim() || null,
          cadence: values.cadence,
          awardType: values.awardType,
          amount: Number(values.amount) || 0
        });
      })}
      footer={
        <>
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </button>
          <button
            type="submit"
            className="pds-type-body-m-bold btn-primary"
            disabled={submitting || form.formState.isSubmitting}
          >
            <Icon name="check" />
            {form.formState.isSubmitting || submitting
              ? c("loading")
              : mode === "create"
                ? t("addIncentiveProgram")
                : c("save")}
          </button>
        </>
      }
    >
      <Field label={c("name")} error={form.formState.errors.name?.message}>
        <FormInput placeholder={t("incentiveNamePlaceholder")} {...form.register("name")} />
      </Field>
      <Field label={c("description")} error={form.formState.errors.description?.message}>
        <FormTextarea rows={3} placeholder={t("incentiveDescriptionPlaceholder")} {...form.register("description")} />
      </Field>
      <Field label={t("cadenceLabel")} error={form.formState.errors.cadence?.message}>
        <PdsSelectField
          variant="form"
          value={form.watch("cadence")}
          onValueChange={(value) => {
            if (typeof value === "string") form.setValue("cadence", value);
          }}
          options={CADENCE_OPTIONS.map((option) => ({
            value: option,
            label: t(`cadence.${option}`)
          }))}
        />
      </Field>
      <Field label={t("awardTypeLabel")} error={form.formState.errors.awardType?.message}>
        <PdsSelectField
          variant="form"
          value={awardType}
          onValueChange={(value) => {
            if (typeof value === "string") form.setValue("awardType", value);
          }}
          options={AWARD_TYPE_OPTIONS.map((option) => ({
            value: option,
            label: t(`awardType.${option}`)
          }))}
        />
      </Field>
      <Field
        label={awardType === "percent" ? t("awardPercent") : t("awardAmount")}
        error={form.formState.errors.amount?.message}
      >
        <FormInput
          type="number"
          placeholder={awardType === "percent" ? "10" : "0"}
          {...form.register("amount")}
        />
      </Field>
    </RecordFormSheet>
  );
}
