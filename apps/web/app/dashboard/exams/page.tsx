"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { zodResolver } from "../../lib/zod-resolver";
import { StatusBadge } from "../../../components/shared/badge";
import { useCurrentAcademicYear } from "../../lib/use-current-academic-year";

type ExamCycle = {
  id: string;
  name: string;
  examType: string;
  academicYearId: string;
  status: string;
  updatedAt?: string;
};

type CycleValues = { name: string; examType: string; academicYearId: string };

const CYCLES_PATH = (tenant: string) => `/tenants/${tenant}/exam-cycles`;

export default function ExamCyclesPage() {
  const t = useTranslations("exams");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["exam.manage"]);

  const [open, setOpen] = useState(false);

  const currentYear = useCurrentAcademicYear();
  const workingYearId = currentYear.data?.id ?? "";
  const cycles = useApiQuery<ExamCycle[]>((tn) => (canManage ? CYCLES_PATH(tn) : null));

  const yearName = (id: string) =>
    id === workingYearId ? (currentYear.data?.name ?? id) : id;
  const visibleCycles =
    cycles.data?.filter((cycle) => !workingYearId || cycle.academicYearId === workingYearId) ?? [];

  const create = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: CYCLES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [CYCLES_PATH(tenant)] }
  );

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        examType: z.string().trim().min(1, requiredMessage),
        academicYearId: z.string().uuid(requiredMessage)
      }),
    [requiredMessage]
  );

  const form = useForm<CycleValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", examType: "term", academicYearId: "" }
  });

  const columns: ColumnDef<ExamCycle, unknown>[] = [
    { id: "name", header: t("cycleName"), accessorKey: "name" },
    { id: "examType", header: t("examType"), accessorKey: "examType" },
    { id: "year", header: t("academicYear"), accessorFn: (row) => yearName(row.academicYearId) },
    {
      id: "status",
      header: t("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      )
    }
  ];

  if (!canManage) {
    return <p className="muted">{c("empty")}</p>;
  }

  return (
    <>
      <TablePanelHead
        title={t("cyclesTitle")}
        onRefresh={() => void cycles.refetch()}
        onAdd={
          workingYearId
            ? () => {
                form.reset({ name: "", examType: "term", academicYearId: workingYearId });
                setOpen(true);
              }
            : undefined
        }
        addLabel={t("addCycle")}
      />
      <TablePanelBody
        loading={cycles.isLoading || currentYear.isLoading}
        error={cycles.isError ? c("somethingWrong") : null}
        empty={!visibleCycles.length}
      >
        <DataTable columns={columns} data={visibleCycles} />
      </TablePanelBody>

      <RecordFormSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) form.reset();
        }}
        title={t("addCycleTitle")}
        onSubmit={form.handleSubmit(async (values) => {
          await create.mutateAsync({ ...values, academicYearId: workingYearId });
          setOpen(false);
          form.reset();
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("cycleName")} error={form.formState.errors.name?.message}>
          <input type="text" {...form.register("name")} />
        </Field>
        <Field label={t("examType")} error={form.formState.errors.examType?.message}>
          <select {...form.register("examType")}>
            <option value="term">term</option>
            <option value="midterm">midterm</option>
            <option value="final">final</option>
            <option value="quiz">quiz</option>
          </select>
        </Field>
        <Field label={t("academicYear")}>
          <input readOnly value={currentYear.data?.name ?? ""} />
        </Field>
      </RecordFormSheet>
    </>
  );
}