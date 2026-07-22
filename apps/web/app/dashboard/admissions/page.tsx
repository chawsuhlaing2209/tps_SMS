"use client";
import { FormInput, TextAreaInput } from "../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { fetchAllPaginated } from "../../lib/export-csv";
import { getSession } from "../../lib/session";
import { DataTable, DirectoryNameCell } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { DataTableSection, TablePanelBody } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";
import { StatusBadge } from "../../../components/shared/badge";
import { ExportCsvButton } from "../../../components/shared/export-csv-button";
import { StatCard, StatGrid } from "../../../components/shared/stat-card";
import { ModulePageHeader } from "../module-page-header";

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
  const nav = useTranslations("nav");
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
        <StatusBadge
          status={row.original.status}
          label={
            t.has(`status_${row.original.status}` as "status_new")
              ? t(`status_${row.original.status}` as "status_new")
              : row.original.status
          }
        />
      )
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <RowMoreActionsMenu
          ariaLabel={c("moreActions")}
          items={[
            {
              id: "view",
              label: c("view"),
              icon: "visibility",
              onSelect: () => {
                window.location.href = `/dashboard/admissions/${row.original.id}`;
              }
            }
          ]}
        />
      )
    } satisfies ColumnDef<Enquiry, unknown>
  ];

  return (
    <div className="page-stack">
      <ModulePageHeader
        navKey="admissions"
        title={nav("admissions")}
        description={t("description")}
        actions={
          <>
            <ExportCsvButton
              disabled={enquiries.isLoading}
              onExport={async () => {
                const tenantId = getSession()?.tenantId;
                if (!tenantId) {
                  throw new Error(c("notSignedIn"));
                }
                const rows = await fetchAllPaginated<Enquiry>(
                  (limit, offset) =>
                    `/tenants/${tenantId}/admissions/enquiries?limit=${limit}&offset=${offset}`,
                  (json) => {
                    const payload = json as EnquiryList;
                    return { rows: payload.data, total: payload.total };
                  }
                );
                return {
                  filename: "enquiries.csv",
                  columns: [
                    { key: "prospectiveStudentName", header: t("prospect") },
                    { key: "targetGrade", header: t("grade") },
                    { key: "source", header: t("source") },
                    { key: "guardianPhone", header: t("guardianPhone") },
                    { key: "status", header: c("status") },
                    { key: "createdAt", header: t("when") }
                  ],
                  rows: rows.map((row) => ({
                    prospectiveStudentName: row.prospectiveStudentName,
                    targetGrade: row.targetGrade ?? "",
                    source: row.source,
                    guardianPhone: row.guardianPhone ?? "",
                    status: row.status,
                    createdAt: row.createdAt
                  }))
                };
              }}
            />
            <button type="button" className="pds-type-body-m-bold btn-primary" onClick={() => setSheetOpen(true)}>
              <Icon name="add" />
              {t("createEnquiry")}
            </button>
          </>
        }
      />
      <StatGrid>
        <StatCard
          icon={<Icon name="group_add" size={18} />}
          label={t("totalEnquiries")}
          value={dashboard.isLoading ? "…" : (dashboard.data?.totalEnquiries ?? 0)}
        />
      </StatGrid>

      <DataTableSection>

        <TablePanelBody
          loading={enquiries.isLoading}
          error={enquiries.isError ? c("somethingWrong") : null}
          empty={!enquiries.data?.data.length}
          emptyIcon="group_add"
          emptyTitle={t("empty")}
          emptyAction={
            <button type="button" className="pds-type-body-m-bold btn-primary" onClick={() => setSheetOpen(true)}>
              <Icon name="add" />
              {t("createEnquiry")}
            </button>
          }
        >
          <DataTable
            columns={columns}
            data={enquiries.data?.data ?? []}
            getRowHref={(enquiry) => `/dashboard/admissions/${enquiry.id}`}
            navigationFrom={{ label: nav("admissions"), href: "/dashboard/admissions" }}
          />
        </TablePanelBody>
      </DataTableSection>

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
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setSheetOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="add" />
              {form.formState.isSubmitting ? c("loading") : t("createEnquiry")}
            </button>
          </>
        }
      >
        <Field label={t("prospect")} error={form.formState.errors.prospectName?.message}>
          <FormInput {...form.register("prospectName")} />
        </Field>
        <Field label={t("guardianPhone")}>
          <FormInput {...form.register("guardianPhone")} />
        </Field>
        <Field label={t("grade")}>
          <FormInput {...form.register("interestedGrade")} />
        </Field>
        <Field label={t("source")} error={form.formState.errors.source?.message}>
          <FormInput {...form.register("source")} />
        </Field>
        <Field label={t("notes")}>
          <TextAreaInput maxLength={300} placeholder={t("notes")} {...form.register("notes")} />
        </Field>
      </RecordFormSheet>
    </div>
  );
}