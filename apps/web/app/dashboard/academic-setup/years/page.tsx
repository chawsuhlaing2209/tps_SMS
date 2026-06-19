"use client";
import { FormInput } from "../../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { Toggle } from "../../../../components/shared/toggle";
import { StatusBadge } from "../../../../components/shared/badge";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { zodResolver } from "../../../lib/zod-resolver";
import { ModulePageHeader } from "../../module-page-header";
import { moduleBreadcrumbs } from "../../../lib/page-header-utils";

type AcademicYearOverview = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  gradeCount: number;
  classroomCount: number;
  studentCount: number;
  updatedAt?: string;
};

type YearValues = { name: string; startsOn: string; endsOn: string };
type FormMode = { type: "create" } | { type: "edit"; year: AcademicYearOverview };
type ToggleConfirm = {
  year: AcademicYearOverview;
  nextActive: boolean;
};

const SETUP_PATH = (tenant: string) => `/tenants/${tenant}/academics/setup/academic-years`;
const CURRENT_YEAR_PATH = (tenant: string) => `/tenants/${tenant}/dashboard/academic-year`;

const invalidateYearPaths = (tenant: string) => [
  SETUP_PATH(tenant),
  CURRENT_YEAR_PATH(tenant),
  `/tenants/${tenant}/academics/academic-years`
];

