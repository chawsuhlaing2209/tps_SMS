"use client";
import { FormInput } from "../../../../../components/shared/form-input";

import type { FamilyTreeGuardian, FamilyTreeStudent } from "../../family-tree";
import { FamilyTree } from "../../family-tree";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../../../lib/api";
import { Field } from "../../../../lib/form";
import { Icon } from "../../../../lib/material-icon";
import { hasAnyPermission } from "../../../../lib/permissions";
import { RecordFormSheet } from "../../../../lib/record-sheet";
import { getSession } from "../../../../lib/session";
import { StudentCombobox } from "../../../../lib/student-combobox";
import { TablePanelBody, TablePanelHead } from "../../../../lib/table-panel";
import { PdsSelectField } from "../../../../../components/pds";
import { zodResolver } from "../../../../lib/zod-resolver";
import { PageHeader } from "../../../page-header-context";

type HouseholdTree = {
  id: string;
  name: string;
  primaryGuardian: { id: string; fullName: string; phone: string | null } | null;
  guardians: FamilyTreeGuardian[];
  students: FamilyTreeStudent[];
};

type GuardianOption = { id: string; fullName: string };

export default function HouseholdDetailPage() {
  const params = useParams<{ familyGroupId: string }>();
  const familyGroupId = params.familyGroupId;
  const t = useTranslations("households");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const p = useTranslations("people");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const [editOpen, setEditOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const household = useApiQuery<HouseholdTree>(
    (tenant) => `/tenants/${tenant}/family-groups/${familyGroupId}`
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

  return (
    <div className="page-stack">
      <PageHeader
        title={data.name}
        description={t("detailDescription")}
        breadcrumbs={[
          { label: nav("group_school") },
          { label: p("directoryTitle"), href: "/dashboard/people" },
          { label: t("directoryTitle"), href: "/dashboard/people?tab=households" }
        ]}
      />

      <TablePanelHead
        title={t("treeTitle")}
        help={t("treeHelp")}
        onRefresh={() => void household.refetch()}
        extra={
          canManage ? (
            <div className="form-actions form-actions--inline">
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setEditOpen(true)}>
                <Icon name="edit" />
                {t("editHousehold")}
              </button>
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setAddStudentOpen(true)}>
                <Icon name="person_add" />
                {t("addStudent")}
              </button>
            </div>
          ) : null
        }
      />
      <TablePanelBody loading={false} error={null}>
          {data.primaryGuardian ? (
            <p className="pds-type-body-s-regular muted panel-help">
              {t("primaryGuardianLine", { name: data.primaryGuardian.fullName })}
            </p>
          ) : null}
          <FamilyTree guardians={data.guardians} students={data.students} />
          <p className="pds-type-body-s-regular muted panel-help">{t("siblingHint")}</p>
      </TablePanelBody>

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
    </div>
  );
}