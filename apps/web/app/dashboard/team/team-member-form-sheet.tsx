"use client";

import { myanmarPhoneSchema, roleDisplayFor } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "../../../components/shared/empty-state";
import { FormDatePicker, FormInput } from "../../../components/shared/form-input";
import { PdsSelectField } from "../../../components/pds";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { localizedRoleLabel } from "../../lib/role-label";
import { zodResolver } from "../../lib/zod-resolver";

/** Fields the create/edit person sheet needs from an existing staff member. */
export type EditableTeamMember = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  joinDate: string | null;
  userId: string | null;
  loginEmail: string | null;
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

const ASSIGNABLE_ROLES_PATH = (tenant: string) =>
  `/tenants/${tenant}/hr/assignable-roles?scope=team`;
const DEPARTMENTS_PATH = (tenant: string) => `/tenants/${tenant}/departments/active`;

/**
 * Create/edit sheet for non-teaching staff (Admin › People). `member: null`
 * creates a new person; otherwise edits the given member via provision PATCH.
 * Shared by the People directory and the staff profile page.
 */
export function TeamMemberFormSheet({
  open,
  onOpenChange,
  member,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: EditableTeamMember | null;
  onSaved?: () => void;
}) {
  const t = useTranslations("team");
  const tNames = useTranslations("settings.roles.names");
  const c = useTranslations("common");
  const [formError, setFormError] = useState<string | null>(null);

  const roles = useApiQuery<Role[]>((tenant) => (open ? ASSIGNABLE_ROLES_PATH(tenant) : null));
  const departments = useApiQuery<Department[]>((tenant) =>
    open ? DEPARTMENTS_PATH(tenant) : null
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
    {
      invalidatePaths: ({ staffId }, tenant) => [
        `/tenants/${tenant}/hr/staff/overview`,
        `/tenants/${tenant}/hr/staff/${staffId}/profile`
      ]
    }
  );

  const roleLabel = (key: string, name?: string) =>
    localizedRoleLabel(roleDisplayFor(key, name), tNames, name);

  const roleOptions = useMemo(() => {
    const base = (roles.data ?? []).filter((role) => role.key !== "teacher");
    if (member?.rbacRoleKey && !base.some((role) => role.key === member.rbacRoleKey)) {
      return [
        { id: member.rbacRoleKey, key: member.rbacRoleKey, name: roleLabel(member.rbacRoleKey) },
        ...base
      ];
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.data, member]);

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

  // Re-seed the form whenever the sheet opens for a different target.
  useEffect(() => {
    if (!open) {
      return;
    }
    setFormError(null);
    form.reset({
      fullName: member?.fullName ?? "",
      email: member?.email ?? member?.loginEmail ?? "",
      phone: member?.phone ?? "",
      roleKey: member?.rbacRoleKey ?? "",
      departmentId: member?.departmentId ?? "",
      joinDate: member?.joinDate ?? ""
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id]);

  // Default the role for the create flow once options load.
  useEffect(() => {
    if (!open || member || !roleOptions.length) {
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
  }, [open, member, roleOptions, form]);

  async function handleSubmit(values: TeamFormValues) {
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
      if (member) {
        await provisionUpdate.mutateAsync({ staffId: member.id, body: payload });
      } else {
        await provision.mutateAsync(payload);
      }
      onOpenChange(false);
      form.reset();
      onSaved?.();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : c("somethingWrong"));
    }
  }

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset();
          setFormError(null);
        }
        onOpenChange(next);
      }}
      title={member ? t("editMember") : t("addMember")}
      help={t("formHelp")}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit((values) => void handleSubmit(values))();
      }}
      footer={
        <>
          <button
            type="button"
            className="pds-type-body-m-bold btn-ghost"
            onClick={() => onOpenChange(false)}
          >
            {c("cancel")}
          </button>
          <button
            type="submit"
            className="pds-type-body-m-bold btn-primary"
            disabled={form.formState.isSubmitting}
          >
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
      {member?.userId ? (
        <p className="pds-type-body-s-regular muted">
          {t("loginLinked", { email: member.loginEmail ?? "—" })}
        </p>
      ) : (
        <p className="pds-type-body-s-regular muted">{t("loginAutoHelp")}</p>
      )}
      {formError ? (
        <p className="pds-type-body-m-medium error-text" role="alert">
          {formError}
        </p>
      ) : null}
    </RecordFormSheet>
  );
}
