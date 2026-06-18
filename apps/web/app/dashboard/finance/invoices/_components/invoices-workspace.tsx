"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { toastSuccess } from "../../../../lib/toast";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { DataTable } from "../../../../lib/data-table";
import { Field } from "../../../../lib/form";
import { Icon } from "../../../../lib/icon";
import { PaginationControls } from "../../../../lib/pagination-controls";
import { StudentCombobox } from "../../../../lib/student-combobox";
import { RecordFormSheet } from "../../../../lib/record-sheet";
import { TablePanelBody } from "../../../../lib/table-panel";
import { zodResolver } from "../../../../lib/zod-resolver";

type InvoiceSource = "enrollment" | "recurring" | "ad_hoc";

type Invoice = {
  id: string;
  invoiceNumber: string;
  studentFullName: string | null;
  total: string;
  status: string;
  dueDate: string | null;
  source: InvoiceSource;
  enrollmentId: string | null;
  updatedAt?: string;
};

type InvoiceList = { data: Invoice[]; total: number };

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
const PAGE_SIZE = 50;

function currentBillingMonth() {
  return new Date().toISOString().slice(0, 7);
}

type InvoicesToolbarProps = {
  gradeId?: string;
  gradeName?: string;
  onCreated?: () => void;
};

export function InvoicesToolbar({ gradeId, gradeName, onCreated }: InvoicesToolbarProps) {
  const t = useTranslations("finance");
  const c = useTranslations("common");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth);

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
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [INVOICES_PATH(tenant)],
      successMessage: t("createInvoiceSuccess")
    }
  );

  const generate = useApiMutation<
    { academicYearId: string; billingMonth: string; gradeId?: string },
    GenerateMonthlyResult
  >(
    (body, tenant) => ({
      path: `${INVOICES_PATH(tenant)}/generate-monthly`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [INVOICES_PATH(tenant)],
      showSuccessToast: false
    }
  );

  const schema = z.object({
    studentId: z.string().min(1, c("required")),
    dueDate: z.string(),
    description: z.string().trim().min(1, c("required")),
    unitAmount: z.string().min(1, c("required")),
    reason: z.string().trim().min(1, c("required"))
  });

  const form = useForm<CreateValues>({
    resolver: zodResolver(schema),
    defaultValues: { studentId: "", dueDate: "", description: "", unitAmount: "", reason: "" }
  });

  const handleGenerate = () => {
    void generate
      .mutateAsync({
        academicYearId: generateYearId,
        billingMonth,
        ...(gradeId ? { gradeId } : {})
      })
      .then((result) => {
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
                  grade: gradeName
                })
              : t("generateMonthlyCreated", {
                  count: result.invoicesCreated,
                  month: result.month
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
                grade: gradeName
              })
            : t("generateMonthlyNone", {
                month: result.month,
                skipped: result.studentsSkipped
              })
        );
      });
  };

  return (
    <>
      <div className="table-toolbar">
        <Field>
          <input
            type="month"
            aria-label={t("month")}
            value={billingMonth}
            onChange={(event) => setBillingMonth(event.target.value)}
          />
        </Field>
        <button
          type="button"
          className="btn-ghost"
          disabled={!generateYearId || !billingMonth || generate.isPending}
          onClick={handleGenerate}
        >
          <Icon name="bolt" />
          {generate.isPending ? c("loading") : t("generateMonthlyButton")}
        </button>
        <button type="button" className="btn-primary" onClick={() => setSheetOpen(true)}>
          <Icon name="add" />
          {t("createInvoice")}
        </button>
      </div>

      <RecordFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            form.reset();
          }
          setSheetOpen(open);
        }}
        title={t("createInvoice")}
        help={t("createInvoiceHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          await create.mutateAsync({
            studentId: values.studentId,
            dueDate: values.dueDate || undefined,
            reason: values.reason.trim(),
            items: [{ description: values.description, unitAmount: Number(values.unitAmount), quantity: 1 }]
          });
          form.reset();
          setSheetOpen(false);
          onCreated?.();
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setSheetOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting ? c("loading") : t("createInvoiceSubmit")}
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
          <input type="date" {...form.register("dueDate")} />
        </Field>
        <Field label={t("lineDescription")} error={form.formState.errors.description?.message}>
          <input {...form.register("description")} />
        </Field>
        <Field label={t("amount")} error={form.formState.errors.unitAmount?.message}>
          <input type="number" step="0.01" {...form.register("unitAmount")} />
        </Field>
        <Field label={t("chargeReason")} error={form.formState.errors.reason?.message}>
          <textarea rows={2} {...form.register("reason")} placeholder={t("chargeReasonPlaceholder")} />
        </Field>
      </RecordFormSheet>
    </>
  );
}

type InvoicesTableProps = {
  gradeId: string;
  academicYearId: string;
};

export function InvoicesTable({ gradeId, academicYearId }: InvoicesTableProps) {
  const t = useTranslations("finance");
  const c = useTranslations("common");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(0);

  const invoicesQuery = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      academicYearId,
      gradeId
    });
    if (sourceFilter) {
      params.set("source", sourceFilter);
    }
    return `?${params.toString()}`;
  }, [academicYearId, gradeId, page, sourceFilter]);

  const invoices = useApiQuery<InvoiceList>(
    (tenant) => `${INVOICES_PATH(tenant)}${invoicesQuery}`
  );

  const sourceLabel = (source: InvoiceSource) => {
    if (source === "enrollment") return t("sourceEnrollment");
    if (source === "recurring") return t("sourceRecurring");
    return t("sourceOther");
  };

  const columns: ColumnDef<Invoice, unknown>[] = [
    {
      id: "number",
      header: t("invoiceNumber"),
      accessorFn: (i) => i.invoiceNumber,
      cell: ({ row }) => row.original.invoiceNumber
    },
    { id: "student", header: t("student"), accessorFn: (i) => i.studentFullName ?? "—" },
    {
      id: "source",
      header: t("source"),
      accessorFn: (i) => sourceLabel(i.source)
    },
    { id: "total", header: t("total"), accessorKey: "total" },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    { id: "due", header: t("dueDate"), accessorFn: (i) => i.dueDate ?? "—" }
  ];

  return (
    <>
      <div className="table-toolbar table-toolbar--spaced">
        <label className="form-inline">
          <span className="muted">{t("source")}</span>
          <select
            value={sourceFilter}
            onChange={(event) => {
              setSourceFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="">{t("allSources")}</option>
            <option value="enrollment">{t("sourceEnrollment")}</option>
            <option value="recurring">{t("sourceRecurring")}</option>
            <option value="ad_hoc">{t("sourceOther")}</option>
          </select>
        </label>
      </div>
      <TablePanelBody
        loading={invoices.isLoading}
        error={invoices.isError ? c("somethingWrong") : null}
        empty={!invoices.data?.data.length}
      >
        <DataTable
          columns={columns}
          data={invoices.data?.data ?? []}
          getRowHref={(invoice) => `/dashboard/finance/invoices/${invoice.id}`}
        />
      </TablePanelBody>
      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={invoices.data?.total ?? 0}
        onPageChange={setPage}
      />
    </>
  );
}
