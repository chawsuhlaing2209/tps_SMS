"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { CheckboxList } from "../../../../components/shared/checkbox-list";
import { useAcademicYearContext } from "../use-academic-year-context";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { gradeBadgeLabel } from "../grade-label";
import { subjectColor, subjectIcon } from "../../structure/subject-colors";

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
  status: string;
  gradeCount: number;
  grades: { id: string; name: string }[];
};

type FormValues = {
  name: string;
  code: string;
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
  const mappings = useApiQuery<GradeSubject[]>(MAPPINGS_PATH);
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
        academicYearId: z.string().uuid(requiredMessage),
        gradeIds: z.array(z.string())
      }),
    [requiredMessage]
  );

  const defaultValues: FormValues = {
    name: "",
    code: "",
    academicYearId: "",
    gradeIds: []
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues
  });

  const activeGrades = grades.data?.filter((grade) => grade.status !== "archived") ?? [];
  const selectedGradeIds = form.watch("gradeIds");
  const activeSubjects = (subjects.data ?? []).filter((s) => s.status !== "archived");

  const openCreate = () => {
    form.reset({ ...defaultValues, academicYearId: contextYearId });
    setFormMode({ type: "create" });
  };

  const openEdit = (subject: SubjectOverview) => {
    form.reset({
      name: subject.name,
      code: subject.code ?? "",
      academicYearId: contextYearId,
      gradeIds: subject.grades.map((grade) => grade.id)
    });
    setFormMode({ type: "edit", subject });
  };

  const buildPayload = (values: FormValues) => ({
    name: values.name,
    code: values.code || undefined,
    academicYearId: values.academicYearId,
    gradeIds: values.gradeIds
  });

  const error = subjects.isError
    ? subjects.error instanceof Error
      ? subjects.error.message
      : c("somethingWrong")
    : null;

  return (
    <div className="setup-subjects-page">
      <PageHeader
        title={setup("subjects")}
        description={setup("subjectsPageHelp")}
        breadcrumbs={[{ label: nav("academicSetup") }, { label: setup("subjects") }]}
      />

      <div className="setup-toolbar">
        <p className="setup-toolbar__help">{setup("subjectsToolbarHelp")}</p>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Icon name="add" />
          {t("addSubject")}
        </button>
      </div>

      <section className="panel setup-subjects-panel">
        {subjects.isLoading || currentYear.isLoading ? (
          <div className="panel-body">
            <p className="muted">{c("loading")}</p>
          </div>
        ) : error ? (
          <div className="panel-body">
            <p className="error-text">{error}</p>
          </div>
        ) : !activeSubjects.length ? (
          <div className="panel-body">
            <p className="muted">{c("empty")}</p>
          </div>
        ) : (
          <div className="setup-subjects-table-wrap panel-body">
            <table className="setup-subjects-table">
              <thead>
                <tr>
                  <th scope="col">{setup("subjectNameColumn")}</th>
                  <th scope="col">{setup("subjectIconColumn")}</th>
                  <th scope="col">{setup("applicableGradesColumn")}</th>
                  <th scope="col" className="setup-subjects-table__actions-col">
                    <span className="sr-only">{t("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeSubjects.map((subject) => {
                  const colors = subjectColor(subject.name);
                  return (
                    <tr key={subject.id}>
                      <td>
                        <div className="setup-subjects-table__name">
                          <span
                            className="setup-subjects-table__dot"
                            style={{ background: colors.bg }}
                          />
                          <span className="setup-subjects-table__title">{subject.name}</span>
                        </div>
                      </td>
                      <td className="setup-subjects-table__icon-cell">
                        <span className="setup-subjects-table__icon" aria-hidden>
                          <Icon name={subjectIcon(subject.name)} />
                        </span>
                      </td>
                      <td>
                        <div className="setup-grade-badges">
                          {subject.grades.length ? (
                            subject.grades.map((grade) => (
                              <span key={grade.id} className="setup-grade-badge">
                                {gradeBadgeLabel(grade.name)}
                              </span>
                            ))
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
                      </td>
                      <td className="setup-subjects-table__actions-col">
                        <button
                          type="button"
                          className="btn-outline setup-subjects-table__edit"
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
          </div>
        )}
      </section>

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            form.reset(defaultValues);
          }
        }}
        title={formMode?.type === "edit" ? t("editSubjectTitle") : t("addSubjectTitle")}
        onSubmit={form.handleSubmit(async (values) => {
          const payload = buildPayload(values);
          if (formMode?.type === "edit") {
            await update.mutateAsync({ id: formMode.subject.id, ...payload });
          } else {
            await create.mutateAsync(payload);
          }
          setFormMode(null);
          form.reset(defaultValues);
        })}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFormMode(null);
                form.reset(defaultValues);
              }}
            >
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting
                ? t("creating")
                : formMode?.type === "edit"
                  ? c("save")
                  : t("addSubject")}
            </button>
          </>
        }
      >
        <Field label={t("subjectName")} error={form.formState.errors.name?.message}>
          <input type="text" placeholder={t("subjectNamePlaceholder")} {...form.register("name")} />
        </Field>
        <Field label={t("code")} error={form.formState.errors.code?.message}>
          <input type="text" {...form.register("code")} />
        </Field>
        <Field label={t("year")}>
          <input readOnly value={currentYear.data?.name ?? ""} />
        </Field>
        <Field label={t("gradesForSubject")}>
          <CheckboxList
            options={activeGrades.map((grade) => ({ id: grade.id, label: grade.name }))}
            selectedIds={selectedGradeIds}
            onChange={(gradeIds) => form.setValue("gradeIds", gradeIds, { shouldDirty: true })}
            emptyMessage={<p className="muted">{t("noGradesYet")}</p>}
          />
        </Field>
      </RecordFormSheet>
    </div>
  );
}
