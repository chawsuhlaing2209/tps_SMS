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
import { useMasterDataResource } from "../master-data";

type AcademicYear = { id: string; name: string; status: string };
type Subject = { id: string; name: string; status: string };
type GradeSubject = {
  id: string;
  academicYearId: string;
  gradeId: string;
  subjectId: string;
};
type Grade = {
  id: string;
  name: string;
  minAge: number | null;
  maxAge: number | null;
  status: string;
  updatedAt?: string;
};

type FormValues = {
  name: string;
  minAge: string;
  maxAge: string;
  academicYearId: string;
  subjectIds: string[];
};

type FormMode = { type: "create" } | { type: "edit"; grade: Grade };

const MAPPINGS_PATH = (tenant: string) => `/tenants/${tenant}/academics/grade-subjects`;

export default function GradesPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const { query, archive, reactivate } = useMasterDataResource<Grade>("grades");
  const years = useApiQuery<AcademicYear[]>((tn) => `/tenants/${tn}/academics/academic-years`);
  const subjects = useApiQuery<Subject[]>((tn) => `/tenants/${tn}/academics/subjects`);
  const mappings = useApiQuery<GradeSubject[]>(MAPPINGS_PATH);

  const gradesPath = (tenant: string) => `/tenants/${tenant}/academics/grades`;

  const create = useApiMutation<Record<string, unknown>>(
    (body, tenantId) => ({
      path: gradesPath(tenantId),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_body, tenantId) => [gradesPath(tenantId), MAPPINGS_PATH(tenantId)] }
  );

  const update = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenantId) => {
      const { id, ...payload } = body;
      return {
        path: `${gradesPath(tenantId)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    { invalidatePaths: (_body, tenantId) => [gradesPath(tenantId), MAPPINGS_PATH(tenantId)] }
  );

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        minAge: z.string(),
        maxAge: z.string(),
        academicYearId: z.string().uuid(requiredMessage),
        subjectIds: z.array(z.string())
      }),
    [requiredMessage]
  );

  const defaultValues: FormValues = {
    name: "",
    minAge: "",
    maxAge: "",
    academicYearId: "",
    subjectIds: []
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues
  });

  const openYears = years.data?.filter((year) => year.status !== "archived") ?? [];
  const activeSubjects = subjects.data?.filter((subject) => subject.status !== "archived") ?? [];
  const selectedYearId = form.watch("academicYearId");
  const selectedSubjectIds = form.watch("subjectIds");

  const subjectCountForGrade = (gradeId: string) =>
    mappings.data?.filter((mapping) => mapping.gradeId === gradeId).length ?? 0;

  const formatAgeRange = (grade: Grade) => {
    if (grade.minAge != null && grade.maxAge != null) {
      return t("ageRangeValue", { min: grade.minAge, max: grade.maxAge });
    }
    if (grade.minAge != null) {
      return t("ageMinValue", { min: grade.minAge });
    }
    if (grade.maxAge != null) {
      return t("ageMaxValue", { max: grade.maxAge });
    }
    return "—";
  };

  const openCreate = () => {
    form.reset({
      ...defaultValues,
      academicYearId: openYears[0]?.id ?? ""
    });
    setFormMode({ type: "create" });
  };

  const openEdit = (grade: Grade) => {
    const yearId = openYears[0]?.id ?? "";
    const mappedSubjectIds =
      mappings.data
        ?.filter((mapping) => mapping.gradeId === grade.id && mapping.academicYearId === yearId)
        .map((mapping) => mapping.subjectId) ?? [];

    form.reset({
      name: grade.name,
      minAge: grade.minAge != null ? String(grade.minAge) : "",
      maxAge: grade.maxAge != null ? String(grade.maxAge) : "",
      academicYearId: yearId,
      subjectIds: mappedSubjectIds
    });
    setFormMode({ type: "edit", grade });
  };

  const toggleSubject = (subjectId: string) => {
    const current = form.getValues("subjectIds");
    form.setValue(
      "subjectIds",
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId],
      { shouldDirty: true }
    );
  };

  const onYearChange = (yearId: string, gradeId?: string) => {
    form.setValue("academicYearId", yearId);
    if (!gradeId) {
      return;
    }
    const mappedSubjectIds =
      mappings.data
        ?.filter((mapping) => mapping.gradeId === gradeId && mapping.academicYearId === yearId)
        .map((mapping) => mapping.subjectId) ?? [];
    form.setValue("subjectIds", mappedSubjectIds);
  };

  const buildPayload = (values: FormValues) => ({
    name: values.name,
    minAge: values.minAge ? Number(values.minAge) : null,
    maxAge: values.maxAge ? Number(values.maxAge) : null,
    academicYearId: values.academicYearId,
    subjectIds: values.subjectIds
  });

  const columns: ColumnDef<Grade, unknown>[] = [
    { id: "name", header: c("name"), accessorKey: "name" },
    {
      id: "ageRange",
      header: t("ageRange"),
      accessorFn: (grade) => formatAgeRange(grade)
    },
    {
      id: "subjects",
      header: t("subjects"),
      accessorFn: (grade) => subjectCountForGrade(grade.id)
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

  const error = query.isError
    ? query.error instanceof Error
      ? query.error.message
      : c("somethingWrong")
    : null;

  return (
    <>
      <p className="muted">{t("gradesHelp")}</p>
      <section className="panel">
        <TablePanelHead
          title={t("grades")}
          onRefresh={() => {
            void query.refetch();
            void mappings.refetch();
          }}
          onAdd={openCreate}
          addLabel={t("addGrade")}
        />
        <TablePanelBody loading={query.isLoading} error={error} empty={!query.data?.length}>
          <DataTable columns={columns} data={query.data ?? []} />
        </TablePanelBody>

        <RecordFormSheet
          open={formMode !== null}
          onOpenChange={(open) => {
            if (!open) {
              setFormMode(null);
              form.reset(defaultValues);
            }
          }}
          title={formMode?.type === "edit" ? t("editGradeTitle") : t("addGradeTitle")}
          onSubmit={form.handleSubmit(async (values) => {
            const payload = buildPayload(values);
            if (formMode?.type === "edit") {
              await update.mutateAsync({ id: formMode.grade.id, ...payload });
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
                    : t("addGrade")}
              </button>
            </>
          }
        >
          <Field label={t("gradeName")} error={form.formState.errors.name?.message}>
            <input type="text" placeholder={t("gradeNamePlaceholder")} {...form.register("name")} />
          </Field>
          <Field label={t("minAge")} error={form.formState.errors.minAge?.message}>
            <input type="number" min={0} placeholder={t("minAgePlaceholder")} {...form.register("minAge")} />
          </Field>
          <Field label={t("maxAge")} error={form.formState.errors.maxAge?.message}>
            <input type="number" min={0} placeholder={t("maxAgePlaceholder")} {...form.register("maxAge")} />
          </Field>
          <Field label={t("year")} error={form.formState.errors.academicYearId?.message}>
            <select
              value={selectedYearId}
              onChange={(event) =>
                onYearChange(
                  event.target.value,
                  formMode?.type === "edit" ? formMode.grade.id : undefined
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
          <Field label={t("subjectsForGrade")}>
            <div className="checkbox-list">
              {activeSubjects.map((subject) => (
                <label key={subject.id} className="form-check">
                  <input
                    type="checkbox"
                    checked={selectedSubjectIds.includes(subject.id)}
                    onChange={() => toggleSubject(subject.id)}
                  />
                  {subject.name}
                </label>
              ))}
              {!activeSubjects.length ? <p className="muted">{t("noSubjectsYet")}</p> : null}
            </div>
          </Field>
        </RecordFormSheet>
      </section>
    </>
  );
}
