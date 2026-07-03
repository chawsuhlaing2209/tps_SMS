"use client";
import { FormInput } from "../../../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import { useState, use } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Chip } from "../../../../../components/shared/chip";
import { ConfirmDialog } from "../../../../../components/shared/confirm-dialog";
import { EmptyState } from "../../../../../components/shared/empty-state";
import { RowMoreActionsMenu } from "../../../../../components/shared/row-more-actions";
import { StatusBadge } from "../../../../../components/shared/badge";
import { TrailLink } from "../../../../../components/shared/trail-link";
import { ApiError, useApiMutation, useApiQuery } from "../../../../lib/api";
import { DirectoryMemberCell } from "../../../../lib/data-table";
import { Field } from "../../../../lib/form";
import {
  HeroMoreActionsMenu,
  HeroPrimaryAction
} from "../../../../lib/hero-more-actions";
import { Icon } from "../../../../lib/material-icon";
import { hasAnyPermission } from "../../../../lib/permissions";
import { RecordFormSheet } from "../../../../lib/record-sheet";
import { getSession } from "../../../../lib/session";
import { StudentCombobox } from "../../../../lib/student-combobox";
import { PdsSelectField } from "../../../../../components/pds";
import { zodResolver } from "../../../../lib/zod-resolver";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { PageHeader } from "../../../page-header-context";
import { NavigationBackLink } from "../../../../../components/shared/navigation-back-link";
import { PeopleBillingPanel, type BillingMember } from "../../people-billing-panel";

type HouseholdGuardian = {
  id: string;
  fullName: string;
  phone: string | null;
  isPrimary: boolean;
  studentLinks: Array<{ studentId: string; relationship: string }>;
};

type HouseholdStudent = {
  id: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  dateOfBirth: string | null;
  guardians: Array<{ guardianId: string; relationship: string }>;
};

type HouseholdTree = {
  id: string;
  name: string;
  primaryGuardian: { id: string; fullName: string; phone: string | null } | null;
  guardians: HouseholdGuardian[];
  students: HouseholdStudent[];
};

type GuardianOption = { id: string; fullName: string };

function householdInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function HouseholdDetailPage({
  params
}: {
  params: Promise<{ familyGroupId: string }>;
}) {
  const { familyGroupId } = use(params);
  const t = useTranslations("households");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const p = useTranslations("people");
  const s = useTranslations("students");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const canCollect = hasAnyPermission(permissions, ["finance.manage"]);
  const currentYear = useCurrentAcademicYear();
  const [editOpen, setEditOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [removeStudent, setRemoveStudent] = useState<HouseholdStudent | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const household = useApiQuery<HouseholdTree>(
    (tenant) => `/tenants/${tenant}/family-groups/${familyGroupId}`
  );

  const billing = useApiQuery<{ students: BillingMember[] }>((tenant) =>
    canCollect ? `/tenants/${tenant}/finance/family-groups/${familyGroupId}/billing` : null
  );

  const guardians = useApiQuery<GuardianOption[]>((tenant) =>
    editOpen ? `/tenants/${tenant}/students/guardians?limit=200` : null
  );

  const updateHousehold = useApiMutation<
    { name?: string; primaryGuardianId?: string },
    HouseholdTree
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/family-groups/${familyGroupId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/family-groups/${familyGroupId}`,
        `/tenants/${tenant}/family-groups`
      ]
    }
  );

  const addStudent = useApiMutation<{ studentId: string; familyGroupId: string }, unknown>(
    ({ studentId, familyGroupId: groupId }, tenant) => ({
      path: `/tenants/${tenant}/students/${studentId}/family-group`,
      init: { method: "PATCH", body: JSON.stringify({ familyGroupId: groupId }) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/family-groups/${familyGroupId}`,
        `/tenants/${tenant}/students`
      ]
    }
  );

  const unlinkStudent = useApiMutation<{ studentId: string }, unknown>(
    ({ studentId }, tenant) => ({
      path: `/tenants/${tenant}/students/${studentId}/family-group`,
      init: { method: "PATCH", body: JSON.stringify({ familyGroupId: null }) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/family-groups/${familyGroupId}`,
        `/tenants/${tenant}/students`,
        `/tenants/${tenant}/family-groups`
      ]
    }
  );

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    primaryGuardianId: z
      .string()
      .refine((value) => value === "" || z.string().uuid().safeParse(value).success, c("required"))
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      name: household.data?.name ?? "",
      primaryGuardianId: household.data?.primaryGuardian?.id ?? ""
    }
  });

  if (household.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (household.isError || !household.data) {
    return (
      <div className="page-stack">
        <p className="pds-type-body-m-medium error-text">{t("notFound")}</p>
      </div>
    );
  }

  const data = household.data;
  const memberIds = data.students.map((student) => student.id);
  const relationshipLabel = (relationship: string) => {
    const key = `relationship_${relationship}` as
      | "relationship_father"
      | "relationship_mother"
      | "relationship_guardian"
      | "relationship_other";
    return t(key);
  };
  const heroMeta = [
    data.primaryGuardian
      ? t("primaryGuardianLine", { name: data.primaryGuardian.fullName })
      : null,
    t("memberCountMeta", { count: data.students.length })
  ]
    .filter(Boolean)
    .join(" · ");

  const handleRemoveStudent = async () => {
    if (!removeStudent) {
      return;
    }
    setFormError(null);
    try {
      await unlinkStudent.mutateAsync({ studentId: removeStudent.id });
      setRemoveStudent(null);
      void household.refetch();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  return (
    <div className="student-profile-page">
      <PageHeader
        title={data.name}
        segment={{ label: data.name, href: `/dashboard/people/households/${familyGroupId}` }}
        breadcrumbs={[
          { label: nav("group_school") },
          { label: p("directoryTitle"), href: "/dashboard/people" },
          { label: t("directoryTitle"), href: "/dashboard/people?tab=households" }
        ]}
      />

      <NavigationBackLink
        fallback={{ label: t("directoryTitle"), href: "/dashboard/people?tab=households" }}
      />

      <section className="structure-room-banner student-profile-banner">
        <div className="structure-room-banner__main student-profile-banner__main">
          <span className="pds-type-title-xs-bold directory-avatar directory-avatar--household">
            {householdInitials(data.name)}
          </span>
          <div>
            <h2 className="structure-room-banner__title">{data.name}</h2>
            <p className="pds-type-body-s-regular structure-room-banner__meta">{heroMeta}</p>
          </div>
        </div>
        <div className="structure-room-banner__actions student-profile-banner__actions">
          {canManage ? (
            <HeroMoreActionsMenu
              label={t("manageHousehold")}
              items={[
                {
                  id: "edit",
                  label: t("editHousehold"),
                  icon: "edit",
                  onSelect: () => setEditOpen(true)
                }
              ]}
            />
          ) : null}
          {canManage ? (
            <HeroPrimaryAction onClick={() => setAddStudentOpen(true)}>
              <Icon name="person_add" />
              {t("addStudent")}
            </HeroPrimaryAction>
          ) : null}
        </div>
      </section>

      <section className="panel household-members-panel">
        <div className="dash-page-title">
          <h2 className="pds-type-title-s-extrabold dash-page-title__heading">
            {t("treeGuardians")}
          </h2>
        </div>
        {data.guardians.length ? (
          <ul className="household-member-list">
            {data.guardians.map((guardian) => (
              <li key={guardian.id} className="household-member-row">
                <TrailLink
                  href={`/dashboard/people/guardians/${guardian.id}`}
                  className="household-member-row__link"
                  from={{ label: data.name, href: `/dashboard/people/households/${familyGroupId}` }}
                >
                  <DirectoryMemberCell
                    name={guardian.fullName}
                    subtitle={guardian.phone ?? undefined}
                  />
                </TrailLink>
                {guardian.isPrimary ? <Chip>{t("primaryGuardian")}</Chip> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact embedded icon="supervisor_account" title={t("treeEmpty")} />
        )}
      </section>

      <section className="panel household-members-panel">
        <div className="dash-page-title">
          <h2 className="pds-type-title-s-extrabold dash-page-title__heading">
            {t("treeStudents")}
          </h2>
        </div>
        {data.students.length ? (
          <ul className="household-member-list">
            {data.students.map((student) => (
              <li key={student.id} className="household-member-row">
                <TrailLink
                  href={`/dashboard/students/${student.id}`}
                  className="household-member-row__link"
                  from={{ label: data.name, href: `/dashboard/people/households/${familyGroupId}` }}
                >
                  <DirectoryMemberCell
                    name={student.fullName}
                    subtitle={student.admissionNumber}
                  />
                </TrailLink>
                <div className="household-member-row__trailing">
                  {student.guardians.length ? (
                    <span className="pds-type-body-s-regular muted">
                      {student.guardians
                        .map((link) => relationshipLabel(link.relationship))
                        .join(", ")}
                    </span>
                  ) : null}
                  <StatusBadge
                    status={student.status}
                    label={s(`status_${student.status}` as "status_draft")}
                  />
                  {canManage ? (
                    <RowMoreActionsMenu
                      ariaLabel={t("removeStudentAria", { name: student.fullName })}
                      items={[
                        {
                          id: "remove",
                          label: t("removeStudentConfirm"),
                          icon: "person_remove",
                          destructive: true,
                          onSelect: () => setRemoveStudent(student)
                        }
                      ]}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact embedded icon="school" title={t("treeEmpty")} />
        )}
      </section>

      {canCollect ? (
        <PeopleBillingPanel
          title={t("householdBalanceTitle")}
          members={billing.data?.students ?? []}
          academicYearId={currentYear.data?.id ?? null}
          loading={billing.isLoading}
          error={billing.isError}
          canCollect={canCollect}
          fromLabel={data.name}
          fromHref={`/dashboard/people/households/${familyGroupId}`}
          onRefresh={() => void billing.refetch()}
        />
      ) : null}

      {formError && !editOpen && !addStudentOpen && !removeStudent ? (
        <p className="pds-type-body-m-medium error-text" role="alert">
          {formError}
        </p>
      ) : null}

      <RecordFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        title={t("editTitle")}
        help={t("editHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          setFormError(null);
          try {
            await updateHousehold.mutateAsync({
              name: values.name,
              ...(values.primaryGuardianId
                ? { primaryGuardianId: values.primaryGuardianId }
                : {})
            });
            setEditOpen(false);
            void household.refetch();
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setEditOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={updateHousehold.isPending}>
              <Icon name="save" />
              {updateHousehold.isPending ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("householdName")} error={form.formState.errors.name?.message}>
          <FormInput {...form.register("name")} />
        </Field>
        <Field
          label={t("primaryGuardian")}
          error={form.formState.errors.primaryGuardianId?.message}
        >
          <PdsSelectField
            variant="form"
            value={form.watch("primaryGuardianId")}
            onValueChange={(value) =>
              form.setValue("primaryGuardianId", typeof value === "string" ? value : "", {
                shouldValidate: true
              })
            }
            placeholder={t("selectPrimaryGuardian")}
            options={(guardians.data ?? data.guardians).map((guardian) => ({
              value: guardian.id,
              label: guardian.fullName
            }))}
          />
        </Field>
        {formError ? (
          <p className="pds-type-body-m-medium error-text" role="alert">
            {formError}
          </p>
        ) : null}
      </RecordFormSheet>

      <RecordFormSheet
        open={addStudentOpen}
        onOpenChange={(open) => {
          setAddStudentOpen(open);
          if (!open) {
            setAddStudentId("");
            setFormError(null);
          }
        }}
        title={t("addStudentTitle")}
        help={t("addStudentHelp")}
        onSubmit={(event) => {
          event.preventDefault();
          setFormError(null);
          if (!addStudentId) {
            setFormError(t("selectStudentRequired"));
            return;
          }
          void addStudent
            .mutateAsync({ studentId: addStudentId, familyGroupId })
            .then(() => {
              setAddStudentOpen(false);
              setAddStudentId("");
              void household.refetch();
            })
            .catch((error) => {
              setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
            });
        }}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setAddStudentOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={addStudent.isPending}>
              <Icon name="person_add" />
              {addStudent.isPending ? c("loading") : t("addStudentConfirm")}
            </button>
          </>
        }
      >
        <Field label={t("student")}>
          <StudentCombobox
            value={addStudentId}
            onChange={setAddStudentId}
            excludeIds={memberIds}
          />
        </Field>
        {formError ? (
          <p className="pds-type-body-m-medium error-text" role="alert">
            {formError}
          </p>
        ) : null}
      </RecordFormSheet>

      <ConfirmDialog
        open={Boolean(removeStudent)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveStudent(null);
            setFormError(null);
          }
        }}
        title={t("removeStudentTitle")}
        description={
          removeStudent
            ? t("removeStudentDescription", { name: removeStudent.fullName })
            : ""
        }
        confirmLabel={t("removeStudentConfirm")}
        cancelLabel={c("cancel")}
        destructive
        loading={unlinkStudent.isPending}
        onConfirm={() => void handleRemoveStudent()}
      />
    </div>
  );
}
