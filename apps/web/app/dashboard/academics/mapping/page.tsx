"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { zodResolver } from "../../../lib/zod-resolver";

type AcademicYear = { id: string; name: string; status: string };
type Grade = { id: string; name: string };
type Subject = { id: string; name: string };
type GradeSubject = {
  id: string;
  academicYearId: string;
  gradeId: string;
  subjectId: string;
  weight: string;
  isRequired: boolean;
};

type MappingValues = {
  academicYearId: string;
  gradeId: string;
  subjectId: string;
  isRequired: boolean;
};

export default function GradeSubjectMappingPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");

  const years = useApiQuery<AcademicYear[]>((tn) => `/tenants/${tn}/academics/academic-years`);
  const grades = useApiQuery<Grade[]>((tn) => `/tenants/${tn}/academics/grades`);
  const subjects = useApiQuery<Subject[]>((tn) => `/tenants/${tn}/academics/subjects`);
  const mappings = useApiQuery<GradeSubject[]>((tn) => `/tenants/${tn}/academics/grade-subjects`);

  const assign = useApiMutation<MappingValues>(
    (body, tn) => ({
      path: `/tenants/${tn}/academics/grade-subjects`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tn) => [`/tenants/${tn}/academics/grade-subjects`] }
  );

  const schema = z.object({
    academicYearId: z.string().uuid(c("required")),
    gradeId: z.string().uuid(c("required")),
    subjectId: z.string().uuid(c("required")),
    isRequired: z.boolean()
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<MappingValues>({
    resolver: zodResolver(schema),
    defaultValues: { academicYearId: "", gradeId: "", subjectId: "", isRequired: true }
  });

  const onSubmit = handleSubmit(async (values) => {
    await assign.mutateAsync(values);
    reset({ academicYearId: values.academicYearId, gradeId: "", subjectId: "", isRequired: true });
  });

  const yearName = (id: string) => years.data?.find((y) => y.id === id)?.name ?? id.slice(0, 8);
  const gradeName = (id: string) => grades.data?.find((g) => g.id === id)?.name ?? id.slice(0, 8);
  const subjectName = (id: string) => subjects.data?.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  const openYears = years.data?.filter((y) => y.status !== "archived") ?? [];

  const columns: ColumnDef<GradeSubject, unknown>[] = [
    { id: "year", header: t("year"), accessorFn: (m) => yearName(m.academicYearId) },
    { id: "grade", header: t("grade"), accessorFn: (m) => gradeName(m.gradeId) },
    { id: "subject", header: t("subject"), accessorFn: (m) => subjectName(m.subjectId) },
    {
      id: "required",
      header: t("required"),
      accessorFn: (m) => (m.isRequired ? c("yes") : c("no"))
    }
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t("mapping")}</h2>
        <button type="button" className="btn-ghost" onClick={() => void mappings.refetch()}>
          {c("refresh")}
        </button>
      </div>

      <form className="entity-form" onSubmit={onSubmit} noValidate>
        <Field label={t("year")} error={errors.academicYearId?.message}>
          <select {...register("academicYearId")}>
            <option value="">{t("selectYear")}</option>
            {openYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("grade")} error={errors.gradeId?.message}>
          <select {...register("gradeId")}>
            <option value="">{t("selectGrade")}</option>
            {grades.data?.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("subject")} error={errors.subjectId?.message}>
          <select {...register("subjectId")}>
            <option value="">{t("selectSubject")}</option>
            {subjects.data?.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="form-check">
          <input type="checkbox" {...register("isRequired")} />
          {t("required")}
        </label>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? t("creating") : t("assign")}
          </button>
        </div>
      </form>

      {mappings.isLoading ? (
        <p className="muted">{c("loading")}</p>
      ) : mappings.isError ? (
        <p className="error-text">{c("somethingWrong")}</p>
      ) : !mappings.data?.length ? (
        <p className="muted">{c("empty")}</p>
      ) : (
        <DataTable<GradeSubject> columns={columns} data={mappings.data} />
      )}
    </section>
  );
}
