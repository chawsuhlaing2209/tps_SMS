"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { zodResolver } from "../../lib/zod-resolver";

type User = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  status: string;
  lastLoginAt: string | null;
};
type Role = { id: string; key: string; name: string; permissions: string[] };

type InviteValues = { displayName: string; email: string; phone: string };
type AssignValues = { userId: string; roleId: string };

const USERS_PATH = (tenant: string) => `/tenants/${tenant}/identity/users`;
const ROLES_PATH = (tenant: string) => `/tenants/${tenant}/identity/roles`;

export default function PeoplePage() {
  const t = useTranslations("people");
  const c = useTranslations("common");
  const users = useApiQuery<User[]>(USERS_PATH);
  const roles = useApiQuery<Role[]>(ROLES_PATH);

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
  const submitInvite = inviteForm.handleSubmit(async (values) => {
    await invite.mutateAsync({
      displayName: values.displayName,
      email: values.email || undefined,
      phone: values.phone || undefined
    });
    inviteForm.reset();
  });

  const assignSchema = z.object({
    userId: z.string().uuid(c("required")),
    roleId: z.string().uuid(c("required"))
  });
  const assignForm = useForm<AssignValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: { userId: "", roleId: "" }
  });
  const submitAssign = assignForm.handleSubmit(async (values) => {
    await assign.mutateAsync(values);
    assignForm.reset();
  });

  const userColumns: ColumnDef<User, unknown>[] = [
    { id: "name", header: c("name"), accessorFn: (u) => u.displayName },
    { id: "contact", header: t("contact"), accessorFn: (u) => u.email ?? u.phone ?? "—" },
    {
      id: "status",
      header: c("status"),
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
    { id: "key", header: t("key"), cell: ({ row }) => <code>{row.original.key}</code> },
    { id: "permissions", header: t("permissions"), accessorFn: (r) => r.permissions.length }
  ];

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("inviteTitle")}</h2>
        </div>
        <form className="entity-form" onSubmit={submitInvite} noValidate>
          <Field label={c("name")} error={inviteForm.formState.errors.displayName?.message}>
            <input placeholder={t("namePlaceholder")} {...inviteForm.register("displayName")} />
          </Field>
          <Field label={t("email")} error={inviteForm.formState.errors.email?.message}>
            <input placeholder="you@school.edu.mm" {...inviteForm.register("email")} />
          </Field>
          <Field label={t("phone")} error={inviteForm.formState.errors.phone?.message}>
            <input placeholder="09…" {...inviteForm.register("phone")} />
          </Field>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={inviteForm.formState.isSubmitting}>
              {inviteForm.formState.isSubmitting ? c("loading") : t("invite")}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("users")}</h2>
          <button type="button" className="btn-ghost" onClick={() => void users.refetch()}>
            {c("refresh")}
          </button>
        </div>
        {users.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : users.isError ? (
          <p className="error-text">{c("somethingWrong")}</p>
        ) : !users.data?.length ? (
          <p className="muted">{t("noUsers")}</p>
        ) : (
          <DataTable<User> columns={userColumns} data={users.data} />
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("assignTitle")}</h2>
        </div>
        <form className="entity-form" onSubmit={submitAssign} noValidate>
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
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={assignForm.formState.isSubmitting}>
              {assignForm.formState.isSubmitting ? c("loading") : t("assignRole")}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("roles")}</h2>
          <button
            type="button"
            className="btn-ghost"
            disabled={seedRoles.isPending}
            onClick={() => void seedRoles.mutateAsync()}
          >
            {seedRoles.isPending ? c("loading") : t("seedRoles")}
          </button>
        </div>
        {roles.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : roles.isError ? (
          <p className="error-text">{c("somethingWrong")}</p>
        ) : !roles.data?.length ? (
          <p className="muted">{t("noRoles")}</p>
        ) : (
          <DataTable<Role> columns={roleColumns} data={roles.data} />
        )}
      </section>
    </div>
  );
}
