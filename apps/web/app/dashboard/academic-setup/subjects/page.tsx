"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { FormField, FormInput } from "../../../../components/shared/form-input";
import { Chip, ChipGroup } from "../../../../components/shared/chip";
import { useAcademicYearContext } from "../use-academic-year-context";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { gradeBadgeLabel } from "../grade-label";
import {
  defaultSubjectColorKey,
  defaultSubjectIconKey,
  SUBJECT_COLOR_OPTIONS,
  SUBJECT_ICON_OPTIONS,
  subjectColor,
  subjectIcon,
  type SubjectColorKey,
  type SubjectIconKey
} from "../../structure/subject-colors";
import { SubjectAppearanceFields } from "./subject-form-fields";

type Grade = { id: string; name: string; status: string };
type GradeSubject = {
  id: string;
  academicYearId: string;
  gradeId: string;
  subjectId: string;
};
type SubjectOverview = {
  id: string;
  name: string;
  code: string | null;
  colorKey: string | null;
  iconKey: string | null;
  status: string;
  gradeCount: number;
  grades: { id: string; name: string }[];
};

type FormValues = {
  name: string;
  code: string;
  colorKey: SubjectColorKey;
  iconKey: SubjectIconKey;
  academicYearId: string;
  gradeIds: string[];
};

type FormMode = { type: "create" } | { type: "edit"; subject: SubjectOverview };

const SUBJECTS_PATH = (tenant: string) => `/tenants/${tenant}/academics/subjects`;
const MAPPINGS_PATH = (tenant: string) => `/tenants/${tenant}/academics/grade-subjects`;
const setupSubjectsPath = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/subjects`;
const setupGradesPath = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`;

const mappingInvalidationPaths = (tenantId: string, academicYearId: string) => [
  SUBJECTS_PATH(tenantId),
  MAPPINGS_PATH(tenantId),
  setupSubjectsPath(tenantId, academicYearId),
  setupGradesPath(tenantId, academicYearId)
];

