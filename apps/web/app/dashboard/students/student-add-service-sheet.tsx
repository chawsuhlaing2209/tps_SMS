"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { type PaymentMethod } from "@sms/shared";
import {
  InvoiceDetails,
  PdsDatePickerField,
  ToggleList,
  ToggleListItem,
  ToggleListSectionHead,
  type InvoiceDetailsSection
} from "../../../components/pds";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/shared/empty-state";
import {
  PaymentMethodPicker,
  paymentMethodNeedsReference
} from "../../../components/shared/payment-method-picker";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { useTenantFormats } from "../../lib/use-tenant-formats";
import { RecordFormSheet } from "../../lib/record-sheet";
import { toastSuccess } from "../../lib/toast";
import {
  EnrollmentConfirmOption,
  formatEnrollmentAmount,
  resolveOptionalFeeIcon
} from "../enrollments/enrollment-ceremony-ui";

type AvailableService = {
  feeItemId: string;
  name: string;
  feeType: string;
  billingType: string;
  unitAmount: number;
  isRecurring: boolean;
};

type AddServicePreview = {
  feeLines: Array<{ feeItemId: string; description: string; lineTotal: number }>;
  discounts: Array<{ id: string; name: string; amount: number; source: string }>;
  subtotal: number;
  discountTotal: number;
  total: number;
};

type AddServiceResult = {
  kind: "recurring" | "one_time";
  invoice: { id: string; invoiceNumber: string } | null;
  paymentId: string | null;
};

type ConfirmMode = "pay" | "confirm" | "draft";

type Props = {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
};

