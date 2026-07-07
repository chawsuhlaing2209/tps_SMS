"use client";
import { FormInput } from "../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { type UseQueryResult } from "@tanstack/react-query";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { useApiMutation, useReferenceApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";

type StatusRecord = { id: string; status: string; updatedAt?: string };

export type MasterField = {
  key: string;
  label: string;
  type: "text" | "number";
  placeholder?: string;
  optional?: boolean;
};

export function useMasterDataResource<T extends StatusRecord = StatusRecord>(resource: string) {
  const path = (tenantId: string) => `/tenants/${tenantId}/academics/${resource}`;

  const query = useReferenceApiQuery<T[]>(path);

  const create = useApiMutation<Record<string, unknown>>(
    (body, tenantId) => ({
      path: path(tenantId),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_body, tenantId) => [path(tenantId)] }
  );

  const update = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenantId) => {
      const { id, ...payload } = body;
      return {
        path: `${path(tenantId)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    { invalidatePaths: (_body, tenantId) => [path(tenantId)] }
  );

  const archive = useApiMutation<{ id: string }>(
    ({ id }, tenantId) => ({
      path: `${path(tenantId)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_body, tenantId) => [path(tenantId)] }
  );

  const reactivate = useApiMutation<{ id: string }>(
    ({ id }, tenantId) => ({
      path: `${path(tenantId)}/${id}/restore`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_body, tenantId) => [path(tenantId)] }
  );

  return { query, create, update, archive, reactivate };
}

type FormMode<T> = { type: "create" } | { type: "edit"; record: T };

function buildSchema(fields: MasterField[], requiredMessage: string) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.type === "number") {
      shape[field.key] = field.optional
        ? z.coerce.number().optional()
        : z.coerce.number({ invalid_type_error: requiredMessage });
    } else {
      shape[field.key] = field.optional
        ? z.string()
        : z.string().trim().min(1, requiredMessage);
    }
  }
  return z.object(shape);
}

export function MasterDataPanel<T extends StatusRecord>({
  title,
  query,
  create,
  update,
  archive,
  reactivate,
  fields,
  columns,
  addLabel,
  editTitle,
  createTitle,
  canManage = true
}: {
  title: string;
  query: UseQueryResult<T[]>;
  create: ReturnType<typeof useMasterDataResource>["create"];
  update: ReturnType<typeof useMasterDataResource>["update"];
  archive: ReturnType<typeof useMasterDataResource>["archive"];
  reactivate: ReturnType<typeof useMasterDataResource>["reactivate"];
  fields: MasterField[];
  columns: ColumnDef<T, unknown>[];
  addLabel?: string;
  editTitle: string;
  createTitle: string;
  canManage?: boolean;
}) {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const [formMode, setFormMode] = useState<FormMode<T> | null>(null);
  const [archivingRecord, setArchivingRecord] = useState<T | null>(null);
  const requiredMessage = c("required");

  const defaultValues = useMemo(() => {
    const values: Record<string, string | number> = {};
    for (const field of fields) {
      values[field.key] = field.type === "number" ? 0 : "";
    }
    return values;
  }, [fields]);

  const schema = useMemo(
    () => buildSchema(fields, requiredMessage),
    [fields, requiredMessage]
  );

  const form = useForm<Record<string, string | number>>({
    resolver: zodResolver(schema),
    defaultValues
  });

  const openCreate = () => {
    form.reset(defaultValues);
    setFormMode({ type: "create" });
  };

  const openEdit = (record: T) => {
    const values: Record<string, string | number> = {};
    for (const field of fields) {
      const raw = (record as Record<string, unknown>)[field.key];
      values[field.key] =
        field.type === "number" ? Number(raw ?? 0) : String(raw ?? "");
    }
    form.reset(values);
    setFormMode({ type: "edit", record });
  };

  const tableColumns: ColumnDef<T, unknown>[] = [
    ...columns,
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) =>
        canManage ? (
          row.original.status !== "archived" ? (
            <RowMoreActionsMenu
              ariaLabel={c("moreActions")}
              items={[
                {
                  id: "view",
                  label: c("view"),
                  icon: "visibility",
                  onSelect: () => openEdit(row.original)
                },
                {
                  id: "edit",
                  label: c("edit"),
                  icon: "edit",
                  onSelect: () => openEdit(row.original)
                },
                {
                  id: "archive",
                  label: t("archive"),
                  icon: "inventory_2",
                  destructive: true,
                  onSelect: () => setArchivingRecord(row.original)
                }
              ]}
            />
          ) : (
            <RowMoreActionsMenu
              ariaLabel={c("moreActions")}
              items={[
                {
                  id: "view",
                  label: c("view"),
                  icon: "visibility",
                  onSelect: () => openEdit(row.original)
                },
                {
                  id: "reactivate",
                  label: t("reactivate"),
                  icon: "restore",
                  disabled: reactivate.isPending,
                  onSelect: () => void reactivate.mutateAsync({ id: row.original.id })
                }
              ]}
            />
          )
        ) : null
    }
  ];

  const error = query.isError
    ? query.error instanceof Error
      ? query.error.message
      : c("somethingWrong")
    : null;

  return (
    <>
      <TablePanelBody loading={query.isLoading} error={error} empty={!query.data?.length}>
        <DataTable
          columns={tableColumns}
          data={query.data ?? []}
          onRowClick={(record) => openEdit(record)}
        />
      </TablePanelBody>

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            form.reset(defaultValues);
          }
        }}
        title={formMode?.type === "edit" ? editTitle : createTitle}
        onSubmit={form.handleSubmit(async (values) => {
          const payload: Record<string, unknown> = {};
          for (const field of fields) {
            const value = values[field.key];
            if (field.type === "number") {
              payload[field.key] = Number(value);
            } else if (field.optional && value === "") {
              payload[field.key] = undefined;
            } else {
              payload[field.key] = value;
            }
          }

          if (formMode?.type === "edit") {
            await update.mutateAsync({ id: formMode.record.id, ...payload });
          } else {
            await create.mutateAsync(payload);
          }
          setFormMode(null);
          form.reset(defaultValues);
        })}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => {
                setFormMode(null);
                form.reset(defaultValues);
              }}
            >
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting
                ? t("creating")
                : formMode?.type === "edit"
                  ? c("save")
                  : addLabel ?? c("add")}
            </button>
          </>
        }
      >
        {fields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            error={form.formState.errors[field.key]?.message as string | undefined}
          >
            <FormInput
              type={field.type === "number" ? "number" : "text"}
              placeholder={field.placeholder}
              {...form.register(field.key)}
            />
          </Field>
        ))}
      </RecordFormSheet>

      <ConfirmDialog
        open={archivingRecord !== null}
        onOpenChange={(open) => {
          if (!open) setArchivingRecord(null);
        }}
        title={t("archiveRecordTitle")}
        description={t("archiveRecordHelp")}
        confirmLabel={t("archive")}
        destructive
        loading={archive.isPending}
        onConfirm={async () => {
          if (!archivingRecord) return;
          await archive.mutateAsync({ id: archivingRecord.id });
          setArchivingRecord(null);
        }}
      />
    </>
  );
}