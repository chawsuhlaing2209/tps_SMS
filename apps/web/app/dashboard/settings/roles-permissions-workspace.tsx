"use client";
import { FormInput } from "../../../components/shared/form-input";

import {
  categoryBadgeColor,
  permissionCategories,
  roleDisplayFor,
  tenantPermissionCatalog,
  tenantStaffRoleKeys,
  type PermissionCategory
} from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Toggle } from "../../../components/shared/toggle";
import { EmptyState } from "../../../components/shared/empty-state";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { ApiError, useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { zodResolver } from "../../lib/zod-resolver";
import { PageHeader } from "../page-header-context";

type RoleRow = {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  userCount: number;
  status: "active" | "inactive";
};

function sortRoles(rows: RoleRow[]) {
  const order = new Map(tenantStaffRoleKeys.map((key, index) => [key, index]));
  return [...rows].sort((a, b) => {
    const aOrder = order.get(a.key as (typeof tenantStaffRoleKeys)[number]);
    const bOrder = order.get(b.key as (typeof tenantStaffRoleKeys)[number]);
    if (aOrder != null && bOrder != null) {
      return aOrder - bOrder;
    }
    if (aOrder != null) {
      return -1;
    }
    if (bOrder != null) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function countCategory(rolePermissions: Set<string>, category: PermissionCategory) {
  const group = tenantPermissionCatalog.find((entry) => entry.category === category);
  if (!group) {
    return { enabled: 0, total: 0 };
  }
  const enabled = group.items.filter((item) => rolePermissions.has(item.permission)).length;
  return { enabled, total: group.items.length };
}

export function RolesPermissionsWorkspace() {
  const t = useTranslations("settings.roles");
  const p = useTranslations("settings.permissions");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["identity.manage"]);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const roles = useApiQuery<RoleRow[]>((tenant) =>
    canManage ? `/tenants/${tenant}/identity/roles` : null
  );

  const sortedRoles = useMemo(
    () =>
      sortRoles(
        (roles.data ?? []).filter(
          (role) => !["parent_guardian", "student", "platform_super_admin"].includes(role.key)
        )
      ),
    [roles.data]
  );
  const selectedRole = sortedRoles.find((role) => role.id === selectedRoleId) ?? null;
  const selectedDisplay = selectedRole
    ? roleDisplayFor(selectedRole.key, selectedRole.name)
    : null;

  useEffect(() => {
    if (!sortedRoles.length) {
      setSelectedRoleId(null);
      return;
    }
    if (!selectedRoleId || !sortedRoles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(sortedRoles[0]!.id);
    }
  }, [sortedRoles, selectedRoleId]);

  useEffect(() => {
    if (!selectedRole) {
      setDraftPermissions([]);
      setDirty(false);
      return;
    }
    setDraftPermissions(selectedRole.permissions);
    setDirty(false);
    setFormError(null);
    setStatusError(null);
  }, [selectedRole?.id, selectedRole?.permissions, selectedRole?.status]);

  const updateRole = useApiMutation<
    { permissions?: string[]; status?: "active" | "inactive" },
    RoleRow
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/identity/roles/${selectedRoleId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/identity/roles`]
    }
  );

  const createRole = useApiMutation<{ name: string }, RoleRow>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/identity/roles`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/identity/roles`]
    }
  );

  const draftSet = useMemo(() => new Set(draftPermissions), [draftPermissions]);

  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        permissionCategories.map((category) => [category, countCategory(draftSet, category)])
      ) as Record<PermissionCategory, { enabled: number; total: number }>,
    [draftSet]
  );

  const allEnabled = tenantPermissionCatalog.every((group) =>
    group.items.every((item) => draftSet.has(item.permission))
  );

  const togglePermission = (permission: string, checked: boolean) => {
    setDraftPermissions((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      return [...next];
    });
    setDirty(true);
    setSaved(false);
  };

  const saveRole = async () => {
    if (!selectedRoleId) {
      return;
    }
    setFormError(null);
    try {
      await updateRole.mutateAsync({ permissions: draftPermissions });
      setDirty(false);
      setSaved(true);
      void roles.refetch();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const setRoleStatus = async (status: "active" | "inactive") => {
    if (!selectedRoleId) {
      return;
    }
    setStatusError(null);
    setFormError(null);
    try {
      await updateRole.mutateAsync({ status });
      setDisableConfirmOpen(false);
      void roles.refetch();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : c("somethingWrong");
      setStatusError(message);
      setDisableConfirmOpen(false);
    }
  };

  const handleRoleEnabledChange = (checked: boolean) => {
    if (!selectedRole) {
      return;
    }
    setStatusError(null);
    if (checked) {
      void setRoleStatus("active");
      return;
    }
    if (selectedRole.userCount > 0) {
      setStatusError(t("cannotDisableRoleWithUsers", { count: selectedRole.userCount }));
      return;
    }
    setDisableConfirmOpen(true);
  };

  const createSchema = z.object({
    name: z.string().trim().min(1, c("required"))
  });

  const createForm = useForm<{ name: string }>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "" }
  });

  if (!canManage) {
    return <EmptyState icon="lock" title={t("noAccess")} />;
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        breadcrumbs={[{ label: t("settingsBreadcrumb") }, { label: t("title") }]}
      />

      <div className="roles-page-head">
        <div />
        <button
          type="button"
          className="pds-type-body-m-bold btn-primary"
          disabled={
            !selectedRoleId ||
            !dirty ||
            updateRole.isPending ||
            selectedRole?.status === "inactive"
          }
          onClick={() => void saveRole()}
        >
          <Icon name="check" />
          {updateRole.isPending ? c("loading") : c("save")}
        </button>
      </div>

      <section className="roles-workspace panel">
        <aside className="roles-workspace__sidebar">
          <div className="pds-type-body-m-medium roles-workspace__sidebar-head">
            <h2 className="pds-type-title-xs-bold">{t("rolesListTitle")}</h2>
            <button type="button" className="pds-type-body-m-medium roles-workspace__new" onClick={() => setCreateOpen(true)}>
              <Icon name="add" />
              {t("newRole")}
            </button>
          </div>

          {roles.isLoading ? <p className="pds-type-body-s-regular muted">{c("loading")}</p> : null}
          {roles.isError ? <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p> : null}

          <ul className="roles-list">
            {sortedRoles.map((role) => {
              const display = roleDisplayFor(role.key, role.name);
              const active = role.id === selectedRoleId;
              const inactive = role.status === "inactive";
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    className={
                      active
                        ? "roles-list-item roles-list-item--active"
                        : inactive
                          ? "roles-list-item roles-list-item--inactive"
                          : "roles-list-item"
                    }
                    onClick={() => setSelectedRoleId(role.id)}
                  >
                    <span className="pds-type-title-xs-bold roles-list-item__avatar" style={{ background: display.accent }}>
                      {display.initials}
                    </span>
                    <span className="pds-type-body-m-medium roles-list-item__text">
                      <strong>{display.label}</strong>
                      <span className="pds-type-body-s-regular muted">
                        {inactive
                          ? t("roleDisabled")
                          : t("userCount", { count: role.userCount })}
                      </span>
                    </span>
                    {inactive ? (
                      <span className="pds-type-label-s-medium roles-list-item__badge">{t("roleDisabled")}</span>
                    ) : active ? (
                      <Icon name="chevron_right" className="roles-list-item__chevron" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="roles-workspace__detail">
          {!selectedRole || !selectedDisplay ? (
            <EmptyState
              icon="manage_accounts"
              title={t("emptyTitle")}
              description={t("emptyHelp")}
            />
          ) : (
            <>
              <div className="roles-detail-card">
                <div className="pds-type-title-m-extrabold roles-detail-head">
                  <div className="roles-detail-head__main">
                    <span
                      className="pds-type-title-s-extrabold roles-detail-head__avatar"
                      style={{ background: selectedDisplay.accent }}
                    >
                      {selectedDisplay.initials}
                    </span>
                    <div>
                      <h2 className="pds-type-title-xs-bold">{selectedDisplay.label}</h2>
                      <p className="pds-type-body-s-regular muted">
                        {selectedRole.status === "inactive"
                          ? t("roleDisabledSummary")
                          : allEnabled
                            ? t("fullAccessSummary")
                            : t(`summaries.${selectedDisplay.summaryKey}`)}
                      </p>
                    </div>
                  </div>
                  <div className="roles-detail-head__actions">
                    <label className="pds-type-body-m-medium roles-detail-head__toggle">
                      <Toggle
                        checked={selectedRole.status === "active"}
                        onCheckedChange={handleRoleEnabledChange}
                        disabled={updateRole.isPending}
                        aria-label={t("roleEnabled")}
                      />
                    </label>
                    <span className="pds-type-body-s-semibold roles-detail-head__badge">
                      {t("userCount", { count: selectedRole.userCount })}
                    </span>
                  </div>
                </div>

                <div className="roles-category-badges">
                  {permissionCategories.map((category) => {
                    const counts = categoryCounts[category];
                    return (
                      <span
                        key={category}
                        className={`pds-type-caption-s roles-category-badge ${categoryBadgeColor(category)}`}
                      >
                        <span className="roles-category-badge__dot" aria-hidden />
                        {t("categoryCount", {
                          enabled: counts.enabled,
                          total: counts.total,
                          category: p(`categories.${category}`)
                        })}
                      </span>
                    );
                  })}
                </div>

                {statusError ? (
                  <p className="pds-type-body-m-medium error-text" role="alert">
                    {statusError}
                  </p>
                ) : null}
                {/* {selectedRole.status === "active" && selectedRole.userCount > 0 ? (
                  <p className="pds-type-body-s-regular muted">{t("roleHasUsersHint", { count: selectedRole.userCount })}</p>
                ) : null} */}
              </div>

              <div className="roles-permissions-card">
            

                <ul className="roles-permissions-list">
                  {tenantPermissionCatalog.map((group) => (
                    <li key={group.category} className="roles-permissions-list__group">
                      <div className="pds-type-caption-s roles-permission-section">
                        {p(`categories.${group.category}`)}
                      </div>
                      <ul>
                        {group.items.map((item) => (
                          <li key={item.permission} className="pds-type-body-m-medium roles-permission-row">
                            <span>{p(`items.${item.labelKey}`)}</span>
                            <Toggle
                              checked={draftSet.has(item.permission)}
                              onCheckedChange={(checked) => togglePermission(item.permission, checked)}
                              disabled={selectedRole.status === "inactive" || updateRole.isPending}
                              aria-label={p(`items.${item.labelKey}`)}
                            />
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>

              {formError ? (
                <p className="pds-type-body-m-medium error-text" role="alert">
                  {formError}
                </p>
              ) : null}
              {saved && !dirty ? <p className="pds-type-body-s-regular muted">{c("saved")}</p> : null}
            </>
          )}
        </div>
      </section>

      <RecordFormSheet
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            createForm.reset();
          }
          setCreateOpen(open);
        }}
        title={t("createRoleTitle")}
        help={t("createRoleHelp")}
        onSubmit={createForm.handleSubmit(async (values) => {
          try {
            const created = await createRole.mutateAsync({ name: values.name.trim() });
            createForm.reset();
            setCreateOpen(false);
            setSelectedRoleId(created.id);
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setCreateOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={createRole.isPending}>
              <Icon name="add" />
              {createRole.isPending ? c("loading") : t("createRoleConfirm")}
            </button>
          </>
        }
      >
        <Field label={t("roleName")} error={createForm.formState.errors.name?.message}>
          <FormInput {...createForm.register("name")} placeholder={t("roleNamePlaceholder")} />
        </Field>
      </RecordFormSheet>

      <ConfirmDialog
        open={disableConfirmOpen}
        onOpenChange={setDisableConfirmOpen}
        title={t("disableRoleTitle")}
        description={t("disableRoleConfirm")}
        confirmLabel={t("disableRoleConfirmAction")}
        cancelLabel={c("cancel")}
        loading={updateRole.isPending}
        onConfirm={() => void setRoleStatus("inactive")}
      />
    </>
  );
}