export default function AcademicYearsPage() {
  const t = useTranslations("academics");
  const setup = useTranslations("academicSetup");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<ToggleConfirm | null>(null);

  const years = useApiQuery<AcademicYearOverview[]>(SETUP_PATH);
  const activeYear = years.data?.find((year) => year.status === "active");

  const create = useApiMutation<YearValues>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => invalidateYearPaths(tenant) }
  );

  const setActive = useApiMutation<{ id: string; active: boolean }>(
    ({ id, active }, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years/${id}/active`,
      init: { method: "PATCH", body: JSON.stringify({ active }) }
    }),
    { invalidatePaths: (_b, tenant) => invalidateYearPaths(tenant) }
  );

  const update = useApiMutation<YearValues & { id: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years/${body.id}`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ name: body.name, startsOn: body.startsOn, endsOn: body.endsOn })
      }
    }),
    { invalidatePaths: (_b, tenant) => invalidateYearPaths(tenant) }
  );

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    startsOn: z.string().min(1, c("required")),
    endsOn: z.string().min(1, c("required"))
  });

  const form = useForm<YearValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", startsOn: "", endsOn: "" }
  });

  const openCreate = () => {
    form.reset({ name: "", startsOn: "", endsOn: "" });
    setFormMode({ type: "create" });
  };

  const openEdit = (year: AcademicYearOverview) => {
    form.reset({
      name: year.name,
      startsOn: year.startsOn,
      endsOn: year.endsOn
    });
    setFormMode({ type: "edit", year });
  };

  const requestToggle = (year: AcademicYearOverview, nextActive: boolean) => {
    setToggleConfirm({ year, nextActive });
  };

  const columns: ColumnDef<AcademicYearOverview, unknown>[] = [
    {
      id: "name",
      header: t("year"),
      accessorKey: "name",
      cell: ({ row }) => (
        <Link href={`/dashboard/academic-setup/years/${row.original.id}`}>{row.original.name}</Link>
      )
    },
    { id: "starts", header: t("starts"), accessorKey: "startsOn" },
    { id: "ends", header: t("ends"), accessorKey: "endsOn" },
    { id: "grades", header: t("gradeCount"), accessorKey: "gradeCount" },
    { id: "classrooms", header: t("classroomCount"), accessorKey: "classroomCount" },
    { id: "students", header: t("studentCount"), accessorKey: "studentCount" },
    {
      id: "active",
      header: t("yearActive"),
      cell: ({ row }) => {
        const year = row.original;
        const isActive = year.status === "active";

        return (
          <div className="year-active-toggle">
            <Toggle
              checked={isActive}
              disabled={setActive.isPending}
              aria-label={t("toggleYearActive", { name: year.name })}
              onCheckedChange={(checked: boolean) => requestToggle(year, checked)}
            />
            <StatusBadge status={year.status} />
          </div>
        );
      }
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: "8px" }}>
          {row.original.status !== "archived" ? (
            <>
              <button type="button" className="pds-type-body-s-regular row-action" onClick={() => openEdit(row.original)}>
                {t("edit")}
              </button>
              <Link href={`/dashboard/academic-setup/years/${row.original.id}`} className="pds-type-body-s-regular row-action">
                {t("view")}
              </Link>
            </>
          ) : null}
        </div>
      )
    }
  ];

  const confirmTitle = toggleConfirm?.nextActive
    ? t("activateYearTitle")
    : t("deactivateYearTitle");

  const confirmDescription = toggleConfirm?.nextActive
    ? activeYear && activeYear.id !== toggleConfirm.year.id
      ? t("activateYearReplaceBody", {
          year: toggleConfirm.year.name,
          current: activeYear.name
        })
      : t("activateYearBody", { year: toggleConfirm?.year.name ?? "" })
    : t("deactivateYearBody", { year: toggleConfirm?.year.name ?? "" });

  return (
    <>
      <ModulePageHeader
        navKey="academicSetup"
        title={setup("years")}
        breadcrumbs={moduleBreadcrumbs("academicSetup", nav, [{ label: setup("years") }])}
      />
      <TablePanelHead
        banner={
          activeYear ? (
            <>
              {t("workingYear")}: <strong>{activeYear.name}</strong>
            </>
          ) : (
            t("noWorkingYear")
          )
        }
        bannerVariant={activeYear ? "default" : "warning"}
        title={t("years")}
        onRefresh={() => void years.refetch()}
        onAdd={openCreate}
        addLabel={t("addYear")}
      />
      <TablePanelBody
          loading={years.isLoading}
          error={years.isError ? c("somethingWrong") : null}
          empty={!years.data?.length}
        >
          <DataTable
            columns={columns}
            data={years.data ?? []}
            getRowHref={(year) => `/dashboard/academic-setup/years/${year.id}`}
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
        title={formMode?.type === "edit" ? t("editYearTitle") : t("addYearTitle")}
        help={t("yearFormHelp")}
        onSubmit={form.handleSubmit(async (values) => {
          if (formMode?.type === "edit") {
            await update.mutateAsync({ ...values, id: formMode.year.id });
          } else {
            await create.mutateAsync(values);
          }
          setFormMode(null);
          form.reset();
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setFormMode(null)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting
                ? t("creating")
                : formMode?.type === "edit"
                  ? t("saveYear")
                  : t("addYear")}
            </button>
          </>
        }
      >
        <Field label={c("name")} error={form.formState.errors.name?.message}>
          <FormInput placeholder={t("yearNamePlaceholder")} {...form.register("name")} />
        </Field>
        <Field label={t("starts")} error={form.formState.errors.startsOn?.message}>
          <FormInput type="date" {...form.register("startsOn")} />
        </Field>
        <Field label={t("ends")} error={form.formState.errors.endsOn?.message}>
          <FormInput type="date" {...form.register("endsOn")} />
        </Field>
      </RecordFormSheet>

      <ConfirmDialog
        open={toggleConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setToggleConfirm(null);
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={toggleConfirm?.nextActive ? t("activateYearConfirm") : t("deactivateYearConfirm")}
        cancelLabel={c("cancel")}
        loading={setActive.isPending}
        destructive={!toggleConfirm?.nextActive}
        onConfirm={() => {
          if (!toggleConfirm) return;
          void setActive
            .mutateAsync({ id: toggleConfirm.year.id, active: toggleConfirm.nextActive })
            .then(() => setToggleConfirm(null));
        }}
      />
    </>
  );
}