export default function SubjectsPage() {
  const t = useTranslations("academics");
  const setup = useTranslations("academicSetup");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const currentYear = useCurrentAcademicYear();
  const grades = useApiQuery<Grade[]>((tn) => `/tenants/${tn}/academics/grades`);
  const { contextYearId } = useAcademicYearContext(currentYear.data);

  const subjects = useApiQuery<SubjectOverview[]>((tn) =>
    contextYearId ? setupSubjectsPath(tn, contextYearId) : null
  );

  const create = useApiMutation<{ academicYearId: string } & Record<string, unknown>>(
    (body, tenantId) => ({
      path: SUBJECTS_PATH(tenantId),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (body, tenantId) =>
        mappingInvalidationPaths(tenantId, body.academicYearId)
    }
  );

  const update = useApiMutation<{ id: string; academicYearId: string } & Record<string, unknown>>(
    (body, tenantId) => {
      const { id, ...payload } = body;
      return {
        path: `${SUBJECTS_PATH(tenantId)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    {
      invalidatePaths: (body, tenantId) =>
        mappingInvalidationPaths(tenantId, body.academicYearId)
    }
  );

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        code: z.string(),
        colorKey: z.enum(SUBJECT_COLOR_OPTIONS.map((entry) => entry.key) as [SubjectColorKey, ...SubjectColorKey[]]),
        iconKey: z.enum(SUBJECT_ICON_OPTIONS.map((entry) => entry.key) as [SubjectIconKey, ...SubjectIconKey[]]),
        academicYearId: z.string().uuid(requiredMessage),
        gradeIds: z.array(z.string())
      }),
    [requiredMessage]
  );

  const defaultValues: FormValues = {
    name: "",
    code: "",
    colorKey: "azure",
    iconKey: "maths",
    academicYearId: "",
    gradeIds: []
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues
  });

  const activeGrades = grades.data?.filter((grade) => grade.status !== "archived") ?? [];
  const selectedGradeIds = form.watch("gradeIds");
  const colorKey = form.watch("colorKey");
  const iconKey = form.watch("iconKey");
  const activeSubjects = (subjects.data ?? []).filter((s) => s.status !== "archived");

  const closeSheet = () => {
    setFormMode(null);
    form.reset(defaultValues);
  };

  const openCreate = () => {
    form.reset({
      ...defaultValues,
      academicYearId: contextYearId,
      colorKey: "azure",
      iconKey: "maths"
    });
    setFormMode({ type: "create" });
  };

  const openEdit = (subject: SubjectOverview) => {
    form.reset({
      name: subject.name,
      code: subject.code ?? "",
      colorKey: (subject.colorKey as SubjectColorKey | null) ?? defaultSubjectColorKey(subject.name),
      iconKey: (subject.iconKey as SubjectIconKey | null) ?? defaultSubjectIconKey(subject.name),
      academicYearId: contextYearId,
      gradeIds: subject.grades.map((grade) => grade.id)
    });
    setFormMode({ type: "edit", subject });
  };

  const buildPayload = (values: FormValues) => ({
    name: values.name,
    code: values.code || undefined,
    colorKey: values.colorKey,
    iconKey: values.iconKey,
    academicYearId: values.academicYearId,
    gradeIds: values.gradeIds
  });

  const error = subjects.isError
    ? subjects.error instanceof Error
      ? subjects.error.message
      : c("somethingWrong")
    : null;

  return (
    <>
      <PageHeader
        title={setup("subjects")}
        description={setup("subjectsPageHelp")}
        breadcrumbs={[
          { label: nav("settings"), href: "/dashboard/settings/user-roles" },
          { label: setup("subjects") }
        ]}
        resetTrail={[
          { label: nav("settings"), href: "/dashboard/settings/user-roles" },
          { label: setup("subjects"), href: "/dashboard/academic-setup/subjects" }
        ]}
        segment={{ label: setup("subjects"), href: "/dashboard/academic-setup/subjects" }}
      />

      <TablePanelHead
        help={setup("subjectsToolbarHelp")}
        onAdd={openCreate}
        addLabel={t("addSubject")}
      />

      <TablePanelBody
        loading={subjects.isLoading || currentYear.isLoading}
        error={error}
        empty={!activeSubjects.length}
      >
        <table className="pds-type-body-m-medium padauk-table setup-subjects-table">
          <thead>
            <tr>
              <th scope="col" className="pds-type-caption-s">{setup("subjectNameColumn")}</th>
              <th scope="col" className="pds-type-caption-s">{setup("subjectIconColumn")}</th>
              <th scope="col" className="pds-type-caption-s">{setup("applicableGradesColumn")}</th>
              <th scope="col" className="pds-type-caption-s setup-subjects-table__actions-col">
                <span className="sr-only">{t("actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {activeSubjects.map((subject) => {
              const colors = subjectColor(subject.name, subject.colorKey);
              const icon = subjectIcon(subject.name, subject.iconKey);
              return (
                <tr key={subject.id}>
                  <td>
                    <div className="setup-subjects-table__name">
                      <span
                        className="setup-subjects-table__dot"
                        style={{ background: colors.bg }}
                      />
                      <span className="pds-type-body-l-medium setup-subjects-table__title">{subject.name}</span>
                    </div>
                  </td>
                  <td className="setup-subjects-table__icon-cell">
                    <span className="setup-subjects-table__icon" aria-hidden>
                      <Icon name={icon} size={20} />
                    </span>
                  </td>
                  <td className="setup-subjects-table__grades-cell">
                    <ChipGroup>
                      {subject.grades.length ? (
                        subject.grades.map((grade) => (
                          <Chip key={grade.id}>{gradeBadgeLabel(grade.name)}</Chip>
                        ))
                      ) : (
                        <span className="pds-type-body-s-regular muted">—</span>
                      )}
                    </ChipGroup>
                  </td>
                  <td className="setup-subjects-table__actions-col">
                    <button
                      type="button"
                      className="pds-type-body-m-medium btn-outline setup-subjects-table__edit"
                      onClick={() => openEdit(subject)}
                    >
                      {t("edit")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TablePanelBody>

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
        headerIcon="menu_book"
        title={formMode?.type === "edit" ? t("editSubjectTitle") : t("addSubjectTitle")}
        help={t("addSubjectHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          const payload = buildPayload(values);
          if (formMode?.type === "edit") {
            await update.mutateAsync({ id: formMode.subject.id, ...payload });
          } else {
            await create.mutateAsync(payload);
          }
          closeSheet();
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={closeSheet}>
              {c("cancel")}
            </button>
            <p className="pds-type-body-s-regular muted record-sheet__footer-note">{t("subjectFooterNote")}</p>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={form.formState.isSubmitting}
            >
              <Icon name={formMode?.type === "edit" ? "check" : "add"} />
              {form.formState.isSubmitting
                ? t("creating")
                : formMode?.type === "edit"
                  ? c("save")
                  : t("createSubject")}
            </button>
          </>
        }
      >
        <FormField
          label={t("subjectName")}
          required
          labelStyle="caps"
          error={form.formState.errors.name?.message}
        >
          <FormInput
            type="text"
            placeholder={t("subjectNamePlaceholder")}
            inputState={form.formState.errors.name ? "error" : "enabled"}
            {...form.register("name")}
          />
        </FormField>

        <SubjectAppearanceFields
          colorKey={colorKey}
          iconKey={iconKey}
          gradeIds={selectedGradeIds}
          grades={activeGrades}
          onColorKeyChange={(key) => form.setValue("colorKey", key, { shouldDirty: true })}
          onIconKeyChange={(key) => form.setValue("iconKey", key, { shouldDirty: true })}
          onGradeIdsChange={(gradeIds) => form.setValue("gradeIds", gradeIds, { shouldDirty: true })}
        />
      </RecordFormSheet>
    </>
  );
}
