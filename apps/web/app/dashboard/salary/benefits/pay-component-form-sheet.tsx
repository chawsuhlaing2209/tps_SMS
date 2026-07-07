"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { addPercentStringIssue } from "@sms/shared";
import { z } from "zod";
import { FormInput, PercentInput } from "../../../../components/shared/form-input";
import { PdsSelectField } from "../../../../components/pds";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";

export type PayComponentRecord = {
  id: string;
  code: string;
  name: string;
  kind: "earning" | "deduction";
  calculation: "fixed" | "percent_of_basic";
  defaultAmount: string | number;
  status: string;
  componentType: string;
};

type FormValues = {
  code: string;
  name: string;
  kind: string;
  calculation: string;
  defaultAmount: string;
};

const CALCULATION_OPTIONS = ["fixed", "percent_of_basic"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  record?: PayComponentRecord | null;
  submitting?: boolean;
  archiving?: boolean;
  onSubmit: (values: {
    code?: string;
    name: string;
    kind?: "earning" | "deduction";
    calculation: "fixed" | "percent_of_basic";
    defaultAmount: number;
  }) => Promise<void>;
  onArchive?: () => Promise<void>;
  onReactivate?: () => Promise<void>;
};

export function PayComponentFormSheet({
  open,
  onOpenChange,
  mode,
  record,
  submitting,
  archiving,
  onSubmit,
  onArchive,
  onReactivate
}: Props) {
  const t = useTranslations("salary");
  const c = useTranslations("common");

  const schema = z
    .object({
      code: mode === "create" ? z.string().trim().min(1, c("required")) : z.string(),
      name: z.string().trim().min(1, c("required")),
      kind: mode === "create" ? z.string().trim().min(1, c("required")) : z.string(),
      calculation: z.string().trim().min(1, c("required")),
      defaultAmount: z.string().trim().min(1, c("required"))
    })
    .superRefine((data, ctx) => {
      if (data.calculation === "percent_of_basic") {
        addPercentStringIssue(ctx, data.defaultAmount, ["defaultAmount"], c("percentRangeError"));
      }
    });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      kind: "deduction",
      calculation: "fixed",
      defaultAmount: "0"
    }
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      code: record?.code ?? "",
      name: record?.name ?? "",
      kind: record?.kind ?? "deduction",
      calculation: record?.calculation ?? "fixed",
      defaultAmount: record ? String(record.defaultAmount) : "0"
    });
  }, [form, open, record]);

  const calculation = form.watch("calculation");
  const isArchived = record?.status === "archived";

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? t("addComponent") : t("editComponent")}
      help={t("payComponentFormHelp")}
      headerIcon="payments"
      onSubmit={form.handleSubmit(async (values) => {
        const payload = {
          name: values.name.trim(),
          calculation: values.calculation as "fixed" | "percent_of_basic",
          defaultAmount: Number(values.defaultAmount) || 0
        };
        if (mode === "create") {
          await onSubmit({
            ...payload,
            code: values.code.trim().toLowerCase(),
            kind: "deduction"
          });
        } else {
          await onSubmit(payload);
        }
      })}
      footer={
        <>
          {mode === "edit" && record ? (
            isArchived ? (
              <button
                type="button"
                className="pds-type-body-m-bold btn-ghost"
                style={{ marginRight: "auto" }}
                disabled={archiving}
                onClick={() => void onReactivate?.()}
              >
                <Icon name="unarchive" />
                {archiving ? c("reactivating") : c("reactivate")}
              </button>
            ) : (
              <button
                type="button"
                className="pds-type-body-m-bold btn-ghost"
                style={{ marginRight: "auto" }}
                disabled={archiving}
                onClick={() => void onArchive?.()}
              >
                <Icon name="archive" />
                {archiving ? c("loading") : c("archive")}
              </button>
            )
          ) : null}
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </button>
          <button
            type="submit"
            className="pds-type-body-m-bold btn-primary"
            disabled={submitting || archiving || form.formState.isSubmitting || isArchived}
          >
            <Icon name="check" />
            {form.formState.isSubmitting || submitting
              ? c("loading")
              : mode === "create"
                ? t("addComponent")
                : c("save")}
          </button>
        </>
      }
    >
      {mode === "edit" ? (
        <>
          <Field label={t("codeLabel")}>
            <FormInput value={record?.code ?? ""} readOnly disabled />
          </Field>
          <Field label={t("kindLabel")}>
            <FormInput
              value={record ? t(`kind.${record.kind}` as "kind.earning") : ""}
              readOnly
              disabled
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("codeLabel")} error={form.formState.errors.code?.message}>
            <FormInput placeholder={t("codePlaceholder")} {...form.register("code")} />
          </Field>

        </>
      )}
      <Field label={c("name")} error={form.formState.errors.name?.message}>
        <FormInput placeholder={t("payComponentNamePlaceholder")} {...form.register("name")} disabled={isArchived} />
      </Field>
      <Field label={t("calculationLabel")} error={form.formState.errors.calculation?.message}>
        <PdsSelectField
          variant="form"
          value={calculation}
          onValueChange={(value) => {
            if (typeof value === "string") form.setValue("calculation", value);
          }}
          disabled={isArchived}
          options={CALCULATION_OPTIONS.map((option) => ({
            value: option,
            label: t(`calculation.${option}`)
          }))}
        />
      </Field>
      <Field
        label={
          calculation === "percent_of_basic" ? t("defaultAmountPercentLabel") : t("defaultAmountLabel")
        }
        error={form.formState.errors.defaultAmount?.message}
      >
        {calculation === "percent_of_basic" ? (
          <PercentInput
            step={1}
            placeholder="5"
            disabled={isArchived}
            {...form.register("defaultAmount")}
          />
        ) : (
          <FormInput
            type="number"
            placeholder="0"
            disabled={isArchived}
            {...form.register("defaultAmount")}
          />
        )}
      </Field>
      {isArchived ? (
        <p className="pds-type-body-s-regular muted">{c("archivedViewOnly")}</p>
      ) : null}
    </RecordFormSheet>
  );
}
