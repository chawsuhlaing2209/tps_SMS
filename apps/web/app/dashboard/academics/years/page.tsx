"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { zodResolver } from "../../../lib/zod-resolver";

type AcademicYear = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  updatedAt?: string;
};

type YearValues = { name: string; startsOn: string; endsOn: string };
type FormMode = { type: "create" } | { type: "edit"; year: AcademicYear };

export default function AcademicYearsPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const years = useApiQuery<AcademicYear[]>((tenant) => `/tenants/${tenant}/academics/academic-years`);

  const create = useApiMutation<YearValues>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/academics/academic-years`] }
  );

  const close = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years/${id}/close`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/academics/academic-years`] }
  );

  const reactivate = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years/${id}/reactivate`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/academics/academic-years`] }
  );

  const update = useApiMutation<YearValues & { id: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years/${body.id}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ name: body.name, startsOn: body.startsOn, endsOn: body.endsOn })
      }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/academics/academic-years`] }
  );

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    startsOn: z.string().min(1, c("required")),
    endsOn: z.string().min(1, c("required"))
  });

  const form = useForm<YearValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", startsOn: "", endsOn: "" }
  });

  const openCreate = () => {
    form.reset({ name: "", startsOn: "", endsOn: "" });
    setFormMode({ type: "create" });
  };

  const openEdit = (year: AcademicYear) => {
    form.reset({
      name: year.name,
      startsOn: year.startsOn,
      endsOn: year.endsOn
    });
    setFormMode({ type: "edit", year });
  };

  const columns: ColumnDef<AcademicYear, unknown>[] = [
    { id: "name", header: c("name"), accessorFn: (y) => y.name },
    { id: "starts", header: t("starts"), accessorFn: (y) => y.startsOn },
    { id: "ends", header: t("ends"), accessorFn: (y) => y.endsOn },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: "8px" }}>
          {row.original.status !== "archived" ? (
            <>
              <button
                type="button"
                className="row-action"
                onClick={() => openEdit(row.original)}
              >
                {t("edit")}
              </button>
              <button
                type="button"
                className="row-action"
                disabled={close.isPending}
                onClick={() => void close.mutateAsync({ id: row.original.id })}
              >
                {close.isPending ? t("archiving") : t("archive")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="row-action"
              disabled={reactivate.isPending}
              onClick={() => void reactivate.mutateAsync({ id: row.original.id })}
            >
              {reactivate.isPending ? t("reactivating") : t("reactivate")}
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <section className="panel">
      <TablePanelHead
        title={t("years")}
        onRefresh={() => void years.refetch()}
        onAdd={openCreate}
        addLabel={t("addYear")}
      />
      <TablePanelBody
        loading={years.isLoading}
        error={years.isError ? c("somethingWrong") : null}
        empty={!years.data?.length}
      >
        <DataTable columns={columns} data={years.data ?? []} />
      </TablePanelBody>

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            form.reset();
          }
        }}
        title={formMode?.type === "edit" ? t("editYearTitle") : t("addYearTitle")}
        help={t("yearFormHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          if (formMode?.type === "edit") {
            await update.mutateAsync({ ...values, id: formMode.year.id });
          } else {
            await create.mutateAsync(values);
          }
          setFormMode(null);
          form.reset();
        })}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFormMode(null);
                form.reset();
              }}
            >
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? t("creating")
                : formMode?.type === "edit"
                  ? t("saveYear")
                  : t("addYear")}
            </button>
          </>
        }
      >
        <Field label={c("name")} error={form.formState.errors.name?.message}>
          <input placeholder={t("yearNamePlaceholder")} {...form.register("name")} />
        </Field>
        <Field label={t("starts")} error={form.formState.errors.startsOn?.message}>
          <input type="date" {...form.register("startsOn")} />
        </Field>
        <Field label={t("ends")} error={form.formState.errors.endsOn?.message}>
          <input type="date" {...form.register("endsOn")} />
        </Field>
      </RecordFormSheet>
    </section>
  );
}
