"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { zodResolver } from "../../../lib/zod-resolver";

type AcademicYear = { id: string; name: string; status: string };
type Grade = { id: string; name: string; status: string };
type GradeSubject = {
  id: string;
  academicYearId: string;
  gradeId: string;
  subjectId: string;
};
type Subject = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  updatedAt?: string;
};

type FormValues = {
  name: string;
  code: string;
  academicYearId: string;
  gradeIds: string[];
};

type FormMode = { type: "create" } | { type: "edit"; subject: Subject };

const SUBJECTS_PATH = (tenant: string) => `/tenants/${tenant}/academics/subjects`;
const MAPPINGS_PATH = (tenant: string) => `/tenants/${tenant}/academics/grade-subjects`;

export default function SubjectsPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const subjects = useApiQuery<Subject[]>(SUBJECTS_PATH);
  const years = useApiQuery<AcademicYear[]>((tn) => `/tenants/${tn}/academics/academic-years`);
  const grades = useApiQuery<Grade[]>((tn) => `/tenants/${tn}/academics/grades`);
  const mappings = useApiQuery<GradeSubject[]>(MAPPINGS_PATH);

  const create = useApiMutation<Record<string, unknown>>(
    (body, tenantId) => ({
      path: SUBJECTS_PATH(tenantId),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_body, tenantId) => [SUBJECTS_PATH(tenantId), MAPPINGS_PATH(tenantId)] }
  );

  const update = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenantId) => {
      const { id, ...payload } = body;
      return {
        path: `${SUBJECTS_PATH(tenantId)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    { invalidatePaths: (_body, tenantId) => [SUBJECTS_PATH(tenantId), MAPPINGS_PATH(tenantId)] }
  );

  const archive = useApiMutation<{ id: string }>(
    ({ id }, tenantId) => ({
      path: `${SUBJECTS_PATH(tenantId)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_body, tenantId) => [SUBJECTS_PATH(tenantId)] }
  );

  const reactivate = useApiMutation<{ id: string }>(
    ({ id }, tenantId) => ({
      path: `${SUBJECTS_PATH(tenantId)}/${id}/reactivate`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_body, tenantId) => [SUBJECTS_PATH(tenantId)] }
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

  const openYears = years.data?.filter((year) => year.status !== "archived") ?? [];
  const activeGrades = grades.data?.filter((grade) => grade.status !== "archived") ?? [];
  const selectedYearId = form.watch("academicYearId");
  const selectedGradeIds = form.watch("gradeIds");

  const gradeNamesForSubject = (subjectId: string) => {
    const gradeIds =
      mappings.data?.filter((mapping) => mapping.subjectId === subjectId).map((mapping) => mapping.gradeId) ??
      [];
    const names = gradeIds
      .map((gradeId) => grades.data?.find((grade) => grade.id === gradeId)?.name)
      .filter(Boolean);
    return names.length ? names.join(", ") : "—";
  };

  const openCreate = () => {
    form.reset({
      ...defaultValues,
      academicYearId: openYears[0]?.id ?? ""
    });
    setFormMode({ type: "create" });
  };

  const openEdit = (subject: Subject) => {
    const yearId = openYears[0]?.id ?? "";
    const mappedGradeIds =
      mappings.data
        ?.filter((mapping) => mapping.subjectId === subject.id && mapping.academicYearId === yearId)
        .map((mapping) => mapping.gradeId) ?? [];

    form.reset({
      name: subject.name,
      code: subject.code ?? "",
      academicYearId: yearId,
      gradeIds: mappedGradeIds
    });
    setFormMode({ type: "edit", subject });
  };

  const toggleGrade = (gradeId: string) => {
    const current = form.getValues("gradeIds");
    form.setValue(
      "gradeIds",
      current.includes(gradeId) ? current.filter((id) => id !== gradeId) : [...current, gradeId],
      { shouldDirty: true }
    );
  };

  const onYearChange = (yearId: string, subjectId?: string) => {
    form.setValue("academicYearId", yearId);
    if (!subjectId) {
      return;
    }
    const mappedGradeIds =
      mappings.data
        ?.filter((mapping) => mapping.subjectId === subjectId && mapping.academicYearId === yearId)
        .map((mapping) => mapping.gradeId) ?? [];
    form.setValue("gradeIds", mappedGradeIds);
  };

  const buildPayload = (values: FormValues) => ({
    name: values.name,
    code: values.code || undefined,
    academicYearId: values.academicYearId,
    gradeIds: values.gradeIds
  });

  const columns: ColumnDef<Subject, unknown>[] = [
    { id: "name", header: c("name"), accessorKey: "name" },
    { id: "code", header: t("code"), accessorFn: (subject) => subject.code ?? "—" },
    {
      id: "grades",
      header: t("grades"),
      accessorFn: (subject) => gradeNamesForSubject(subject.id)
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: "8px" }}>
          {row.original.status !== "archived" ? (
            <>
              <button type="button" className="row-action" onClick={() => openEdit(row.original)}>
                {t("edit")}
              </button>
              <button
                type="button"
                className="row-action"
                disabled={archive.isPending}
                onClick={() => void archive.mutateAsync({ id: row.original.id })}
              >
                {archive.isPending ? t("archiving") : t("archive")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="row-action"
              disabled={reactivate.isPending}
              onClick={() => void reactivate.mutateAsync({ id: row.original.id })}
            >
              {reactivate.isPending ? t("reactivating") : t("reactivate")}
            </button>
          )}
        </div>
      )
    }
  ];

  const error = subjects.isError
    ? subjects.error instanceof Error
      ? subjects.error.message
      : c("somethingWrong")
    : null;

  return (
    <>
      <p className="muted">{t("subjectsHelp")}</p>
      <section className="panel">
        <TablePanelHead
          title={t("subjects")}
          onRefresh={() => {
            void subjects.refetch();
            void mappings.refetch();
          }}
          onAdd={openCreate}
          addLabel={t("addSubject")}
        />
        <TablePanelBody loading={subjects.isLoading} error={error} empty={!subjects.data?.length}>
          <DataTable columns={columns} data={subjects.data ?? []} />
        </TablePanelBody>

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
          <Field label={t("year")} error={form.formState.errors.academicYearId?.message}>
            <select
              value={selectedYearId}
              onChange={(event) =>
                onYearChange(
                  event.target.value,
                  formMode?.type === "edit" ? formMode.subject.id : undefined
                )
              }
            >
              <option value="">{t("selectYear")}</option>
              {openYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("gradesForSubject")}>
            <div className="checkbox-list">
              {activeGrades.map((grade) => (
                <label key={grade.id} className="form-check">
                  <input
                    type="checkbox"
                    checked={selectedGradeIds.includes(grade.id)}
                    onChange={() => toggleGrade(grade.id)}
                  />
                  {grade.name}
                </label>
              ))}
              {!activeGrades.length ? <p className="muted">{t("noGradesYet")}</p> : null}
            </div>
          </Field>
        </RecordFormSheet>
      </section>
    </>
  );
}
