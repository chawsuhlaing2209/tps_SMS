"use client";
import { FormDatePicker, FormInput } from "../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { myanmarPhoneSchema, roleDisplayFor } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable, DirectoryMemberCell } from "../../lib/data-table";
import { PaginationControls } from "../../lib/pagination-controls";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody, DataTableSection } from "../../lib/table-panel";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { StatusBadge, Badge } from "../../../components/shared/badge";
import { EmptyState } from "../../../components/shared/empty-state";
import { createPortal } from "react-dom";
import { PdsSearchBar, PdsSearchFiltersRow, PdsSelectField } from "../../../components/pds";
import { zodResolver } from "../../lib/zod-resolver";
import { localizedRoleLabel } from "../../lib/role-label";

type StaffOverview = {
  id: string;
  fullName: string;
  employmentRole: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  departmentId: string | null;
  joinDate: string | null;
  userId: string | null;
  status: string;
  loginEmail: string | null;
  loginStatus: string | null;
  rbacRoleKey: string | null;
};

type Role = { id: string; key: string; name: string };
type Department = { id: string; name: string };

type TeamFormValues = {
  fullName: string;
  email: string;
  phone: string;
  roleKey: string;
  departmentId: string;
  joinDate: string;
};

type FormMode = { type: "create" } | { type: "edit"; staff: StaffOverview };

type StaffOverviewPage = {
  data: StaffOverview[];
  total: number;
  limit: number;
  offset: number;
};

const PAGE_SIZE = 50;

const staffOverviewPath = (tenant: string, page: number, search: string) => {
  const params = new URLSearchParams({
    excludeEmploymentRole: "teacher",
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE)
  });
  if (search.trim()) params.set("search", search.trim());
  return `/tenants/${tenant}/hr/staff/overview?${params.toString()}`;
};

const ASSIGNABLE_ROLES_PATH = (tenant: string) =>
  `/tenants/${tenant}/hr/assignable-roles?scope=team`;
const DEPARTMENTS_PATH = (tenant: string) => `/tenants/${tenant}/departments/active`;

