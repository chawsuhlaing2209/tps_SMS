"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable, DirectoryNameCell } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";
import { StatusBadge } from "../../../components/shared/badge";
import { StatCard, StatGrid } from "../../../components/shared/stat-card";

type Enquiry = {
  id: string;
  prospectiveStudentName: string;
  guardianPhone: string | null;
  targetGrade: string | null;
  status: string;
  source: string;
  createdAt: string;
  updatedAt?: string;
};

type EnquiryList = { data: Enquiry[]; total: number };

type DashboardStats = {
  totalEnquiries: number;
  byStatus: Record<string, number>;
  conversionRate: number;
};

type CreateValues = {
  prospectName: string;
  guardianPhone: string;
  interestedGrade: string;
  source: string;
  notes: string;
};

const ENQUIRIES_PATH = (tenant: string) => `/tenants/${tenant}/admissions/enquiries`;

export default function AdmissionsPage() {
  const t = useTranslations("admissions");
  const c = useTranslations("common");
  const [sheetOpen, setSheetOpen] = useState(false);

  const dashboard = useApiQuery<DashboardStats>(
    (tenant) => `/tenants/${tenant}/admissions/dashboard`
  );
  const enquiries = useApiQuery<EnquiryList>(ENQUIRIES_PATH);

  const create = useApiMutation<CreateValues>(
    (body, tenant) => ({
      path: ENQUIRIES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [ENQUIRIES_PATH(tenant), `/tenants/${tenant}/admissions/dashboard`] }
  );

  const schema = z.object({
    prospectName: z.string().trim().min(1, c("required")),
    guardianPhone: z.string(),
    interestedGrade: z.string(),
    source: z.string().trim().min(1, c("required")),
    notes: z.string()
  });

  const form = useForm<CreateValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      prospectName: "",
      guardianPhone: "",
      interestedGrade: "",
      source: "walk-in",
      notes: ""
    }
  });

  const columns: ColumnDef<Enquiry, unknown>[] = [
    {
      id: "name",
      header: t("prospect"),
      accessorFn: (e) => e.prospectiveStudentName,
      cell: ({ row }) => (
        <DirectoryNameCell name={row.original.prospectiveStudentName} />
      )
    },
    { id: "grade", header: t("grade"), accessorFn: (e) => e.targetGrade ?? "—" },
    { id: "source", header: t("source"), accessorKey: "source" },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      )
    }
  ];

  return (
    <div className="page-stack">
      <StatGrid>
        <StatCard
          icon={<Icon name="group_add" size={18} />}
          label={t("totalEnquiries")}
          value={dashboard.isLoading ? "…" : (dashboard.data?.totalEnquiries ?? 0)}
        />
      </StatGrid>

      <TablePanelHead
          title={t("listTitle")}
          onRefresh={() => void enquiries.refetch()}
          onAdd={() => setSheetOpen(true)}
          addLabel={t("createEnquiry")}
        />
      <TablePanelBody
          loading={enquiries.isLoading}
          error={enquiries.isError ? c("somethingWrong") : null}
          empty={!enquiries.data?.data.length}
        >
          <DataTable
            columns={columns}
            data={enquiries.data?.data ?? []}
            getRowHref={(enquiry) => `/dashboard/admissions/${enquiry.id}`}
          />
        </TablePanelBody>

      <RecordFormSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            form.reset({ prospectName: "", guardianPhone: "", interestedGrade: "", source: "walk-in", notes: "" });
          }
          setSheetOpen(open);
        }}
        title={t("createTitle")}
        onSubmit={form.handleSubmit(async (values) => {
          await create.mutateAsync({
            prospectName: values.prospectName,
            guardianPhone: values.guardianPhone || undefined,
            interestedGrade: values.interestedGrade || undefined,
            source: values.source,
            notes: values.notes || undefined
          } as CreateValues);
          form.reset({ prospectName: "", guardianPhone: "", interestedGrade: "", source: "walk-in", notes: "" });
          setSheetOpen(false);
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setSheetOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="add" />
              {form.formState.isSubmitting ? c("loading") : t("createEnquiry")}
            </button>
          </>
        }
      >
        <Field label={t("prospect")} error={form.formState.errors.prospectName?.message}>
          <input {...form.register("prospectName")} />
        </Field>
        <Field label={t("guardianPhone")}>
          <input {...form.register("guardianPhone")} />
        </Field>
        <Field label={t("grade")}>
          <input {...form.register("interestedGrade")} />
        </Field>
        <Field label={t("source")} error={form.formState.errors.source?.message}>
          <input {...form.register("source")} />
        </Field>
        <Field label={t("notes")}>
          <textarea rows={2} {...form.register("notes")} />
        </Field>
      </RecordFormSheet>
    </div>
  );
}