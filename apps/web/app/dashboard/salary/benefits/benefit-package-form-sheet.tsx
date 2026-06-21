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

export type BenefitPackageRecord = {
  id: string;
  name: string;
  description: string | null;
  monthlyValue: number;
  icon: string | null;
  status: string;
  enrolledCount: number;
  eligibility: string;
};

type FormValues = {
  name: string;
  description: string;
  monthlyValue: string;
  icon: string;
  eligibility: string;
};

const ELIGIBILITY_OPTIONS = ["all_staff", "teachers", "admin_staff", "full_time"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  record?: BenefitPackageRecord | null;
  submitting?: boolean;
  onSubmit: (values: {
    name: string;
    description: string | null;
    monthlyValue: number;
    icon: string | null;
    eligibility: string;
  }) => Promise<void>;
};

export function BenefitPackageFormSheet({
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
    monthlyValue: z.string().trim().min(1, c("required")),
    icon: z.string(),
    eligibility: z.string().trim().min(1, c("required"))
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      monthlyValue: "",
      icon: "card_giftcard",
      eligibility: "all_staff"
    }
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: record?.name ?? "",
      description: record?.description ?? "",
      monthlyValue: record ? String(record.monthlyValue) : "",
      icon: record?.icon ?? "card_giftcard",
      eligibility: record?.eligibility ?? "all_staff"
    });
  }, [form, open, record]);

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? t("addBenefitPackage") : t("editBenefitPackage")}
      help={t("benefitPackageFormHelp")}
      headerIcon="card_giftcard"
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
          description: values.description.trim() || null,
          monthlyValue: Number(values.monthlyValue) || 0,
          icon: values.icon.trim() || null,
          eligibility: values.eligibility
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
                ? t("addBenefitPackage")
                : c("save")}
          </button>
        </>
      }
    >
      <Field label={c("name")} error={form.formState.errors.name?.message}>
        <FormInput placeholder={t("packageNamePlaceholder")} {...form.register("name")} />
      </Field>
      <Field label={c("description")} error={form.formState.errors.description?.message}>
        <FormTextarea rows={3} placeholder={t("packageDescriptionPlaceholder")} {...form.register("description")} />
      </Field>
      <Field label={t("monthlyValue")} error={form.formState.errors.monthlyValue?.message}>
        <FormInput type="number" placeholder="0" {...form.register("monthlyValue")} />
      </Field>
      <Field label={t("packageIcon")}>
        <FormInput placeholder="card_giftcard" {...form.register("icon")} />
      </Field>
      <Field label={t("eligibilityLabel")} error={form.formState.errors.eligibility?.message}>
        <PdsSelectField
          variant="form"
          value={form.watch("eligibility")}
          onValueChange={(value) => {
            if (typeof value === "string") form.setValue("eligibility", value);
          }}
          options={ELIGIBILITY_OPTIONS.map((option) => ({
            value: option,
            label: t(`eligibility.${option}`)
          }))}
        />
      </Field>
    </RecordFormSheet>
  );
}