export function TeamEditor() {
  const t = useTranslations("team");
  const tNames = useTranslations("settings.roles.names");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManageHr = hasAnyPermission(permissions, ["hr.manage"]);
  const canView = canManageHr || hasAnyPermission(permissions, ["identity.manage"]);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const queryPath = useMemo(
    () => (tenant: string) => staffOverviewPath(tenant, page, search),
    [page, search]
  );

  const staff = useApiQuery<StaffOverviewPage>(canView ? queryPath : () => null);
  const roles = useApiQuery<Role[]>((tenant) =>
    canManageHr ? ASSIGNABLE_ROLES_PATH(tenant) : null
  );
  const departments = useApiQuery<Department[]>((tenant) =>
    canManageHr ? DEPARTMENTS_PATH(tenant) : null
  );

  const provision = useApiMutation(
    (body: Record<string, unknown>, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/provision`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/hr/staff/overview`] }
  );

  const provisionUpdate = useApiMutation(
    ({ staffId, body }: { staffId: string; body: Record<string, unknown> }, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${staffId}/provision`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/hr/staff/overview`] }
  );

  const roleLabel = (key: string, name?: string) =>
    localizedRoleLabel(roleDisplayFor(key, name), tNames, name);

  const roleOptions = useMemo(() => {
    const base = roles.data ?? [];
    if (formMode?.type === "edit" && formMode.staff.rbacRoleKey) {
      const currentKey = formMode.staff.rbacRoleKey;
      if (!base.some((role) => role.key === currentKey)) {
        return [
          { id: currentKey, key: currentKey, name: roleLabel(currentKey) },
          ...base
        ];
      }
    }
    return base.filter((role) => role.key !== "teacher");
  }, [roles.data, formMode]);

  const schema = z.object({
    fullName: z.string().trim().min(1, c("required")),
    email: z.string().email(t("invalidEmail")),
    phone: myanmarPhoneSchema,
    roleKey: z.string().trim().min(1, c("required")),
    departmentId: z.string(),
    joinDate: z.string()
  });

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      roleKey: "",
      departmentId: "",
      joinDate: ""
    }
  });

  useEffect(() => {
    if (!roleOptions.length || formMode?.type !== "create") {
      return;
    }
    const current = form.getValues("roleKey");
    if (current && roleOptions.some((role) => role.key === current)) {
      return;
    }
    const preferred = roleOptions[0]?.key ?? "";
    if (preferred) {
      form.setValue("roleKey", preferred);
    }
  }, [roleOptions, formMode, form]);

  const openCreate = () => {
    form.reset({
      fullName: "",
      email: "",
      phone: "",
      roleKey: roleOptions[0]?.key ?? "",
      departmentId: "",
      joinDate: ""
    });
    setFormMode({ type: "create" });
  };

  const openEdit = (member: StaffOverview) => {
    form.reset({
      fullName: member.fullName,
      email: member.email ?? member.loginEmail ?? "",
      phone: member.phone ?? "",
      roleKey: member.rbacRoleKey ?? roleOptions[0]?.key ?? "",
      departmentId: member.departmentId ?? "",
      joinDate: member.joinDate ?? ""
    });
    setFormMode({ type: "edit", staff: member });
  };

  const columns: ColumnDef<StaffOverview, unknown>[] = [
    {
      id: "name",
      header: c("staffMember"),
      cell: ({ row }) => (
        <DirectoryMemberCell name={row.original.fullName} email={row.original.email ?? row.original.loginEmail} />
      )
    },
    {
      id: "role",
      header: t("role"),
      cell: ({ row }) => {
        const roleKey = row.original.rbacRoleKey ?? "";
        const roleName = roles.data?.find((r) => r.key === roleKey)?.name;
        const label = roleLabel(roleKey, roleName);
        return <Badge tone="neutral">{label}</Badge>;
      }
    },
    {
      id: "department",
      header: c("subjectGrade"),
      accessorFn: (row) => row.department ?? "—"
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    }
  ];

  async function handleSubmit(values: TeamFormValues) {
    setSaved(null);
    setFormError(null);

    const payload = {
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      roleKey: values.roleKey,
      createLogin: true,
      departmentId: values.departmentId || undefined,
      joinDate: values.joinDate || undefined
    };

    try {
      if (formMode?.type === "create") {
        await provision.mutateAsync(payload);
      } else if (formMode?.type === "edit") {
        await provisionUpdate.mutateAsync({
          staffId: formMode.staff.id,
          body: payload
        });
      }

      setSaved(t("saved"));
      setFormMode(null);
      form.reset();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : c("somethingWrong"));
    }
  }

  if (!canView) {
    return null;
  }

  return (
    <>
      <DataTableSection>
        <TeamHeaderActionsPortal onAdd={canManageHr ? openCreate : undefined} />
        <PdsSearchFiltersRow
          filters={
            <PdsSearchBar
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
            />
          }
        />
        <TablePanelBody
          loading={staff.isLoading}
          error={staff.isError ? c("somethingWrong") : null}
          empty={!staff.data?.data.length}
        >
          <DataTable
            columns={columns}
            data={staff.data?.data ?? []}
            onRowClick={canManageHr ? (member) => openEdit(member) : undefined}
          />
        </TablePanelBody>
      </DataTableSection>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={staff.data?.total ?? 0}
        onPageChange={setPage}
      />

      {canManageHr ? (
        <RecordFormSheet
          open={formMode !== null}
          onOpenChange={(open) => {
            if (!open) {
              setFormMode(null);
              form.reset();
            }
          }}
          title={formMode?.type === "edit" ? t("editMember") : t("addMember")}
          help={t("formHelp")}
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit((values) => void handleSubmit(values))();
          }}
          footer={
            <>
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setFormMode(null)}>
                {c("cancel")}
              </button>
              <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
                <Icon name="check" />
                {form.formState.isSubmitting ? c("loading") : c("save")}
              </button>
            </>
          }
        >
          <Field label={c("name")} error={form.formState.errors.fullName?.message}>
            <FormInput {...form.register("fullName")} />
          </Field>
          <Field label={t("role")} error={form.formState.errors.roleKey?.message}>
            {roles.isLoading ? (
              <p className="pds-type-body-s-regular muted">{c("loading")}</p>
            ) : roleOptions.length ? (
              <PdsSelectField
                variant="form"
                value={form.watch("roleKey")}
                onValueChange={(value) =>
                  form.setValue("roleKey", typeof value === "string" ? value : "", {
                    shouldValidate: true
                  })
                }
                options={roleOptions.map((role) => ({
                  value: role.key,
                  label: roleLabel(role.key, role.name)
                }))}
              />
            ) : (
              <EmptyState compact embedded icon="badge" title={t("noRolesAvailable")} />
            )}
          </Field>
          <Field label={t("email")} error={form.formState.errors.email?.message}>
            <FormInput type="email" {...form.register("email")} />
          </Field>
          <Field label={t("phone")} error={form.formState.errors.phone?.message}>
            <FormInput {...form.register("phone")} placeholder="09XXXXXXXXX" />
          </Field>
          <Field label={t("department")}>
            <PdsSelectField
              variant="form"
              value={form.watch("departmentId")}
              onValueChange={(value) =>
                form.setValue("departmentId", typeof value === "string" ? value : "", {
                  shouldValidate: true
                })
              }
              placeholder={t("departmentPlaceholder")}
              options={
                departments.data?.map((department) => ({
                  value: department.id,
                  label: department.name
                })) ?? []
              }
            />
          </Field>
          <Field label={t("joinDate")}>
            <FormDatePicker
              type="day"
              variant="form"
              value={form.watch("joinDate")}
              onValueChange={(next) => form.setValue("joinDate", next, { shouldValidate: true })}
              placeholder={t("joinDate")}
              ariaLabel={t("joinDate")}
            />
          </Field>
          {formMode?.type === "edit" && formMode.staff.userId ? (
            <p className="pds-type-body-s-regular muted">{t("loginLinked", { email: formMode.staff.loginEmail ?? "—" })}</p>
          ) : (
            <p className="pds-type-body-s-regular muted">{t("loginAutoHelp")}</p>
          )}
          {formError ? (
            <p className="pds-type-body-m-medium error-text" role="alert">
              {formError}
            </p>
          ) : null}
        </RecordFormSheet>
      ) : null}

      {saved ? (
        <p className="pds-type-body-m-medium form-feedback form-feedback--ok" role="status">
          {saved}
        </p>
      ) : null}
    </>
  );
}

function TeamHeaderActionsPortal({ onAdd }: { onAdd?: () => void }) {
  const t = useTranslations("team");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <>
      {onAdd ? (
        <button type="button" className="pds-type-body-m-bold btn-primary" onClick={onAdd}>
          <Icon name="add" />
          {t("addMember")}
        </button>
      ) : null}
    </>,
    target
  );
}