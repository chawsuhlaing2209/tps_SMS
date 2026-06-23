"use client";

import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useDashPageTitleActionsTarget } from "../../../dashboard-page-title";
import { Button } from "../../../../../components/ui/button";
import { FormInput } from "../../../../../components/shared/form-input";
import { PdsDatePickerField } from "../../../../../components/pds";
import { useApiMutation } from "../../../../lib/api";
import { Field } from "../../../../lib/form";
import { Icon } from "../../../../lib/material-icon";
import { RecordFormSheet } from "../../../../lib/record-sheet";
import { RecordFormModal } from "../../../../lib/record-modal";
import { StudentCombobox } from "../../../../lib/student-combobox";
import { toastSuccess } from "../../../../lib/toast";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { zodResolver } from "../../../../lib/zod-resolver";

type InvoiceSource = "enrollment" | "recurring" | "ad_hoc";

type GenerateMonthlyResult = {
  status: "queued" | "completed";
  message: string;
  month: string;
  invoicesCreated: number;
  studentsSkipped: number;
  studentsProcessed: number;
  invoiceIds: string[];
};

type CreateValues = {
  studentId: string;
  dueDate: string;
  description: string;
  unitAmount: string;
  reason: string;
};

const INVOICES_PATH = (tenant: string) => `/tenants/${tenant}/finance/invoices`;

function currentBillingMonth() {
  return new Date().toISOString().slice(0, 7);
}

type InvoicesActionsContextValue = {
  issueDateRange: string;
  setIssueDateRange: (value: string) => void;
  gradeId?: string;
  gradeName?: string;
  openCreateSheet: () => void;
  handleGenerate: () => void;
  generatePending: boolean;
  generateDisabled: boolean;
};

const InvoicesActionsContext = createContext<InvoicesActionsContextValue | null>(null);

export function useInvoicesActionsContext() {
  const ctx = useContext(InvoicesActionsContext);
  if (!ctx) {
    throw new Error("Invoices actions components must be used within InvoicesActionsProvider");
  }
  return ctx;
}

export type InvoicesActionsProviderProps = {
  children: ReactNode;
  gradeId?: string;
  gradeName?: string;
  onCreated?: () => void;
};

