"use client";
import { FormDatePicker, FormInput } from "../../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PdsSelectField } from "../../../../components/pds";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { Toggle } from "../../../../components/shared/toggle";
import { StatusBadge } from "../../../../components/shared/badge";
import { useApiMutation, useReferenceApiQuery } from "../../../lib/api";
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
type CreateYearBody = YearValues & { importStructureFromYearId?: string };
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
  const [deletingYear, setDeletingYear] = useState<AcademicYearOverview | null>(null);
  const [importFromYearId, setImportFromYearId] = useState("");

  const years = useReferenceApiQuery<AcademicYearOverview[]>(SETUP_PATH);
  const activeYear = years.data?.find((year) => year.status === "active");

  const create = useApiMutation<CreateYearBody>(
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

  const deleteYear = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `/tenants/${tenant}/academics/academic-years/${id}`,
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [SETUP_PATH(tenant)] }
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
    setImportFromYearId("");
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
        <RowMoreActionsMenu
          ariaLabel={c("moreActions")}
          items={[
            ...(row.original.status !== "archived"
              ? [
                  {
                    id: "edit",
                    label: c("edit"),
                    icon: "edit",
                    onSelect: () => openEdit(row.original)
                  },
                  {
                    id: "archive",
                    label: c("archive"),
                    icon: "archive",
                    destructive: true,
                    onSelect: () => requestToggle(row.original, false)
                  }
                ]
              : [
                  {
                    id: "restore",
                    label: c("restore"),
                    icon: "restore",
                    onSelect: () => requestToggle(row.original, true)
                  },
                  {
                    id: "delete",
                    label: c("deletePermanently"),
                    icon: "delete_forever",
                    destructive: true,
                    onSelect: () => setDeletingYear(row.original)
                  }
                ])
          ]}
        />
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
        actions={
          <>
            <button type="button" className="pds-type-body-m-bold btn-primary" onClick={openCreate}>
              <Icon name="add" />
              {t("addYear")}
            </button>
          </>
        }
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
      />
      <TablePanelBody
        variant="plain"
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
            await create.mutateAsync({
              ...values,
              importStructureFromYearId: importFromYearId || undefined
            });
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
          <FormDatePicker
            type="day"
            variant="form"
            value={form.watch("startsOn")}
            onValueChange={(next) => form.setValue("startsOn", next, { shouldValidate: true })}
            placeholder={t("starts")}
            ariaLabel={t("starts")}
          />
        </Field>
        <Field label={t("ends")} error={form.formState.errors.endsOn?.message}>
          <FormDatePicker
            type="day"
            variant="form"
            value={form.watch("endsOn")}
            onValueChange={(next) => form.setValue("endsOn", next, { shouldValidate: true })}
            placeholder={t("ends")}
            ariaLabel={t("ends")}
          />
        </Field>
        {formMode?.type === "create" && years.data?.length ? (
          <Field label={t("importStructureLabel")}>
            <PdsSelectField
              value={importFromYearId}
              onValueChange={(value) =>
                setImportFromYearId(typeof value === "string" ? value : "")
              }
              placeholder={t("importStructureNone")}
              options={years.data.map((year) => ({
                value: year.id,
                label: year.name
              }))}
            />
            <p className="pds-type-body-s-regular muted">{t("importStructureHelp")}</p>
          </Field>
        ) : null}
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

      <ConfirmDialog
        open={deletingYear !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingYear(null);
        }}
        title={t("deleteYearTitle")}
        description={t("deleteYearHelp", { name: deletingYear?.name ?? "" })}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteYear.isPending}
        onConfirm={async () => {
          if (!deletingYear) return;
          await deleteYear.mutateAsync({ id: deletingYear.id });
          setDeletingYear(null);
        }}
      />
    </>
  );
}