"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { zodResolver } from "../../../lib/zod-resolver";

type AcademicYear = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
};

type YearValues = { name: string; startsOn: string; endsOn: string };

export default function AcademicYearsPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");

  const years = useApiQuery<AcademicYear[]>((tenant) => `/tenants/${tenant}/academics/academic-years`);

  const create = useApiMutation<YearValues>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/academics/academic-years`] }
  );

  const close = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years/${id}/close`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/academics/academic-years`] }
  );

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    startsOn: z.string().min(1, c("required")),
    endsOn: z.string().min(1, c("required"))
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<YearValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", startsOn: "", endsOn: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    await create.mutateAsync(values);
    reset();
  });

  const columns: ColumnDef<AcademicYear, unknown>[] = [
    { id: "name", header: c("name"), accessorFn: (y) => y.name },
    { id: "starts", header: t("starts"), accessorFn: (y) => y.startsOn },
    { id: "ends", header: t("ends"), accessorFn: (y) => y.endsOn },
    {
      id: "status",
      header: c("status"),
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) =>
        row.original.status === "archived" ? (
          <span className="muted">—</span>
        ) : (
          <button
            type="button"
            className="row-action"
            disabled={close.isPending}
            onClick={() => void close.mutateAsync({ id: row.original.id })}
          >
            {close.isPending ? t("closing") : t("close")}
          </button>
        )
    }
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t("years")}</h2>
        <button type="button" className="btn-ghost" onClick={() => void years.refetch()}>
          {c("refresh")}
        </button>
      </div>

      <form className="entity-form" onSubmit={onSubmit} noValidate>
        <Field label={c("name")} error={errors.name?.message}>
          <input placeholder={t("yearNamePlaceholder")} {...register("name")} />
        </Field>
        <Field label={t("starts")} error={errors.startsOn?.message}>
          <input type="date" {...register("startsOn")} />
        </Field>
        <Field label={t("ends")} error={errors.endsOn?.message}>
          <input type="date" {...register("endsOn")} />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? t("creating") : t("addYear")}
          </button>
        </div>
      </form>

      {years.isLoading ? (
        <p className="muted">{c("loading")}</p>
      ) : years.isError ? (
        <p className="error-text">{c("somethingWrong")}</p>
      ) : !years.data?.length ? (
        <p className="muted">{c("empty")}</p>
      ) : (
        <DataTable<AcademicYear> columns={columns} data={years.data} />
      )}
    </section>
  );
}
