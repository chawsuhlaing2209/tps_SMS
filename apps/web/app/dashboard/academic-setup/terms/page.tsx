"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { zodResolver } from "../../../lib/zod-resolver";
import { useAcademicYearContext } from "../use-academic-year-context";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";

type Term = {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  updatedAt?: string;
};

type TermValues = { academicYearId: string; name: string; startsOn: string; endsOn: string };
type FormMode = { type: "create" } | { type: "edit"; term: Term };

const TERMS_PATH = (tenant: string) => `/tenants/${tenant}/academics/terms`;

export default function TermsPage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const [formMode, setFormMode] = useState<FormMode | null>(null);

  const currentYear = useCurrentAcademicYear();
  const { contextYearId } = useAcademicYearContext(currentYear.data);
  const terms = useApiQuery<Term[]>(TERMS_PATH);

  const create = useApiMutation<TermValues>(
    (body, tenant) => ({
      path: TERMS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [TERMS_PATH(tenant)] }
  );

  const update = useApiMutation<{ id: string; name: string; startsOn: string; endsOn: string }>(
    (body, tenant) => {
      const { id, ...payload } = body;
      return {
        path: `${TERMS_PATH(tenant)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    { invalidatePaths: (_b, tenant) => [TERMS_PATH(tenant)] }
  );

  const remove = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${TERMS_PATH(tenant)}/${id}`,
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [TERMS_PATH(tenant)] }
  );

  const schema = z.object({
    academicYearId: z.string().uuid(c("required")),
    name: z.string().trim().min(1, c("required")),
    startsOn: z.string().min(1, c("required")),
    endsOn: z.string().min(1, c("required"))
  });

  const form = useForm<TermValues>({
    resolver: zodResolver(schema),
    defaultValues: { academicYearId: "", name: "", startsOn: "", endsOn: "" }
  });

  const openCreate = () => {
    form.reset({
      academicYearId: contextYearId,
      name: "",
      startsOn: "",
      endsOn: ""
    });
    setFormMode({ type: "create" });
  };

  const openEdit = (term: Term) => {
    form.reset({
      academicYearId: term.academicYearId,
      name: term.name,
      startsOn: term.startsOn,
      endsOn: term.endsOn
    });
    setFormMode({ type: "edit", term });
  };

  const yearName = (id: string) =>
    id === contextYearId ? (currentYear.data?.name ?? id.slice(0, 8)) : id.slice(0, 8);
  const visibleTerms =
    terms.data?.filter((term) => !contextYearId || term.academicYearId === contextYearId) ?? [];

  const columns: ColumnDef<Term, unknown>[] = [
    { id: "name", header: c("name"), accessorFn: (term) => term.name },
    { id: "year", header: t("year"), accessorFn: (term) => yearName(term.academicYearId) },
    { id: "starts", header: t("starts"), accessorFn: (term) => term.startsOn },
    { id: "ends", header: t("ends"), accessorFn: (term) => term.endsOn },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="row-action" onClick={() => openEdit(row.original)}>
            {t("edit")}
          </button>
          <button
            type="button"
            className="row-action"
            disabled={remove.isPending}
            onClick={() => void remove.mutateAsync({ id: row.original.id })}
          >
            {c("delete")}
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <TablePanelHead
        title={t("terms")}
        onRefresh={() => void terms.refetch()}
        onAdd={contextYearId ? openCreate : undefined}
        addLabel={t("addTerm")}
      />
      <TablePanelBody
        loading={terms.isLoading || currentYear.isLoading}
        error={terms.isError ? c("somethingWrong") : null}
        empty={!visibleTerms.length}
      >
        <DataTable<Term>
          columns={columns}
          data={visibleTerms}
          onRowClick={(term) => openEdit(term)}
        />
      </TablePanelBody>

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            form.reset();
          }
        }}
        title={formMode?.type === "edit" ? t("editTermTitle") : t("addTerm")}
        onSubmit={form.handleSubmit(async (values) => {
          if (formMode?.type === "edit") {
            await update.mutateAsync({
              id: formMode.term.id,
              name: values.name,
              startsOn: values.startsOn,
              endsOn: values.endsOn
            });
          } else {
            await create.mutateAsync({ ...values, academicYearId: contextYearId });
          }
          setFormMode(null);
          form.reset();
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setFormMode(null)}>
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting
                ? t("creating")
                : formMode?.type === "edit"
                  ? c("save")
                  : t("addTerm")}
            </button>
          </>
        }
      >
        <Field label={t("year")}>
          <input readOnly value={currentYear.data?.name ?? ""} />
        </Field>
        <Field label={c("name")} error={form.formState.errors.name?.message}>
          <input placeholder={t("termNamePlaceholder")} {...form.register("name")} />
        </Field>
        <Field label={t("starts")} error={form.formState.errors.startsOn?.message}>
          <input type="date" {...form.register("startsOn")} />
        </Field>
        <Field label={t("ends")} error={form.formState.errors.endsOn?.message}>
          <input type="date" {...form.register("endsOn")} />
        </Field>
      </RecordFormSheet>
    </>
  );
}