"use client";
import { FormInput } from "../../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import { zodResolver } from "../../../lib/zod-resolver";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { EmptyState } from "../../../../components/shared/empty-state";
import { ModulePageHeader } from "../../module-page-header";
import { moduleBreadcrumbs } from "../../../lib/page-header-utils";

type GradeRule = {
  id: string;
  name: string;
  academicYearId: string;
  rankingEnabled: boolean;
  updatedAt?: string;
};

type RuleValues = { name: string; academicYearId: string };

const RULES_PATH = (tenant: string) => `/tenants/${tenant}/grade-rules`;

export default function GradeRulesPage() {
  const t = useTranslations("exams");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["grade.approve"]);

  const [open, setOpen] = useState(false);

  const currentYear = useCurrentAcademicYear();
  const workingYearId = currentYear.data?.id ?? "";
  const rules = useApiQuery<GradeRule[]>((tn) => (canManage ? RULES_PATH(tn) : null));

  const yearName = (id: string) =>
    id === workingYearId ? (currentYear.data?.name ?? id) : id;
  const visibleRules =
    rules.data?.filter((rule) => !workingYearId || rule.academicYearId === workingYearId) ?? [];

  const create = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: RULES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant)] }
  );

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        academicYearId: z.string().uuid(requiredMessage)
      }),
    [requiredMessage]
  );

  const form = useForm<RuleValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", academicYearId: "" }
  });

  const columns: ColumnDef<GradeRule, unknown>[] = [
    { id: "name", header: t("ruleName"), accessorKey: "name" },
    { id: "year", header: t("academicYear"), accessorFn: (row) => yearName(row.academicYearId) }
  ];

  if (!canManage) {
    return <EmptyState icon="rule" title={c("empty")} />;
  }

  return (
    <>
      <ModulePageHeader
        navKey="exams"
        title={t("gradeRulesTitle")}
        breadcrumbs={moduleBreadcrumbs("exams", nav, [{ label: t("gradeRules") }])}
      />
      <TablePanelHead
        title={t("gradeRulesTitle")}
        onRefresh={() => void rules.refetch()}
        onAdd={
          workingYearId
            ? () => {
                form.reset({ name: "", academicYearId: workingYearId });
                setOpen(true);
              }
            : undefined
        }
        addLabel={t("addGradeRule")}
      />
      <TablePanelBody
        loading={rules.isLoading || currentYear.isLoading}
        error={rules.isError ? c("somethingWrong") : null}
        empty={!visibleRules.length}
      >
        <DataTable columns={columns} data={visibleRules} />
      </TablePanelBody>

      <RecordFormSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) form.reset();
        }}
        title={t("addGradeRuleTitle")}
        onSubmit={form.handleSubmit(async (values) => {
          await create.mutateAsync({ ...values, academicYearId: workingYearId });
          setOpen(false);
          form.reset();
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("ruleName")} error={form.formState.errors.name?.message}>
          <FormInput type="text" {...form.register("name")} />
        </Field>
        <Field label={t("academicYear")}>
          <FormInput readOnly value={currentYear.data?.name ?? ""} />
        </Field>
      </RecordFormSheet>
    </>
  );
}