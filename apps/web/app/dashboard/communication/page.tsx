"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";

type EmailTemplate = {
  id: string;
  key: string;
  language: string;
  subject: string;
  body: string;
  status: string;
  updatedAt?: string;
};

type NotificationLog = {
  id: string;
  recipient: string;
  channel: string;
  status: string;
  error: string | null;
  createdAt?: string;
};

type TemplateValues = {
  key: string;
  language: "en" | "my";
  subject: string;
  body: string;
  status: string;
};

type FormMode = { type: "create" } | { type: "edit"; template: EmailTemplate };

const TEMPLATES_PATH = (tenant: string) => `/tenants/${tenant}/email-templates`;
const LOGS_PATH = (tenant: string) => `/tenants/${tenant}/notification-logs`;

export default function CommunicationPage() {
  const t = useTranslations("communication");
  const c = useTranslations("common");
  const requiredMessage = c("required");

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const templates = useApiQuery<EmailTemplate[]>(TEMPLATES_PATH);

  const logsQuery = useMemo(
    () => (statusFilter ? `?status=${statusFilter}` : ""),
    [statusFilter]
  );
  const logs = useApiQuery<NotificationLog[]>((tn) => `${LOGS_PATH(tn)}${logsQuery}`);

  const create = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: TEMPLATES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [TEMPLATES_PATH(tenant)] }
  );

  const update = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenant) => {
      const { id, ...payload } = body;
      return {
        path: `${TEMPLATES_PATH(tenant)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    { invalidatePaths: (_b, tenant) => [TEMPLATES_PATH(tenant)] }
  );

  const resend = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${LOGS_PATH(tenant)}/${id}/resend`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [LOGS_PATH(tenant)] }
  );

  const schema = useMemo(
    () =>
      z.object({
        key: z.string().trim().min(1, requiredMessage),
        language: z.enum(["en", "my"]),
        subject: z.string().trim().min(1, requiredMessage),
        body: z.string().trim().min(1, requiredMessage),
        status: z.string()
      }),
    [requiredMessage]
  );

  const defaultValues: TemplateValues = {
    key: "",
    language: "en",
    subject: "",
    body: "",
    status: "active"
  };

  const form = useForm<TemplateValues>({ resolver: zodResolver(schema), defaultValues });

  const openCreate = () => {
    form.reset(defaultValues);
    setFormMode({ type: "create" });
  };

  const openEdit = (template: EmailTemplate) => {
    form.reset({
      key: template.key,
      language: template.language === "my" ? "my" : "en",
      subject: template.subject,
      body: template.body,
      status: template.status
    });
    setFormMode({ type: "edit", template });
  };

  const templateColumns: ColumnDef<EmailTemplate, unknown>[] = [
    { id: "key", header: t("key"), accessorKey: "key" },
    { id: "language", header: t("language"), accessorKey: "language" },
    { id: "subject", header: t("subject"), accessorKey: "subject" },
    {
      id: "status",
      header: t("status"),
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
        <button type="button" className="row-action" onClick={() => openEdit(row.original)}>
          {t("edit")}
        </button>
      )
    }
  ];

  const logColumns: ColumnDef<NotificationLog, unknown>[] = [
    { id: "recipient", header: t("recipient"), accessorKey: "recipient" },
    { id: "channel", header: t("channel"), accessorKey: "channel" },
    {
      id: "status",
      header: t("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    { id: "error", header: t("error"), accessorFn: (row) => row.error ?? "—" },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          className="row-action"
          disabled={resend.isPending}
          onClick={() => void resend.mutateAsync({ id: row.original.id })}
        >
          {resend.isPending ? t("resending") : t("resend")}
        </button>
      )
    }
  ];

  return (
    <div className="page-stack">
      <section className="panel">
        <TablePanelHead
          title={t("templatesTitle")}
          help={t("help")}
          onRefresh={() => void templates.refetch()}
          onAdd={openCreate}
          addLabel={t("addTemplate")}
        />
        <TablePanelBody
          loading={templates.isLoading}
          error={templates.isError ? c("somethingWrong") : null}
          empty={!templates.data?.length}
        >
          <DataTable columns={templateColumns} data={templates.data ?? []} />
        </TablePanelBody>
      </section>

      <section className="panel">
        <TablePanelHead
          title={t("logsTitle")}
          extra={
            <label className="form-inline">
              <span className="muted">{t("filterStatus")}</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{t("allStatuses")}</option>
                <option value="queued">queued</option>
                <option value="sent">sent</option>
                <option value="failed">failed</option>
              </select>
            </label>
          }
          onRefresh={() => void logs.refetch()}
        />
        <TablePanelBody
          loading={logs.isLoading}
          error={logs.isError ? c("somethingWrong") : null}
          empty={!logs.data?.length}
        >
          <DataTable columns={logColumns} data={logs.data ?? []} />
        </TablePanelBody>
      </section>

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            form.reset(defaultValues);
          }
        }}
        title={formMode?.type === "edit" ? t("editTemplateTitle") : t("addTemplateTitle")}
        onSubmit={form.handleSubmit(async (values) => {
          if (formMode?.type === "edit") {
            await update.mutateAsync({
              id: formMode.template.id,
              subject: values.subject,
              body: values.body,
              status: values.status
            });
          } else {
            await create.mutateAsync({
              key: values.key,
              language: values.language,
              subject: values.subject,
              body: values.body
            });
          }
          setFormMode(null);
          form.reset(defaultValues);
        })}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFormMode(null);
                form.reset(defaultValues);
              }}
            >
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("key")} error={form.formState.errors.key?.message}>
          <input type="text" disabled={formMode?.type === "edit"} {...form.register("key")} />
        </Field>
        <Field label={t("language")} error={form.formState.errors.language?.message}>
          <select disabled={formMode?.type === "edit"} {...form.register("language")}>
            <option value="en">English</option>
            <option value="my">မြန်မာ</option>
          </select>
        </Field>
        <Field label={t("subject")} error={form.formState.errors.subject?.message}>
          <input type="text" {...form.register("subject")} />
        </Field>
        <Field label={t("body")} error={form.formState.errors.body?.message}>
          <textarea rows={6} {...form.register("body")} />
        </Field>
        {formMode?.type === "edit" ? (
          <Field label={t("status")} error={form.formState.errors.status?.message}>
            <select {...form.register("status")}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </Field>
        ) : null}
      </RecordFormSheet>
    </div>
  );
}