export function InvoicesActionsProvider({
  children,
  gradeId,
  gradeName,
  onCreated,
}: InvoicesActionsProviderProps) {
  const t = useTranslations("finance");
  const c = useTranslations("common");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(() => currentBillingMonth());
  const [issueDateRange, setIssueDateRange] = useState("");

  const currentYear = useCurrentAcademicYear();
  const generateYearId = currentYear.data?.id ?? "";

  const create = useApiMutation<{
    studentId: string;
    dueDate?: string;
    reason?: string;
    items: Array<{ description: string; unitAmount: number; quantity?: number }>;
  }>(
    (body, tenant) => ({
      path: INVOICES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) },
    }),
    {
      invalidatePaths: (_b, tenant) => [
        INVOICES_PATH(tenant),
        `${INVOICES_PATH(tenant)}/metrics`,
        `/tenants/${tenant}/finance/billing/roster`,
      ],
      successMessage: t("createInvoiceSuccess"),
    }
  );

  const generate = useApiMutation<
    { academicYearId: string; billingMonth: string; gradeId?: string },
    GenerateMonthlyResult
  >(
    (body, tenant) => ({
      path: `${INVOICES_PATH(tenant)}/generate-monthly`,
      init: { method: "POST", body: JSON.stringify(body) },
    }),
    {
      invalidatePaths: (_b, tenant) => [
        INVOICES_PATH(tenant),
        `${INVOICES_PATH(tenant)}/metrics`,
        `/tenants/${tenant}/finance/billing/roster`,
      ],
      showSuccessToast: false,
    }
  );

  const schema = z.object({
    studentId: z.string().min(1, c("required")),
    dueDate: z.string(),
    description: z.string().trim().min(1, c("required")),
    unitAmount: z.string().min(1, c("required")),
    reason: z.string().trim().min(1, c("required")),
  });

  const form = useForm<CreateValues>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: "", dueDate: "", description: "", unitAmount: "", reason: "" },
  });

  const handleGenerate = useCallback(() => {
    setGenerateMonth(currentBillingMonth());
    setGenerateModalOpen(true);
  }, []);

  const confirmGenerate = useCallback(() => {
    if (!generateMonth) return;

    void generate
      .mutateAsync({
        academicYearId: generateYearId,
        billingMonth: generateMonth,
        ...(gradeId ? { gradeId } : {}),
      })
      .then((result) => {
        setGenerateModalOpen(false);

        if (result.status === "queued") {
          toastSuccess(t("generateMonthlyQueued", { month: result.month }));
          return;
        }

        if (result.invoicesCreated > 0) {
          toastSuccess(
            gradeName
              ? t("generateMonthlyGradeCreated", {
                  count: result.invoicesCreated,
                  month: result.month,
                  grade: gradeName,
                })
              : t("generateMonthlyCreated", {
                  count: result.invoicesCreated,
                  month: result.month,
                })
          );
          onCreated?.();
          return;
        }

        toastSuccess(
          gradeName
            ? t("generateMonthlyGradeNone", {
                month: result.month,
                skipped: result.studentsSkipped,
                grade: gradeName,
              })
            : t("generateMonthlyNone", {
                month: result.month,
                skipped: result.studentsSkipped,
              })
        );
      });
  }, [generate, generateMonth, generateYearId, gradeId, gradeName, onCreated, t]);

  const value = useMemo(
    () => ({
      issueDateRange,
      setIssueDateRange,
      gradeId,
      gradeName,
      openCreateSheet: () => setSheetOpen(true),
      handleGenerate,
      generatePending: generate.isPending,
      generateDisabled: !generateYearId || generate.isPending,
    }),
    [issueDateRange, gradeId, gradeName, generate.isPending, generateYearId, handleGenerate]
  );

  return (
    <InvoicesActionsContext.Provider value={value}>
      {children}
      <RecordFormModal
        open={generateModalOpen}
        onOpenChange={setGenerateModalOpen}
        title={t("generateMonthlyModalTitle")}
        help={t("generateMonthlyModalHelp")}
        headerIcon="bolt"
        onSubmit={(event) => {
          event.preventDefault();
          confirmGenerate();
        }}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setGenerateModalOpen(false)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={!generateMonth || generate.isPending}
            >
              <Icon name="bolt" />
              {generate.isPending ? c("loading") : t("generateMonthlyButton")}
            </button>
          </>
        }
      >
        <Field label={t("month")}>
          <PdsDatePickerField
            type="month"
            variant="form"
            value={generateMonth}
            onValueChange={setGenerateMonth}
            placeholder={t("month")}
            ariaLabel={t("month")}
          />
        </Field>
      </RecordFormModal>
      <RecordFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) form.reset();
          setSheetOpen(open);
        }}
        title={t("createAdHocInvoice")}
        help={t("createInvoiceHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          await create.mutateAsync({
            studentId: values.studentId,
            dueDate: values.dueDate || undefined,
            reason: values.reason.trim(),
            items: [
              { description: values.description, unitAmount: Number(values.unitAmount), quantity: 1 },
            ],
          });
          form.reset();
          setSheetOpen(false);
          onCreated?.();
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setSheetOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting ? c("loading") : t("createAdHocInvoiceSubmit")}
            </button>
          </>
        }
      >
        <Field label={t("student")} error={form.formState.errors.studentId?.message}>
          <StudentCombobox
            value={form.watch("studentId")}
            onChange={(studentId) => form.setValue("studentId", studentId, { shouldValidate: true })}
          />
        </Field>
        <Field label={t("dueDate")}>
          <PdsDatePickerField
            type="day"
            variant="form"
            value={form.watch("dueDate")}
            onValueChange={(next) => form.setValue("dueDate", next, { shouldValidate: true })}
            placeholder={t("dueDate")}
            ariaLabel={t("dueDate")}
          />
        </Field>
        <Field label={t("lineDescription")} error={form.formState.errors.description?.message}>
          <FormInput {...form.register("description")} />
        </Field>
        <Field label={t("amount")} error={form.formState.errors.unitAmount?.message}>
          <FormInput type="number" step="0.01" {...form.register("unitAmount")} />
        </Field>
        <Field label={t("chargeReason")} error={form.formState.errors.reason?.message}>
          <textarea rows={2} {...form.register("reason")} placeholder={t("chargeReasonPlaceholder")} />
        </Field>
      </RecordFormSheet>
    </InvoicesActionsContext.Provider>
  );
}

/** Title-row CTAs — generate + create invoice (Figma 76:9987). */
export function InvoicesHeaderActions() {
  const t = useTranslations("finance");
  const c = useTranslations("common");
  const { openCreateSheet, handleGenerate, generatePending, generateDisabled } =
    useInvoicesActionsContext();

  return (
    <>
      <Button
        type="button"
        buttonType="outlined"
        buttonColor="secondary"
        prefixIcon="bolt"
        disabled={generateDisabled}
        onClick={handleGenerate}
      >
        {generatePending ? c("loading") : t("generateMonthlyButton")}
      </Button>
      <Button
        type="button"
        buttonType="filled"
        buttonColor="primary"
        prefixIcon="add"
        onClick={openCreateSheet}
      >
        {t("createInvoice")}
      </Button>
    </>
  );
}

/** Portals {@link InvoicesHeaderActions} into the layout title row (inside provider context). */
export function InvoicesHeaderActionsPortal() {
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(<InvoicesHeaderActions />, target);
}

/** Issue date range filter — lives in the page toolbar row. */
export function InvoicesIssueDateRangeFilter() {
  const t = useTranslations("finance");
  const { issueDateRange, setIssueDateRange } = useInvoicesActionsContext();

  return (
    <PdsDatePickerField
      type="day"
      variant="filter"
      selectionMode="range"
      value={issueDateRange}
      onValueChange={setIssueDateRange}
      ariaLabel={t("issueDateRange")}
      placeholder={t("issueDateRange")}
    />
  );
}

/** @deprecated Use {@link InvoicesIssueDateRangeFilter}. */
export const InvoicesBillingMonthFilter = InvoicesIssueDateRangeFilter;

export type { InvoiceSource };
