"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";
import { TeacherAssignmentsEditor } from "./teacher-assignments-editor";
import { StaffEditor } from "./staff-editor";

type User = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  status: string;
  lastLoginAt: string | null;
  updatedAt?: string;
};
type Role = {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  updatedAt?: string;
};

type InviteValues = { displayName: string; email: string; phone: string };
type AssignValues = { userId: string; roleId: string };

const USERS_PATH = (tenant: string) => `/tenants/${tenant}/identity/users`;
const ROLES_PATH = (tenant: string) => `/tenants/${tenant}/identity/roles`;

export default function PeoplePage() {
  const t = useTranslations("people");
  const c = useTranslations("common");
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const permissions = getSession()?.permissions;
  const canManageIdentity = hasAnyPermission(permissions, ["identity.manage"]);
  const canManageAssignments = hasAnyPermission(permissions, ["hr.manage", "classroom.manage"]);
  const users = useApiQuery<User[]>((tenant) =>
    canManageIdentity ? USERS_PATH(tenant) : null
  );
  const roles = useApiQuery<Role[]>((tenant) => (canManageIdentity ? ROLES_PATH(tenant) : null));

  const invite = useApiMutation<{ displayName: string; email?: string; phone?: string }>(
    (body, tenant) => ({
      path: `${USERS_PATH(tenant)}/invite`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [USERS_PATH(tenant)] }
  );

  const assign = useApiMutation<AssignValues>(
    (body, tenant) => ({
      path: `${ROLES_PATH(tenant)}/assign`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [USERS_PATH(tenant)] }
  );

  const seedRoles = useApiMutation<void>(
    (_v, tenant) => ({
      path: `${ROLES_PATH(tenant)}/seed`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_v, tenant) => [ROLES_PATH(tenant)] }
  );

  const inviteSchema = z
    .object({
      displayName: z.string().trim().min(1, c("required")),
      email: z.string().trim().email(t("invalidEmail")).or(z.literal("")),
      phone: z.string().trim()
    })
    .refine((v) => v.email !== "" || v.phone !== "", {
      message: t("contactRequired"),
      path: ["email"]
    });
  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { displayName: "", email: "", phone: "" }
  });

  const assignSchema = z.object({
    userId: z.string().uuid(c("required")),
    roleId: z.string().uuid(c("required"))
  });
  const assignForm = useForm<AssignValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: { userId: "", roleId: "" }
  });

  const userColumns: ColumnDef<User, unknown>[] = [
    { id: "name", header: c("name"), accessorFn: (u) => u.displayName },
    { id: "contact", header: t("contact"), accessorFn: (u) => u.email ?? u.phone ?? "—" },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    {
      id: "lastLogin",
      header: t("lastLogin"),
      accessorFn: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : c("never"))
    }
  ];

  const roleColumns: ColumnDef<Role, unknown>[] = [
    { id: "name", header: t("role"), accessorFn: (r) => r.name },
    { id: "key", header: t("key"), accessorKey: "key", cell: ({ row }) => <code>{row.original.key}</code> },
    { id: "permissions", header: t("permissions"), accessorFn: (r) => r.permissions.length }
  ];

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </div>

      {canManageAssignments ? <TeacherAssignmentsEditor /> : null}
      {canManageAssignments ? <StaffEditor /> : null}

      {canManageIdentity ? (
        <>
          <section className="panel">
            <TablePanelHead
              title={t("users")}
              onRefresh={() => void users.refetch()}
              onAdd={() => setInviteOpen(true)}
              addLabel={t("invite")}
              extra={
                <button type="button" className="btn-ghost" onClick={() => setAssignOpen(true)}>
                  {t("assignRole")}
                </button>
              }
            />
            {inviteSuccess ? (
              <p className="form-feedback form-feedback--ok" role="status">
                {inviteSuccess}
              </p>
            ) : null}
            <TablePanelBody
              loading={users.isLoading}
              error={users.isError ? c("somethingWrong") : null}
              empty={!users.data?.length}
            >
              <DataTable<User> columns={userColumns} data={users.data ?? []} />
            </TablePanelBody>
          </section>

          <section className="panel">
            <TablePanelHead
              title={t("roles")}
              onRefresh={() => void roles.refetch()}
              extra={
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={seedRoles.isPending}
                  onClick={() => void seedRoles.mutateAsync()}
                >
                  {seedRoles.isPending ? c("loading") : t("seedRoles")}
                </button>
              }
            />
            <TablePanelBody
              loading={roles.isLoading}
              error={roles.isError ? c("somethingWrong") : null}
              empty={!roles.data?.length}
            >
              <DataTable<Role> columns={roleColumns} data={roles.data ?? []} />
            </TablePanelBody>
          </section>

          <RecordFormSheet
            open={inviteOpen}
            onOpenChange={(open) => {
              if (!open) {
                inviteForm.reset();
              }
              setInviteOpen(open);
            }}
            title={t("inviteTitle")}
            help={t("inviteHelp")}
            onSubmit={inviteForm.handleSubmit(async (values) => {
              setInviteSuccess(null);
              await invite.mutateAsync({
                displayName: values.displayName,
                email: values.email || undefined,
                phone: values.phone || undefined
              });
              if (values.email.trim()) {
                setInviteSuccess(t("inviteEmailSent", { email: values.email.trim() }));
              }
              inviteForm.reset();
              setInviteOpen(false);
            })}
            footer={
              <>
                <button type="button" className="btn-ghost" onClick={() => setInviteOpen(false)}>
                  {c("cancel")}
                </button>
                <button type="submit" className="btn-primary" disabled={inviteForm.formState.isSubmitting}>
                  {inviteForm.formState.isSubmitting ? c("loading") : t("invite")}
                </button>
              </>
            }
          >
            <Field label={c("name")} error={inviteForm.formState.errors.displayName?.message}>
              <input placeholder={t("namePlaceholder")} {...inviteForm.register("displayName")} />
            </Field>
            <Field label={t("email")} error={inviteForm.formState.errors.email?.message}>
              <input placeholder="you@school.edu.mm" {...inviteForm.register("email")} />
            </Field>
            <Field label={t("phone")} error={inviteForm.formState.errors.phone?.message}>
              <input placeholder="09…" {...inviteForm.register("phone")} />
            </Field>
          </RecordFormSheet>

          <RecordFormSheet
            open={assignOpen}
            onOpenChange={(open) => {
              if (!open) {
                assignForm.reset();
              }
              setAssignOpen(open);
            }}
            title={t("assignTitle")}
            onSubmit={assignForm.handleSubmit(async (values) => {
              await assign.mutateAsync(values);
              assignForm.reset();
              setAssignOpen(false);
            })}
            footer={
              <>
                <button type="button" className="btn-ghost" onClick={() => setAssignOpen(false)}>
                  {c("cancel")}
                </button>
                <button type="submit" className="btn-primary" disabled={assignForm.formState.isSubmitting}>
                  {assignForm.formState.isSubmitting ? c("loading") : t("assignRole")}
                </button>
              </>
            }
          >
            <Field label={t("user")} error={assignForm.formState.errors.userId?.message}>
              <select {...assignForm.register("userId")}>
                <option value="">{t("selectUser")}</option>
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("role")} error={assignForm.formState.errors.roleId?.message}>
              <select {...assignForm.register("roleId")}>
                <option value="">{t("selectRole")}</option>
                {roles.data?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Field>
          </RecordFormSheet>
        </>
      ) : null}
    </div>
  );
}
