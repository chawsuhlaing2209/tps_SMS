"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";

type Component = {
  id: string;
  name: string;
  componentType: string;
  status: string;
  updatedAt?: string;
};

type FormValues = { name: string; componentType: string };
type FormMode = { type: "create" } | { type: "edit"; record: Component };

const COMPONENTS_PATH = (tenant: string) => `/tenants/${tenant}/salary/components`;

export default function SalaryComponentsPage() {
  const t = useTranslations("salary");
  const a = useTranslations("academics");
  const c = useTranslations("common");
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const components = useApiQuery<Component[]>(COMPONENTS_PATH);

  const create = useApiMutation<FormValues>(
    (body, tenant) => ({
      path: COMPONENTS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [COMPONENTS_PATH(tenant)] }
  );

  const update = useApiMutation<{ id: string } & FormValues>(
    ({ id, ...body }, tenant) => ({
      path: `${COMPONENTS_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [COMPONENTS_PATH(tenant)] }
  );

  const archive = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${COMPONENTS_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [COMPONENTS_PATH(tenant)] }
  );

  const reactivate = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${COMPONENTS_PATH(tenant)}/${id}/reactivate`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [COMPONENTS_PATH(tenant)] }
  );

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    componentType: z.string().trim().min(1, c("required"))
  });

  const defaultValues: FormValues = { name: "", componentType: "basic" };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues
  });

  const openCreate = () => {
    form.reset(defaultValues);
    setFormMode({ type: "create" });
  };

  const openEdit = (record: Component) => {
    form.reset({ name: record.name, componentType: record.componentType });
    setFormMode({ type: "edit", record });
  };

  const columns: ColumnDef<Component, unknown>[] = [
    { id: "name", header: c("name"), accessorKey: "name" },
    { id: "type", header: t("componentType"), accessorKey: "componentType" },
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
      header: a("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: "8px" }}>
          {row.original.status !== "archived" ? (
            <>
              <button type="button" className="row-action" onClick={() => openEdit(row.original)}>
                {a("edit")}
              </button>
              <button
                type="button"
                className="row-action"
                disabled={archive.isPending}
                onClick={() => void archive.mutateAsync({ id: row.original.id })}
              >
                {archive.isPending ? a("archiving") : a("archive")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="row-action"
              disabled={reactivate.isPending}
              onClick={() => void reactivate.mutateAsync({ id: row.original.id })}
            >
              {reactivate.isPending ? a("reactivating") : a("reactivate")}
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <section className="panel">
      <TablePanelHead
        title={t("components")}
        onRefresh={() => void components.refetch()}
        onAdd={openCreate}
        addLabel={t("addComponent")}
      />
      <TablePanelBody
        loading={components.isLoading}
        error={components.isError ? c("somethingWrong") : null}
        empty={!components.data?.length}
      >
        <DataTable columns={columns} data={components.data ?? []} />
      </TablePanelBody>

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            form.reset(defaultValues);
            setFormMode(null);
          }
        }}
        title={formMode?.type === "edit" ? t("editComponent") : t("addComponent")}
        onSubmit={form.handleSubmit(async (values) => {
          const payload = {
            name: values.name.trim(),
            componentType: values.componentType.trim()
          };
          if (formMode?.type === "edit") {
            await update.mutateAsync({ id: formMode.record.id, ...payload });
          } else {
            await create.mutateAsync(payload);
          }
          form.reset(defaultValues);
          setFormMode(null);
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setFormMode(null)}>
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <Field label={c("name")} error={form.formState.errors.name?.message}>
          <input {...form.register("name")} />
        </Field>
        <Field label={t("componentType")} error={form.formState.errors.componentType?.message}>
          <input {...form.register("componentType")} />
        </Field>
      </RecordFormSheet>
    </section>
  );
}
