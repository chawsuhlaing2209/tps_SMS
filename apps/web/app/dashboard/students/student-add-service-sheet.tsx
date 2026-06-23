"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PdsDatePickerField, PdsSelectField } from "../../../components/pds";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { RecordFormSheet } from "../../lib/record-sheet";
import { toastSuccess } from "../../lib/toast";
import { zodResolver } from "../../lib/zod-resolver";
import { Button } from "../../../components/ui/button";

type AvailableService = {
  feeItemId: string;
  name: string;
  feeType: string;
  billingType: string;
  unitAmount: number;
  isRecurring: boolean;
};

type AddServicePreview = {
  feeItemId: string;
  feeItemName: string;
  billingType: string;
  effectiveFrom: string;
  isRecurring: boolean;
  subtotal: number;
  discountTotal: number;
  total: number;
  createsInvoice: boolean;
};

type AddServiceResult = {
  kind: "recurring" | "one_time";
  studentService: { id: string } | null;
  invoice: { id: string; invoiceNumber: string } | null;
};

type Props = {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
};

function formatAmount(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function StudentAddServiceSheet({ studentId, open, onOpenChange, onAdded }: Props) {
  const t = useTranslations("finance.studentServices");
  const tFinance = useTranslations("finance");
  const tEnroll = useTranslations("enrollments");
  const c = useTranslations("common");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const available = useApiQuery<AvailableService[]>(
    (tenant) =>
      open
        ? `/tenants/${tenant}/student-services/available?studentId=${encodeURIComponent(studentId)}`
        : null
  );

  const [preview, setPreview] = useState<AddServicePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const schema = z.object({
    feeItemId: z.string().min(1, c("required")),
    startDate: z.string().min(1, c("required")),
    dueDate: z.string().optional()
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { feeItemId: "", startDate: today, dueDate: today }
  });

  const feeItemId = form.watch("feeItemId");
  const startDate = form.watch("startDate");

  const previewMutation = useApiMutation<
    { studentId: string; feeItemId: string; effectiveFrom: string },
    AddServicePreview
  >(({ studentId: sid, feeItemId: fid, effectiveFrom }, tenant) => ({
    path: `/tenants/${tenant}/student-services/preview`,
    init: { method: "POST", body: JSON.stringify({ studentId: sid, feeItemId: fid, effectiveFrom }) }
  }));

  const addService = useApiMutation<
    { studentId: string; feeItemId: string; startDate: string; dueDate?: string },
    AddServiceResult
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/student-services`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_, tenant) => [
        `/tenants/${tenant}/finance/students/${studentId}/summary`,
        `/tenants/${tenant}/student-services`
      ]
    }
  );

  useEffect(() => {
    if (!open) {
      form.reset({ feeItemId: "", startDate: today, dueDate: today });
      setPreview(null);
      setPreviewError(null);
    }
  }, [form, open, today]);

  useEffect(() => {
    if (!open || !feeItemId || !startDate) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void previewMutation
        .mutateAsync({ studentId, feeItemId, effectiveFrom: startDate })
        .then((result) => {
          setPreview(result);
          setPreviewError(null);
        })
        .catch((error: Error) => {
          setPreview(null);
          setPreviewError(error.message);
        });
    }, 250);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced preview on selection
  }, [feeItemId, open, startDate, studentId]);

  const selectedService = available.data?.find((row) => row.feeItemId === feeItemId);

  const serviceOptions = (available.data ?? []).map((row) => ({
    value: row.feeItemId,
    label: `${row.name} · ${formatAmount(row.unitAmount)} MMK`
  }));

  async function onSubmit(values: z.infer<typeof schema>) {
    const result = await addService.mutateAsync({
      studentId,
      feeItemId: values.feeItemId,
      startDate: values.startDate,
      dueDate: preview?.createsInvoice ? values.dueDate || values.startDate : undefined
    });

    if (result.kind === "one_time" && result.invoice) {
      toastSuccess(t("addedWithInvoice", { number: result.invoice.invoiceNumber }));
    } else {
      toastSuccess(t("addedRecurring"));
    }

    onOpenChange(false);
    onAdded();
  }

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("addService")}
      help={t("addServiceHelp")}
      onSubmit={form.handleSubmit(onSubmit)}
      footer={
        <>
          <Button type="button" buttonType="outlined" buttonColor="secondary" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </Button>
          <Button
            type="submit"
            buttonType="filled"
            buttonColor="primary"
            disabled={!preview || Boolean(previewError) || !feeItemId || addService.isPending}
          >
            {addService.isPending ? c("loading") : t("addServiceSubmit")}
          </Button>
        </>
      }
    >
      {available.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : !available.data?.length ? (
        <p className="pds-type-body-s-regular muted">{t("noAvailableServices")}</p>
      ) : (
        <>
          <Field label={t("service")} error={form.formState.errors.feeItemId?.message}>
            <PdsSelectField
              variant="form"
              value={feeItemId}
              onValueChange={(value) =>
                form.setValue("feeItemId", typeof value === "string" ? value : "", {
                  shouldValidate: true
                })
              }
              placeholder={t("selectService")}
              options={serviceOptions}
            />
          </Field>

          {selectedService ? (
            <p className="pds-type-body-s-regular muted">
              {tFinance(`billingTypes.${selectedService.billingType}`)}
              {selectedService.isRecurring ? ` · ${t("recurringNote")}` : ` · ${t("oneTimeNote")}`}
            </p>
          ) : null}

          <Field label={t("effectiveFrom")} error={form.formState.errors.startDate?.message}>
            <PdsDatePickerField
              type="day"
              variant="form"
              value={startDate}
              onValueChange={(value) =>
                form.setValue("startDate", value, { shouldValidate: true })
              }
              ariaLabel={t("effectiveFrom")}
            />
          </Field>

          {preview?.createsInvoice ? (
            <Field label={t("dueDate")} error={form.formState.errors.dueDate?.message}>
              <PdsDatePickerField
                type="day"
                variant="form"
                value={form.watch("dueDate") ?? startDate}
                onValueChange={(value) => form.setValue("dueDate", value)}
                ariaLabel={t("dueDate")}
              />
            </Field>
          ) : null}

          {previewError ? <p className="pds-type-body-s-regular error-text">{previewError}</p> : null}

          {preview ? (
            <div className="invoice-preview">
              <div className="invoice-preview__totals">
                <div>
                  <span>{tEnroll("subtotal")}</span>
                  <span>{formatAmount(preview.subtotal)} MMK</span>
                </div>
                {preview.discountTotal > 0 ? (
                  <div>
                    <span>{tEnroll("discountTotal")}</span>
                    <span>-{formatAmount(preview.discountTotal)} MMK</span>
                  </div>
                ) : null}
                <div className="invoice-preview__grand">
                  <span>{tEnroll("totalDue")}</span>
                  <span>{formatAmount(preview.total)} MMK</span>
                </div>
              </div>
              <p className="pds-type-body-s-regular muted">
                {preview.isRecurring ? t("previewRecurring") : t("previewOneTime")}
              </p>
            </div>
          ) : null}
        </>
      )}
    </RecordFormSheet>
  );
}
