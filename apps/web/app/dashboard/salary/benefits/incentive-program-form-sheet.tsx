"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { addPercentStringIssue } from "@sms/shared";
import { z } from "zod";
import { FormInput, FormTextarea, PercentInput } from "../../../../components/shared/form-input";
import { cn } from "../../../../lib/utils";
import { Icon } from "../../../lib/material-icon";
import { formatMMK } from "../../../lib/money";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { benefitIconTone } from "./benefit-icon-themes";

export type IncentiveProgramRecord = {
  id: string;
  name: string;
  description: string | null;
  cadence: string;
  awardType: string;
  amount: number;
  status: string;
  eligibleCount: number;
  icon?: string | null;
  triggerRule?: string;
  recipients?: number;
  paidCount?: number;
};

type FormValues = {
  name: string;
  description: string;
  cadence: string;
  awardType: string;
  amount: string;
  icon: string;
};

const INCENTIVE_ICONS = [
  "military_tech",
  "trending_up",
  "event_available",
  "workspace_premium",
  "celebration",
  "emoji_events",
  "star",
  "volunteer_activism"
] as const;

const CADENCE_OPTIONS = ["monthly", "quarterly", "annual", "one_time"] as const;
const AWARD_TYPE_OPTIONS = ["fixed", "percent"] as const;

function formatPreviewAmount(value: string, awardType: string) {
  const amount = Number(value);
  if (!value.trim() || Number.isNaN(amount)) {
    return awardType === "percent" ? "— %" : "— MMK";
  }
  if (awardType === "percent") {
    return `${amount}%`;
  }
  return formatMMK(amount);
}

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
    icon: string | null;
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

  const schema = z
    .object({
      name: z.string().trim().min(1, c("required")),
      description: z.string(),
      cadence: z.string().trim().min(1, c("required")),
      awardType: z.string().trim().min(1, c("required")),
      amount: z.string().trim().min(1, c("required")),
      icon: z.string()
    })
    .superRefine((data, ctx) => {
      if (data.awardType === "percent") {
        addPercentStringIssue(ctx, data.amount, ["amount"], c("percentRangeError"));
      }
    });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      cadence: "monthly",
      awardType: "fixed",
      amount: "",
      icon: "military_tech"
    }
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: record?.name ?? "",
      description: record?.description ?? "",
      cadence: record?.cadence ?? "monthly",
      awardType: record?.awardType ?? "fixed",
      amount: record ? String(record.amount) : "",
      icon: record?.icon ?? "military_tech"
    });
  }, [form, open, record]);

  const watchedName = form.watch("name");
  const watchedCadence = form.watch("cadence");
  const watchedAwardType = form.watch("awardType");
  const watchedAmount = form.watch("amount");
  const watchedIcon = form.watch("icon");
  const previewName = watchedName.trim() || t("incentivePreviewName");
  const previewNameIsPlaceholder = !watchedName.trim();

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? t("createIncentiveProgram") : t("editIncentiveProgram")}
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit({
          name: values.name.trim(),
          description: values.description.trim() || null,
          cadence: values.cadence,
          awardType: values.awardType,
          amount: Number(values.amount) || 0,
          icon: values.icon.trim() || null
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
                ? t("createIncentiveProgramAction")
                : c("save")}
          </button>
        </>
      }
    >
      <div className="benefit-package-preview" aria-hidden>
        <span
          className={cn(
            "benefit-package-preview__icon",
            `benefit-package-card__icon--${benefitIconTone(watchedIcon)}`
          )}
        >
          <Icon name={watchedIcon || "military_tech"} size={21} />
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
            {t(`cadence.${watchedCadence}` as "cadence.monthly")}
          </p>
        </div>
        <div className="benefit-package-preview__amount">
          <span className="pds-type-caption-s benefit-package-preview__amount-label">{t("award")}</span>
          <strong className="pds-type-title-xxs-extrabold benefit-package-preview__amount-value">
            {formatPreviewAmount(watchedAmount, watchedAwardType)}
          </strong>
        </div>
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("incentiveNameLabel")}</span>
        <FormInput
          placeholder={t("incentiveNamePlaceholder")}
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register("name")}
        />
        {form.formState.errors.name?.message ? (
          <span className="pds-type-body-s-regular field-error">{form.formState.errors.name.message}</span>
        ) : null}
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("triggerRuleColumn")}</span>
        <FormTextarea
          rows={3}
          placeholder={t("incentiveDescriptionPlaceholder")}
          {...form.register("description")}
        />
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("packageIcon")}</span>
        <div className="benefit-package-icon-picker" role="radiogroup" aria-label={t("packageIcon")}>
          {INCENTIVE_ICONS.map((icon) => {
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
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("cadenceLabel")}</span>
        <div className="benefit-package-eligibility-picker" role="radiogroup" aria-label={t("cadenceLabel")}>
          {CADENCE_OPTIONS.map((option) => {
            const selected = watchedCadence === option;
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
                onClick={() => form.setValue("cadence", option, { shouldDirty: true, shouldValidate: true })}
              >
                {t(`cadence.${option}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">{t("awardTypeLabel")}</span>
        <div className="benefit-package-eligibility-picker" role="radiogroup" aria-label={t("awardTypeLabel")}>
          {AWARD_TYPE_OPTIONS.map((option) => {
            const selected = watchedAwardType === option;
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
                onClick={() => form.setValue("awardType", option, { shouldDirty: true, shouldValidate: true })}
              >
                {t(`awardType.${option}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="benefit-package-form-field">
        <span className="pds-type-caption-s benefit-package-form-field__label">
          {watchedAwardType === "percent" ? t("awardPercent") : t("awardAmount")}
        </span>
        <div className="benefit-package-monthly-value">
          {watchedAwardType === "percent" ? (
            <PercentInput
              step={1}
              placeholder="10"
              aria-invalid={Boolean(form.formState.errors.amount)}
              className="benefit-package-monthly-value__percent"
              inputClassName="benefit-package-monthly-value__input"
              {...form.register("amount")}
            />
          ) : (
            <>
              <FormInput
                type="number"
                min={0}
                step={1000}
                placeholder="0"
                aria-invalid={Boolean(form.formState.errors.amount)}
                inputClassName="benefit-package-monthly-value__input"
                {...form.register("amount")}
              />
              <span className="pds-type-body-s-semibold benefit-package-monthly-value__suffix">MMK</span>
            </>
          )}
        </div>
        {form.formState.errors.amount?.message ? (
          <span className="pds-type-body-s-regular field-error">{form.formState.errors.amount.message}</span>
        ) : null}
      </div>
    </RecordFormSheet>
  );
}
