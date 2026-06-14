"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { type ColumnDef } from "@tanstack/react-table";
import { type UseQueryResult } from "@tanstack/react-query";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { zodResolver } from "../../lib/zod-resolver";

/**
 * Read + create for a single academics master-data resource (grades, sections,
 * subjects, ...). Reads via TanStack Query; creating invalidates the list.
 */
export function useAcademicResource<T>(resource: string) {
  const path = (tenantId: string) => `/tenants/${tenantId}/academics/${resource}`;
  const query = useApiQuery<T[]>(path);
  const create = useApiMutation<{ name: string }>(
    (body, tenantId) => ({
      path: path(tenantId),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_body, tenantId) => [path(tenantId)] }
  );
  return { query, create };
}

type QuickAddValues = { value: string };

export function QuickAdd({
  label,
  placeholder,
  onSubmit
}: {
  label: string;
  placeholder: string;
  onSubmit: (value: string) => Promise<void>;
}) {
  const t = useTranslations("common");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = z.object({ value: z.string().trim().min(1, t("required")) });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<QuickAddValues>({
    resolver: zodResolver(schema),
    defaultValues: { value: "" }
  });

  const submit = handleSubmit(async ({ value }) => {
    setSubmitError(null);
    try {
      await onSubmit(value);
      reset();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("failedToAdd"));
    }
  });

  return (
    <form className="quick-add" onSubmit={submit} noValidate>
      <input placeholder={placeholder} aria-label={label} {...register("value")} />
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? t("adding") : t("add")}
      </button>
      {errors.value ? <span className="error-text">{errors.value.message}</span> : null}
      {submitError ? <span className="error-text">{submitError}</span> : null}
    </form>
  );
}

export function ListBody({
  loading,
  error,
  empty,
  columns,
  rows
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  columns: string[];
  rows: string[][];
}) {
  const t = useTranslations("common");

  if (loading) {
    return <p className="muted">{t("loading")}</p>;
  }
  if (error) {
    return <p className="error-text">{error}</p>;
  }
  if (empty) {
    return <p className="muted">{t("empty")}</p>;
  }

  const columnDefs: ColumnDef<string[], unknown>[] = columns.map((header, index) => ({
    id: String(index),
    header,
    accessorFn: (row) => row[index] ?? ""
  }));

  return <DataTable<string[]> columns={columnDefs} data={rows} />;
}

/**
 * Standard list panel for an academics resource: header with refresh, optional
 * quick-add form, and a table mapped from the query data.
 */
export function ResourcePanel<T>({
  title,
  query,
  columns,
  toRow,
  quickAdd
}: {
  title: string;
  query: UseQueryResult<T[]>;
  columns: string[];
  toRow: (item: T) => string[];
  quickAdd?: { label: string; placeholder: string; onSubmit: (value: string) => Promise<void> };
}) {
  const c = useTranslations("common");
  const error = query.isError
    ? query.error instanceof Error
      ? query.error.message
      : c("somethingWrong")
    : null;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        <button type="button" className="btn-ghost" onClick={() => void query.refetch()}>
          {c("refresh")}
        </button>
      </div>
      {quickAdd ? <QuickAdd {...quickAdd} /> : null}
      <ListBody
        loading={query.isLoading}
        error={error}
        empty={!query.data?.length}
        columns={columns}
        rows={query.data?.map(toRow) ?? []}
      />
    </section>
  );
}
