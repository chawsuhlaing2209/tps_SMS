"use client";
import { FormInput } from "../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { myanmarPhoneSchema, roleDisplayFor } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable, DirectoryMemberCell } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead, DataTableSection } from "../../lib/table-panel";
import { StatusBadge, Badge } from "../../../components/shared/badge";
import { EmptyState } from "../../../components/shared/empty-state";
import { PdsSelectField } from "../../../components/pds";
import { TableSearchInput } from "../../lib/table-search";
import { zodResolver } from "../../lib/zod-resolver";

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

const STAFF_OVERVIEW_PATH = (tenant: string) =>
  `/tenants/${tenant}/hr/staff/overview?excludeEmploymentRole=teacher`;
const ASSIGNABLE_ROLES_PATH = (tenant: string) =>
  `/tenants/${tenant}/hr/assignable-roles?scope=team`;
const DEPARTMENTS_PATH = (tenant: string) => `/tenants/${tenant}/departments/active`;

export function TeamEditor() {
  const t = useTranslations("team");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManageHr = hasAnyPermission(permissions, ["hr.manage"]);
  const canView = canManageHr || hasAnyPermission(permissions, ["identity.manage"]);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const queryPath = search.trim()
    ? (tenant: string) =>
        `${STAFF_OVERVIEW_PATH(tenant)}&search=${encodeURIComponent(search.trim())}`
    : STAFF_OVERVIEW_PATH;

  const staff = useApiQuery<StaffOverview[]>(canView ? queryPath : () => null);
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
    { invalidatePaths: (_b, tenant) => [STAFF_OVERVIEW_PATH(tenant)] }
  );

  const provisionUpdate = useApiMutation(
    ({ staffId, body }: { staffId: string; body: Record<string, unknown> }, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${staffId}/provision`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [STAFF_OVERVIEW_PATH(tenant)] }
  );

  const roleOptions = useMemo(() => {
    const base = roles.data ?? [];
    if (formMode?.type === "edit" && formMode.staff.rbacRoleKey) {
      const currentKey = formMode.staff.rbacRoleKey;
      if (!base.some((role) => role.key === currentKey)) {
        return [
          { id: currentKey, key: currentKey, name: roleDisplayFor(currentKey).label },
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
        const label = roleDisplayFor(
          row.original.rbacRoleKey ?? "",
          roles.data?.find((r) => r.key === row.original.rbacRoleKey)?.name
        ).label;
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
        <TablePanelHead
          title={t("listTitle")}
          help={t("listHelp")}
          onRefresh={() => void staff.refetch()}
          onAdd={canManageHr ? openCreate : undefined}
          addLabel={t("addMember")}
          extra={
            <TableSearchInput
              placeholder={t("search")}
              value={search}
              aria-label={t("search")}
              onChange={(event) => setSearch(event.target.value)}
            />
          }
        />
        <TablePanelBody
          loading={staff.isLoading}
          error={staff.isError ? c("somethingWrong") : null}
          empty={!staff.data?.length}
        >
          <DataTable
            columns={columns}
            data={staff.data ?? []}
            onRowClick={canManageHr ? (member) => openEdit(member) : undefined}
          />
        </TablePanelBody>
      </DataTableSection>

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
                  label: roleDisplayFor(role.key, role.name).label
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
            <FormInput type="date" {...form.register("joinDate")} />
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