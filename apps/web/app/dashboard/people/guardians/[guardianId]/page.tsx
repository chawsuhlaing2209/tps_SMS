"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../../../lib/api";
import { DataTable, DirectoryNameCell } from "../../../../lib/data-table";
import { Field } from "../../../../lib/form";
import { HeroMoreActionsMenu, HeroOutlineAction, HeroPrimaryAction } from "../../../../lib/hero-more-actions";
import { Icon } from "../../../../lib/icon";
import { hasAnyPermission } from "../../../../lib/permissions";
import { RecordFormSheet } from "../../../../lib/record-sheet";
import { getSession } from "../../../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../../../lib/table-panel";
import { zodResolver } from "../../../../lib/zod-resolver";
import { PageHeader } from "../../../page-header-context";

type GuardianDetail = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  household: { id: string; name: string } | null;
  students: Array<{
    id: string;
    fullName: string;
    admissionNumber: string;
    status: string;
    relationship: string;
  }>;
};

function guardianInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase();
}

export default function GuardianDetailPage() {
  const params = useParams<{ guardianId: string }>();
  const guardianId = params.guardianId;
  const t = useTranslations("guardians");
  const s = useTranslations("students");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const p = useTranslations("people");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const guardian = useApiQuery<GuardianDetail>(
    (tenant) => `/tenants/${tenant}/students/guardians/${guardianId}`
  );

  const update = useApiMutation<
    { firstName: string; lastName: string; phone?: string; email?: string },
    unknown
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/students/guardians/${guardianId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/students/guardians/${guardianId}`,
        `/tenants/${tenant}/students/guardians`
      ]
    }
  );

  const nameParts = guardian.data?.fullName.split(" ") ?? [];
  const schema = z.object({
    firstName: z.string().trim().min(1, c("required")),
    lastName: z.string().trim().min(1, c("required")),
    phone: z.string(),
    email: z.union([z.string().email(c("required")), z.literal("")])
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" ") ?? "",
      phone: guardian.data?.phone ?? "",
      email: guardian.data?.email ?? ""
    }
  });

  const relationshipLabel = (relationship: string) => {
    const labels: Record<string, string> = {
      father: t("relationship_father"),
      mother: t("relationship_mother"),
      guardian: t("relationship_guardian"),
      other: t("relationship_other")
    };
    return labels[relationship] ?? relationship;
  };

  if (guardian.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (guardian.isError || !guardian.data) {
    return (
      <div className="page-stack">
        <p className="error-text">{t("notFound")}</p>
        <Link href="/dashboard/people?tab=guardians">{t("backToList")}</Link>
      </div>
    );
  }

  const data = guardian.data;

  const studentColumns: ColumnDef<GuardianDetail["students"][number], unknown>[] = [
    {
      id: "name",
      header: c("name"),
      accessorKey: "fullName",
      cell: ({ row }) => (
        <DirectoryNameCell
          name={row.original.fullName}
          avatar={
            <span className="directory-avatar">
              {guardianInitials(row.original.fullName)}
            </span>
          }
        />
      )
    },
    { id: "admission", header: s("admissionNumber"), accessorKey: "admissionNumber" },
    {
      id: "relationship",
      header: s("relationship"),
      accessorFn: (row) => relationshipLabel(row.relationship)
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>
          {s(`status_${row.original.status}` as "status_draft")}
        </span>
      )
    }
  ];

  const heroMeta = [
    data.phone,
    data.email,
    data.household?.name ? `${t("householdStat")}: ${data.household.name}` : null
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="student-profile-page">
      <PageHeader
        title={data.fullName}
        breadcrumbs={[
          { label: nav("group_school") },
          { label: p("directoryTitle"), href: "/dashboard/people" },
          { label: t("directoryTitle"), href: "/dashboard/people?tab=guardians" }
        ]}
        backHref="/dashboard/people?tab=guardians"
        backLabel={t("backToList")}
      />

      <section className="structure-room-banner student-profile-banner">
        <div className="structure-room-banner__main student-profile-banner__main">
          <span className="student-profile-avatar">{guardianInitials(data.fullName)}</span>
          <div>
            <h2 className="structure-room-banner__title">{data.fullName}</h2>
            <p className="structure-room-banner__meta">{heroMeta || t("profileHelp")}</p>
          </div>
        </div>
        <div className="structure-room-banner__actions student-profile-banner__actions">
          {canManage ? (
            <HeroMoreActionsMenu
              label={t("editGuardian")}
              items={[
                {
                  id: "edit",
                  label: t("editGuardian"),
                  icon: "edit",
                  onSelect: () => setEditOpen(true)
                }
              ]}
            />
          ) : null}
          {data.phone ? (
            <HeroPrimaryAction href={`tel:${data.phone.replace(/\s+/g, "")}`}>
              <Icon name="call" />
              {t("messageGuardian")}
            </HeroPrimaryAction>
          ) : (
            <HeroPrimaryAction href="/dashboard/communication">
              <Icon name="send" />
              {t("messageGuardian")}
            </HeroPrimaryAction>
          )}
          {data.household ? (
            <HeroOutlineAction href={`/dashboard/people/households/${data.household.id}`}>
              <Icon name="family_restroom" />
              {data.household.name}
            </HeroOutlineAction>
          ) : null}
        </div>
      </section>

      <div className="student-profile-stats">
        <article className="student-profile-stat">
          <span className="student-profile-stat__label">{t("phoneStat")}</span>
          <strong className="student-profile-stat__value">{data.phone ?? "—"}</strong>
        </article>
        <article className="student-profile-stat">
          <span className="student-profile-stat__label">{t("emailStat")}</span>
          <strong className="student-profile-stat__value">{data.email ?? "—"}</strong>
        </article>
        <article className="student-profile-stat">
          <span className="student-profile-stat__label">{t("householdStat")}</span>
          <strong className="student-profile-stat__value">
            {data.household ? (
              <Link href={`/dashboard/people/households/${data.household.id}`}>
                {data.household.name}
              </Link>
            ) : (
              "—"
            )}
          </strong>
        </article>
        <article className="student-profile-stat">
          <span className="student-profile-stat__label">{t("linkedStudentsStat")}</span>
          <strong className="student-profile-stat__value">{data.students.length}</strong>
        </article>
      </div>

      <section className="panel">
        <TablePanelHead title={t("linkedStudents")} help={t("profileHelp")} />
        <TablePanelBody loading={false} error={null} empty={!data.students.length}>
          <DataTable
            columns={studentColumns}
            data={data.students}
            showUpdatedAt={false}
            getRowHref={(student) => `/dashboard/students/${student.id}`}
          />
        </TablePanelBody>
      </section>

      <RecordFormSheet
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setFormError(null);
          }
        }}
        title={t("editTitle")}
        help={t("editHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          setFormError(null);
          try {
            await update.mutateAsync({
              firstName: values.firstName,
              lastName: values.lastName,
              phone: values.phone || undefined,
              email: values.email || undefined
            });
            setEditOpen(false);
            void guardian.refetch();
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              <Icon name="save" />
              {update.isPending ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("firstName")} error={form.formState.errors.firstName?.message}>
          <input {...form.register("firstName")} />
        </Field>
        <Field label={t("lastName")} error={form.formState.errors.lastName?.message}>
          <input {...form.register("lastName")} />
        </Field>
        <Field label={t("phone")} error={form.formState.errors.phone?.message}>
          <input {...form.register("phone")} />
        </Field>
        <Field label={t("email")} error={form.formState.errors.email?.message}>
          <input type="email" {...form.register("email")} />
        </Field>
        {formError ? (
          <p className="error-text" role="alert">
            {formError}
          </p>
        ) : null}
      </RecordFormSheet>
    </div>
  );
}