export function StudentAddServiceSheet({ studentId, open, onOpenChange, onAdded }: Props) {
  const t = useTranslations("finance.studentServices");
  const e = useTranslations("enrollments");
  const c = useTranslations("common");
  const { formatMoney } = useTenantFormats();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const available = useApiQuery<AvailableService[]>(
    (tenant) =>
      open
        ? `/tenants/${tenant}/student-services/available?studentId=${encodeURIComponent(studentId)}`
        : null
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [preview, setPreview] = useState<AddServicePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [mode, setMode] = useState<ConfirmMode>("confirm");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");

  const previewMutation = useApiMutation<
    { studentId: string; feeItemIds: string[]; effectiveFrom: string },
    AddServicePreview
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/student-services/preview`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { showSuccessToast: false, showErrorToast: false }
  );

  const addService = useApiMutation<
    {
      studentId: string;
      feeItemIds: string[];
      startDate: string;
      dueDate?: string;
      collectPayment?: boolean;
      paymentMethod?: string;
      paymentAmount?: number;
      paymentReference?: string;
    },
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
      setSelected([]);
      setStartDate(today);
      setDueDate(today);
      setPreview(null);
      setPreviewError(null);
      setMode("confirm");
      setMethod("cash");
      setReference("");
    }
  }, [open, today]);

  // Debounced multi-service preview whenever the selection changes.
  useEffect(() => {
    if (!open) return;
    if (selected.length === 0) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void previewMutation
        .mutateAsync({ studentId, feeItemIds: selected, effectiveFrom: startDate })
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
  }, [open, selected, startDate, studentId]);

  const toggle = (feeItemId: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, feeItemId] : prev.filter((id) => id !== feeItemId)
    );
  };

  const selectedTotal = useMemo(
    () =>
      (available.data ?? [])
        .filter((s) => selected.includes(s.feeItemId))
        .reduce((sum, s) => sum + s.unitAmount, 0),
    [available.data, selected]
  );

  const invoiceSections: InvoiceDetailsSection[] = useMemo(() => {
    if (!preview) return [];
    const sections: InvoiceDetailsSection[] = [
      {
        id: "services",
        title: t("invoiceBreakdownTitle"),
        lines: preview.feeLines.map((line) => ({
          id: line.feeItemId,
          label: line.description,
          amount: line.lineTotal
        }))
      }
    ];
    if (preview.discounts.length > 0) {
      sections.push({
        id: "discounts",
        title: e("discountTotal"),
        emphasis: true,
        lines: preview.discounts.map((d) => ({
          id: `${d.source}-${d.id}`,
          label: d.name,
          amount: d.amount,
          variant: "discount" as const
        }))
      });
    }
    sections.push({
      id: "paid",
      title: t("paidSection"),
      emphasis: true,
      lines: [{ id: "paid-to-date", label: t("paidToDate"), amount: 0, variant: "credit" as const }]
    });
    return sections;
  }, [preview, t, e]);

  const needsReference = mode === "pay" && paymentMethodNeedsReference(method);
  const canSubmit =
    selected.length > 0 &&
    !addService.isPending &&
    (mode !== "pay" || (Boolean(preview) && (!needsReference || reference.trim().length > 0)));

  async function submit() {
    if (mode === "draft") {
      onOpenChange(false);
      return;
    }
    const result = await addService.mutateAsync({
      studentId,
      feeItemIds: selected,
      startDate,
      dueDate: dueDate || startDate,
      collectPayment: mode === "pay" || undefined,
      paymentMethod: mode === "pay" ? method : undefined,
      paymentAmount: mode === "pay" ? preview?.total : undefined,
      paymentReference: needsReference ? reference.trim() : undefined
    });

    if (result.invoice && mode === "pay") {
      toastSuccess(t("addedWithPayment", { number: result.invoice.invoiceNumber }));
    } else if (result.invoice) {
      toastSuccess(t("addedWithInvoice", { number: result.invoice.invoiceNumber }));
    } else {
      toastSuccess(t("addedRecurring"));
    }

    onOpenChange(false);
    onAdded();
  }

  const submitLabel =
    mode === "pay"
      ? t("confirmPayTitle")
      : mode === "draft"
        ? t("saveDraftTitle")
        : t("confirmServiceTitle");

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("addService")}
      help={t("addServiceHelp")}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit || mode === "draft") void submit();
      }}
      footer={
        <>
          <Button type="button" buttonType="outlined" buttonColor="secondary" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </Button>
          <Button
            type="submit"
            buttonType="filled"
            buttonColor="primary"
            disabled={mode !== "draft" && !canSubmit}
          >
            {addService.isPending ? c("loading") : submitLabel}
          </Button>
        </>
      }
    >
      {available.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : !available.data?.length ? (
        <EmptyState compact embedded icon="inventory_2" title={t("noAvailableServices")} />
      ) : (
        <div className="enrollment-ceremony__stack">
          <div className="enrollment-ceremony__section">
            <ToggleListSectionHead
              title={e("optionalAddOns")}
              summary={t("addonsSummary", {
                count: selected.length,
                amount: formatMoney(selectedTotal)
              })}
            />
            <ToggleList aria-label={e("optionalAddOns")}>
              {available.data.map((service) => {
                const { icon, tone } = resolveOptionalFeeIcon(service.name, service.feeType);
                return (
                  <ToggleListItem
                    key={service.feeItemId}
                    variant="toggle"
                    icon={icon}
                    iconTone={tone}
                    title={service.name}
                    amount={service.unitAmount}
                    checked={selected.includes(service.feeItemId)}
                    onCheckedChange={(checked) => toggle(service.feeItemId, checked)}
                  />
                );
              })}
            </ToggleList>
          </div>

          <Field label={t("effectiveFrom")}>
            <PdsDatePickerField
              type="day"
              variant="form"
              value={startDate}
              onValueChange={setStartDate}
              ariaLabel={t("effectiveFrom")}
            />
          </Field>

          {previewError ? (
            <p className="pds-type-body-s-regular error-text">{previewError}</p>
          ) : null}

          {preview ? (
            <>
              <InvoiceDetails
                sections={invoiceSections}
                totalDue={preview.total}
                totalLabel={e("totalDue")}
                currencyLabel="MMK"
                formatAmount={formatEnrollmentAmount}
              />

              <Field label={t("dueDate")}>
                <PdsDatePickerField
                  type="day"
                  variant="form"
                  value={dueDate}
                  onValueChange={setDueDate}
                  ariaLabel={t("dueDate")}
                />
              </Field>

              <div className="enrollment-ceremony__section">
                <p className="pds-type-caption-s enrollment-ceremony__section-title">
                  {t("confirmHelp")}
                </p>
                <div className="enrollment-confirm-options">
                  <EnrollmentConfirmOption
                    icon="payments"
                    title={t("confirmPayTitle")}
                    hint={t("confirmPayHint")}
                    selected={mode === "pay"}
                    onSelect={() => setMode("pay")}
                  />
                  <EnrollmentConfirmOption
                    icon="how_to_reg"
                    title={t("confirmServiceTitle")}
                    hint={t("confirmServiceHint")}
                    selected={mode === "confirm"}
                    onSelect={() => setMode("confirm")}
                  />
                  <EnrollmentConfirmOption
                    icon="save"
                    title={t("saveDraftTitle")}
                    hint={t("saveDraftHint")}
                    selected={mode === "draft"}
                    onSelect={() => setMode("draft")}
                  />
                </div>
              </div>

              {mode === "pay" ? (
                <PaymentMethodPicker
                  value={method}
                  onChange={(next) => setMethod(next)}
                  reference={reference}
                  onReferenceChange={setReference}
                />
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </RecordFormSheet>
  );
}
