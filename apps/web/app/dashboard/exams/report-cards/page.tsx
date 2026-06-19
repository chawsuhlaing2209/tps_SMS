"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { getSession } from "../../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { PdsSelectField } from "../../../../components/pds";
import { StatusBadge } from "../../../../components/shared/badge";
import { EmptyState } from "../../../../components/shared/empty-state";
import { zodResolver } from "../../../lib/zod-resolver";
import { PageHeader } from "../../page-header-context";

type Classroom = { id: string; name: string; academicYearId: string };
type Student = { id: string; fullName: string };
type StudentList = { data: Student[] };
type Term = { id: string; name: string; academicYearId: string };
type ReportCard = {
  id: string;
  studentId: string;
  studentFullName: string | null;
  classroomId: string;
  academicYearId: string;
  termId: string | null;
  status: string;
  updatedAt?: string;
};

type GenerateValues = { classroomId: string; termId: string };

const REPORT_CARDS_PATH = (tenant: string) => `/tenants/${tenant}/report-cards`;

export default function ReportCardsPage() {
  const t = useTranslations("exams");
  const c = useTranslations("common");
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const reportCardsHref = studentId
    ? `/dashboard/exams/report-cards?studentId=${studentId}`
    : "/dashboard/exams/report-cards";
  const requiredMessage = c("required");
  const permissions = getSession()?.permissions;
  const canGenerate = hasAnyPermission(permissions, ["report_card.generate"]);
  const canApprove = hasAnyPermission(permissions, ["report_card.approve"]);
  const canView = canGenerate || canApprove;

  const [open, setOpen] = useState(false);
  const [classroomFilter, setClassroomFilter] = useState("");

  const classrooms = useApiQuery<Classroom[]>((tn) => `/tenants/${tn}/classrooms`);
  const terms = useApiQuery<Term[]>((tn) => `/tenants/${tn}/academics/terms`);

  const cardsQuery = useMemo(
    () => (classroomFilter ? `?classroomId=${classroomFilter}` : ""),
    [classroomFilter]
  );
  const cards = useApiQuery<ReportCard[]>((tn) =>
    canView ? `${REPORT_CARDS_PATH(tn)}${cardsQuery}` : null
  );

  const studentName = (row: ReportCard) => row.studentFullName ?? row.studentId;
  const classroomName = (id: string) => classrooms.data?.find((x) => x.id === id)?.name ?? id;

  const invalidate = (tenant: string) => [
    `${REPORT_CARDS_PATH(tenant)}${cardsQuery}`,
    REPORT_CARDS_PATH(tenant)
  ];

  const generate = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: `${REPORT_CARDS_PATH(tenant)}/generate`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => invalidate(tenant) }
  );

  const approve = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${REPORT_CARDS_PATH(tenant)}/${id}/approve`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    { invalidatePaths: (_b, tenant) => invalidate(tenant) }
  );

  const publish = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${REPORT_CARDS_PATH(tenant)}/${id}/publish`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    { invalidatePaths: (_b, tenant) => invalidate(tenant) }
  );

  const schema = useMemo(
    () =>
      z.object({
        classroomId: z.string().uuid(requiredMessage),
        termId: z.string()
      }),
    [requiredMessage]
  );

  const form = useForm<GenerateValues>({
    resolver: zodResolver(schema),
    defaultValues: { classroomId: "", termId: "" }
  });

  const columns: ColumnDef<ReportCard, unknown>[] = [
    { id: "student", header: t("name"), accessorFn: (row) => studentName(row) },
    { id: "classroom", header: t("classroom"), accessorFn: (row) => classroomName(row.classroomId) },
    {
      id: "status",
      header: t("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      )
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) =>
        canApprove ? (
          <div style={{ display: "flex", gap: "8px" }}>
            {row.original.status !== "approved" && row.original.status !== "published" ? (
              <button
                type="button"
                className="pds-type-body-s-regular row-action"
                disabled={approve.isPending}
                onClick={() => void approve.mutateAsync({ id: row.original.id })}
              >
                {approve.isPending ? t("approving") : t("approve")}
              </button>
            ) : null}
            {row.original.status !== "published" ? (
              <button
                type="button"
                className="pds-type-body-s-regular row-action"
                disabled={publish.isPending}
                onClick={() => void publish.mutateAsync({ id: row.original.id })}
              >
                {publish.isPending ? t("publishing") : t("publish")}
              </button>
            ) : null}
          </div>
        ) : null
    }
  ];

  if (!canView) {
    return <EmptyState icon="description" title={c("empty")} />;
  }

  return (
    <>
      <PageHeader
        title={t("reportCardsTitle")}
        segment={{ label: t("reportCardsTitle"), href: reportCardsHref }}
      />
      <TablePanelHead
        title={t("reportCardsTitle")}
        extra={
          <label className="form-inline">
            <span className="pds-type-body-s-regular muted">{t("filterClassroom")}</span>
            <PdsSelectField
              variant="filter"
              value={classroomFilter}
              onValueChange={(value) => setClassroomFilter(typeof value === "string" ? value : "")}
              placeholder={t("allClassrooms")}
              options={
                classrooms.data?.map((cl) => ({ value: cl.id, label: cl.name })) ?? []
              }
            />
          </label>
        }
        onRefresh={() => void cards.refetch()}
        onAdd={canGenerate ? () => {
          form.reset({ classroomId: "", termId: "" });
          setOpen(true);
        } : undefined}
        addLabel={t("generate")}
      />
      <TablePanelBody
        loading={cards.isLoading}
        error={cards.isError ? c("somethingWrong") : null}
        empty={!cards.data?.length}
      >
        <DataTable columns={columns} data={cards.data ?? []} />
      </TablePanelBody>

      <RecordFormSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) form.reset();
        }}
        title={t("generateTitle")}
        onSubmit={form.handleSubmit(async (values) => {
          const classroom = classrooms.data?.find((cl) => cl.id === values.classroomId);
          if (!classroom) return;
          await generate.mutateAsync({
            classroomId: values.classroomId,
            academicYearId: classroom.academicYearId,
            termId: values.termId || undefined
          });
          setOpen(false);
          form.reset();
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="bolt" />
              {form.formState.isSubmitting ? t("creating") : t("generate")}
            </button>
          </>
        }
      >
        <Field label={t("classroom")} error={form.formState.errors.classroomId?.message}>
          <PdsSelectField
            variant="form"
            value={form.watch("classroomId")}
            onValueChange={(value) =>
              form.setValue("classroomId", typeof value === "string" ? value : "", {
                shouldValidate: true
              })
            }
            placeholder={t("selectClassroom")}
            options={classrooms.data?.map((cl) => ({ value: cl.id, label: cl.name })) ?? []}
          />
        </Field>
        <Field label={t("term")} error={form.formState.errors.termId?.message}>
          <PdsSelectField
            variant="form"
            value={form.watch("termId")}
            onValueChange={(value) =>
              form.setValue("termId", typeof value === "string" ? value : "", {
                shouldValidate: true
              })
            }
            placeholder={t("selectTerm")}
            options={terms.data?.map((term) => ({ value: term.id, label: term.name })) ?? []}
          />
        </Field>
      </RecordFormSheet>
    </>
  );
}