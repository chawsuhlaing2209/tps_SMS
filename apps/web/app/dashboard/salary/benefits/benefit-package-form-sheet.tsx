"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormInput, FormTextarea } from "../../../../components/shared/form-input";
import { cn } from "../../../../lib/utils";
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

const BENEFIT_PACKAGE_ICONS = [
  "redeem",
  "home_work",
  "directions_bus",
  "restaurant",
  "health_and_safety",
  "school",
  "fitness_center",
  "savings"
] as const;

const ELIGIBILITY_OPTIONS = ["all_staff", "teachers", "admin_staff", "full_time"] as const;

function formatPreviewAmount(value: string) {
  const amount = Number(value);
  if (!value.trim() || Number.isNaN(amount)) {
    return "0";
  }
  return Math.round(amount).toLocaleString();
}

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
      icon: "redeem",
      eligibility: "all_staff"
    }
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: record?.name ?? "",
      description: record?.description ?? "",
      monthlyValue: record ? String(record.monthlyValue) : "",
      icon: record?.icon ?? "redeem",
      eligibility: record?.eligibility ?? "all_staff"
    });
  }, [form, open, record]);

  const watchedName = form.watch("name");
  const watchedIcon = form.watch("icon");
  const watchedEligibility = form.watch("eligibility");
  const watchedMonthlyValue = form.watch("monthlyValue");
  const previewName = watchedName.trim() || t("benefitPackagePreviewName");
  const previewNameIsPlaceholder = !watchedName.trim();

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? t("createBenefitPackage") : t("editBenefitPackage")}
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
            <Icon name={mode === "create" ? "add_circle" : "check"} />
            {form.formState.isSubmitting || submitting
              ? c("loading")
              : mode === "create"
                ? t("createBenefitPackageAction")
                : c("save")}
          </button>
        </>
      }
    >
      <div className="benefit-package-preview" aria-hidden>
        <span className="benefit-package-preview__icon">
          <Icon name={watchedIcon || "redeem"} size={21} />
        </span>
        <div className="benefit-package-preview__copy">
          <p
            className={cn(
              "pds-type-title-xxs-extrabold benefit-package-preview__name",
              previewNameIsPlaceholder && "benefit-package-preview__name--placeholder"
            )}
          >
            {previewName}
          </p>
          <p className="pds-type-body-s-regular benefit-package-preview__eligibility">
            {t(`eligibility.${watchedEligibility}` as "eligibility.all_staff")}
          </p>
        </div>
        <div className="benefit-package-preview__amount">
          <span className="pds-type-caption-s benefit-package-preview__amount-label">{t("monthlyPreviewLabel")}</span>
          <strong className="pds-type-title-xxs-extrabold benefit-package-preview__amount-value">
            {formatPreviewAmount(watchedMonthlyValue)} MMK
          </strong>
        </div>
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("packageNameLabel")}</span>
        <FormInput
          placeholder={t("packageNamePlaceholder")}
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register("name")}
        />
        {form.formState.errors.name?.message ? (
          <span className="pds-type-body-s-regular field-error">{form.formState.errors.name.message}</span>
        ) : null}
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{c("description")}</span>
        <FormTextarea
          rows={3}
          placeholder={t("packageDescriptionPlaceholder")}
          {...form.register("description")}
        />
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("packageIcon")}</span>
        <div className="benefit-package-icon-picker" role="radiogroup" aria-label={t("packageIcon")}>
          {BENEFIT_PACKAGE_ICONS.map((icon) => {
            const selected = watchedIcon === icon;
            return (
              <button
                key={icon}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cn(
                  "benefit-package-icon-picker__item",
                  selected && "benefit-package-icon-picker__item--selected"
                )}
                onClick={() => form.setValue("icon", icon, { shouldDirty: true })}
              >
                <Icon name={icon} size={20} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("eligibilityLabel")}</span>
        <div className="benefit-package-eligibility-picker" role="radiogroup" aria-label={t("eligibilityLabel")}>
          {ELIGIBILITY_OPTIONS.map((option) => {
            const selected = watchedEligibility === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cn(
                  "pds-type-body-s-bold benefit-package-eligibility-picker__pill",
                  selected && "benefit-package-eligibility-picker__pill--selected"
                )}
                onClick={() => form.setValue("eligibility", option, { shouldDirty: true, shouldValidate: true })}
              >
                {t(`eligibility.${option}`)}
              </button>
            );
          })}
        </div>
        {form.formState.errors.eligibility?.message ? (
          <span className="pds-type-body-s-regular field-error">{form.formState.errors.eligibility.message}</span>
        ) : null}
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("monthlyValue")}</span>
        <div className="benefit-package-monthly-value">
          <FormInput
            type="number"
            min={0}
            step={1000}
            placeholder="0"
            aria-invalid={Boolean(form.formState.errors.monthlyValue)}
            inputClassName="benefit-package-monthly-value__input"
            {...form.register("monthlyValue")}
          />
          <span className="pds-type-body-s-semibold benefit-package-monthly-value__suffix">{t("monthlyValueSuffix")}</span>
        </div>
        {form.formState.errors.monthlyValue?.message ? (
          <span className="pds-type-body-s-regular field-error">{form.formState.errors.monthlyValue.message}</span>
        ) : null}
      </div>
    </RecordFormSheet>
  );
}
