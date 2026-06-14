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
type Term = {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
};

type TermValues = { academicYearId: string; name: string; startsOn: string; endsOn: string };

export default function TermsPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");

  const years = useApiQuery<AcademicYear[]>((tenant) => `/tenants/${tenant}/academics/academic-years`);
  const terms = useApiQuery<Term[]>((tenant) => `/tenants/${tenant}/academics/terms`);

  const create = useApiMutation<TermValues>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/academics/terms`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/academics/terms`] }
  );

  const schema = z.object({
    academicYearId: z.string().uuid(c("required")),
    name: z.string().trim().min(1, c("required")),
    startsOn: z.string().min(1, c("required")),
    endsOn: z.string().min(1, c("required"))
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<TermValues>({
    resolver: zodResolver(schema),
    defaultValues: { academicYearId: "", name: "", startsOn: "", endsOn: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    await create.mutateAsync(values);
    reset();
  });

  const yearName = (id: string) => years.data?.find((y) => y.id === id)?.name ?? id.slice(0, 8);
  const openYears = years.data?.filter((y) => y.status !== "archived") ?? [];

  const columns: ColumnDef<Term, unknown>[] = [
    { id: "name", header: c("name"), accessorFn: (term) => term.name },
    { id: "year", header: t("year"), accessorFn: (term) => yearName(term.academicYearId) },
    { id: "starts", header: t("starts"), accessorFn: (term) => term.startsOn },
    { id: "ends", header: t("ends"), accessorFn: (term) => term.endsOn },
    {
      id: "status",
      header: c("status"),
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    }
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t("terms")}</h2>
        <button type="button" className="btn-ghost" onClick={() => void terms.refetch()}>
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
        <Field label={c("name")} error={errors.name?.message}>
          <input placeholder={t("termNamePlaceholder")} {...register("name")} />
        </Field>
        <Field label={t("starts")} error={errors.startsOn?.message}>
          <input type="date" {...register("startsOn")} />
        </Field>
        <Field label={t("ends")} error={errors.endsOn?.message}>
          <input type="date" {...register("endsOn")} />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? t("creating") : t("addTerm")}
          </button>
        </div>
      </form>

      {terms.isLoading ? (
        <p className="muted">{c("loading")}</p>
      ) : terms.isError ? (
        <p className="error-text">{c("somethingWrong")}</p>
      ) : !terms.data?.length ? (
        <p className="muted">{c("empty")}</p>
      ) : (
        <DataTable<Term> columns={columns} data={terms.data} />
      )}
    </section>
  );
}
