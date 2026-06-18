"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Toggle } from "../../../components/shared/toggle";
import { FormField, FormInput, FormTextarea } from "../../../components/shared/form-input";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";
import { PageHeader } from "../page-header-context";

type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  staffCount: number;
};

const DEPARTMENTS_PATH = (tenant: string) => `/tenants/${tenant}/departments`;

export default function DepartmentsPage() {
  const t = useTranslations("departments");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["hr.manage"]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const departments = useApiQuery<DepartmentRow[]>((tenant) =>
    canManage ? DEPARTMENTS_PATH(tenant) : null
  );

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    description: z.string()
  });

  const form = useForm<{ name: string; description: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" }
  });

  const createDepartment = useApiMutation(
    (body, tenant) => ({
      path: DEPARTMENTS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [DEPARTMENTS_PATH(tenant)] }
  );

  const updateDepartment = useApiMutation(
    ({ departmentId, body }: { departmentId: string; body: Record<string, unknown> }, tenant) => ({
      path: `${DEPARTMENTS_PATH(tenant)}/${departmentId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [DEPARTMENTS_PATH(tenant)] }
  );

  function openCreate() {
    form.reset({ name: "", description: "" });
    setEditId(null);
    setCreateOpen(true);
  }

  function openEdit(row: DepartmentRow) {
    form.reset({ name: row.name, description: row.description ?? "" });
    setEditId(row.id);
    setCreateOpen(true);
  }

  async function onSubmit(values: { name: string; description: string }) {
    setFormError(null);
    try {
      if (editId) {
        await updateDepartment.mutateAsync({
          departmentId: editId,
          body: { name: values.name.trim(), description: values.description.trim() || undefined }
        });
      } else {
        await createDepartment.mutateAsync({
          name: values.name.trim(),
          description: values.description.trim() || undefined
        });
      }
      setCreateOpen(false);
      form.reset();
      setEditId(null);
      void departments.refetch();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  }

  async function toggleStatus(row: DepartmentRow, active: boolean) {
    try {
      await updateDepartment.mutateAsync({
        departmentId: row.id,
        body: { status: active ? "active" : "inactive" }
      });
      void departments.refetch();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  }

  if (!canManage) {
    return <p className="muted">{t("noAccess")}</p>;
  }

  return (
    <div className="directory-page">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("group_admin") }, { label: nav("departments") }]}
      />

      <TablePanelHead
        title={t("listTitle")}
        help={t("listHelp")}
        onRefresh={() => void departments.refetch()}
        onAdd={openCreate}
        addLabel={t("addDepartment")}
      />
      <TablePanelBody
          loading={departments.isLoading}
          error={departments.isError ? c("somethingWrong") : null}
          empty={!departments.data?.length}
        >
          <ul className="departments-list">
            {departments.data?.map((row) => (
              <li key={row.id} className={row.status === "inactive" ? "departments-list__item--inactive" : undefined}>
                <button type="button" className="departments-list__main" onClick={() => openEdit(row)}>
                  <strong>{row.name}</strong>
                  {row.description ? <span className="muted">{row.description}</span> : null}
                  <span className="muted">{t("staffCount", { count: row.staffCount })}</span>
                </button>
                <label className="departments-list__toggle">
                  <span>{t("active")}</span>
                  <Toggle
                    checked={row.status === "active"}
                    disabled={row.status === "active" && row.staffCount > 0 ? false : false}
                    onCheckedChange={(checked: boolean) => {
                      if (!checked && row.staffCount > 0) {
                        setFormError(t("cannotDisableWithStaff", { count: row.staffCount }));
                        return;
                      }
                      void toggleStatus(row, checked);
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        </TablePanelBody>

      <RecordFormSheet
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            form.reset();
            setEditId(null);
          }
          setCreateOpen(open);
        }}
        title={editId ? t("editDepartment") : t("addDepartment")}
        help={t("formHelp")}
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={createDepartment.isPending || updateDepartment.isPending}
            >
              {c("save")}
            </button>
          </>
        }
      >
        <FormField label={t("name")} error={form.formState.errors.name?.message}>
          <FormInput {...form.register("name")} />
        </FormField>
        <FormField label={t("descriptionLabel")}>
          <FormTextarea {...form.register("description")} rows={3} />
        </FormField>
        {formError ? <p className="error-text">{formError}</p> : null}
      </RecordFormSheet>
    </div>
  );
}