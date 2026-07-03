"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Toggle } from "../../../components/shared/toggle";
import { ArchiveVisibilityFilter } from "../../../components/shared/archive-visibility-filter";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { EmptyState } from "../../../components/shared/empty-state";
import { FormField, FormInput, FormTextarea } from "../../../components/shared/form-input";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { StatusBadge } from "../../../components/shared/badge";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { filterByArchiveVisibility, type ArchiveVisibility } from "../../lib/archive-filter";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";
import { PageHeader } from "../page-header-context";

type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "inactive" | "archived";
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

  const [visibility, setVisibility] = useState<ArchiveVisibility>("active");
  const [deletingDepartment, setDeletingDepartment] = useState<DepartmentRow | null>(null);

  const departments = useApiQuery<DepartmentRow[]>((tenant) =>
    canManage ? DEPARTMENTS_PATH(tenant) : null
  );

  const visibleDepartments = useMemo(
    () => filterByArchiveVisibility(departments.data ?? [], visibility),
    [departments.data, visibility]
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

  const archiveDepartment = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${DEPARTMENTS_PATH(tenant)}/${id}/archive`, init: { method: "POST" } }),
    { invalidatePaths: (_b, tenant) => [DEPARTMENTS_PATH(tenant)] }
  );
  const restoreDepartment = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${DEPARTMENTS_PATH(tenant)}/${id}/restore`, init: { method: "POST" } }),
    { invalidatePaths: (_b, tenant) => [DEPARTMENTS_PATH(tenant)] }
  );
  const deleteDepartment = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${DEPARTMENTS_PATH(tenant)}/${id}`, init: { method: "DELETE" } }),
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
    return <EmptyState icon="lock" title={t("noAccess")} />;
  }

  return (
    <div className="directory-page">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: nav("group_admin") }, { label: nav("departments") }]}
        actions={
          <>
            <ArchiveVisibilityFilter value={visibility} onChange={setVisibility} />
            <button type="button" className="pds-type-body-m-bold btn-primary" onClick={openCreate}>
              <Icon name="add" />
              {t("addDepartment")}
            </button>
          </>
        }
      />

      <TablePanelBody
          loading={departments.isLoading}
          error={departments.isError ? c("somethingWrong") : null}
          empty={!visibleDepartments.length}
        >
          <ul className="departments-list">
            {visibleDepartments.map((row) => (
              <li key={row.id} className={row.status !== "active" ? "departments-list__item--inactive" : undefined}>
                <button type="button" className="departments-list__main" onClick={() => openEdit(row)}>
                  <strong>{row.name}</strong>
                  {row.description ? <span className="pds-type-body-s-regular muted">{row.description}</span> : null}
                  <span className="pds-type-body-s-regular muted">{t("staffCount", { count: row.staffCount })}</span>
                </button>
                {row.status === "archived" ? (
                  <StatusBadge status="archived" label={c("viewArchived")} />
                ) : (
                  <label className="pds-type-body-m-medium departments-list__toggle">
                    <span>{t("active")}</span>
                    <Toggle
                      checked={row.status === "active"}
                      onCheckedChange={(checked: boolean) => {
                        if (!checked && row.staffCount > 0) {
                          setFormError(t("cannotDisableWithStaff", { count: row.staffCount }));
                          return;
                        }
                        void toggleStatus(row, checked);
                      }}
                    />
                  </label>
                )}
                <RowMoreActionsMenu
                  ariaLabel={c("moreActions")}
                  items={[
                    {
                      id: "edit",
                      label: c("edit"),
                      icon: "edit",
                      onSelect: () => openEdit(row)
                    },
                    ...(row.status === "archived"
                      ? [
                          {
                            id: "restore",
                            label: c("restore"),
                            icon: "restore",
                            onSelect: () =>
                              void restoreDepartment.mutateAsync({ id: row.id }).then(() => {
                                void departments.refetch();
                              })
                          },
                          {
                            id: "delete",
                            label: c("deletePermanently"),
                            icon: "delete_forever",
                            destructive: true,
                            onSelect: () => setDeletingDepartment(row)
                          }
                        ]
                      : [
                          {
                            id: "archive",
                            label: c("archive"),
                            icon: "archive",
                            destructive: true,
                            onSelect: () =>
                              void archiveDepartment.mutateAsync({ id: row.id }).then(() => {
                                void departments.refetch();
                              })
                          }
                        ])
                  ]}
                />
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
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setCreateOpen(false)}>
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
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
        {formError ? <p className="pds-type-body-m-medium error-text">{formError}</p> : null}
      </RecordFormSheet>

      <ConfirmDialog
        open={deletingDepartment !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingDepartment(null);
        }}
        title={t("deleteDepartmentTitle")}
        description={t("deleteDepartmentHelp", { name: deletingDepartment?.name ?? "" })}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteDepartment.isPending}
        onConfirm={async () => {
          if (!deletingDepartment) return;
          await deleteDepartment.mutateAsync({ id: deletingDepartment.id });
          setDeletingDepartment(null);
          void departments.refetch();
        }}
      />
    </div>
  );
}