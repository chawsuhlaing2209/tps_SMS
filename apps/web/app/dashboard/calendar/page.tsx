"use client";
import { FormDatePicker, FormInput } from "../../../components/shared/form-input";

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
import { ModulePageHeader } from "../module-page-header";
import { PdsSelectField } from "../../../components/pds";
import { useCurrentAcademicYear } from "../../lib/use-current-academic-year";

type CalendarEvent = {
  id: string;
  title: string;
  eventType: string;
  startsOn: string;
  endsOn: string | null;
  academicYearId: string | null;
  metadata?: { description?: string; isRecurring?: boolean };
  updatedAt?: string;
};

type FormValues = {
  title: string;
  eventType: string;
  startDate: string;
  endDate: string;
  description: string;
  academicYearId: string;
};

type FormMode = { type: "create" } | { type: "edit"; event: CalendarEvent };

const EVENT_TYPES = ["holiday", "exam", "event", "meeting"] as const;

const CALENDAR_PATH = (tenant: string) => `/tenants/${tenant}/calendar`;

export default function CalendarPage() {
  const t = useTranslations("calendar");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["calendar.manage"]);

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [month, setMonth] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const currentYear = useCurrentAcademicYear();
  const workingYearId = currentYear.data?.id ?? "";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (month) params.set("month", `${month}-01`);
    if (typeFilter) params.set("eventType", typeFilter);
    if (workingYearId) params.set("academicYearId", workingYearId);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [month, typeFilter, workingYearId]);

  const events = useApiQuery<CalendarEvent[]>((tn) => `${CALENDAR_PATH(tn)}${queryString}`);

  const create = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: CALENDAR_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [CALENDAR_PATH(tenant)] }
  );

  const update = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenant) => {
      const { id, ...payload } = body;
      return {
        path: `${CALENDAR_PATH(tenant)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    { invalidatePaths: (_b, tenant) => [CALENDAR_PATH(tenant)] }
  );

  const remove = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${CALENDAR_PATH(tenant)}/${id}`,
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [CALENDAR_PATH(tenant)] }
  );

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, requiredMessage),
        eventType: z.string().trim().min(1, requiredMessage),
        startDate: z.string().trim().min(1, requiredMessage),
        endDate: z.string(),
        description: z.string(),
        academicYearId: z.string()
      }),
    [requiredMessage]
  );

  const defaultValues: FormValues = {
    title: "",
    eventType: "event",
    startDate: "",
    endDate: "",
    description: "",
    academicYearId: ""
  };

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  const openCreate = () => {
    form.reset({ ...defaultValues, academicYearId: workingYearId });
    setFormMode({ type: "create" });
  };

  const openEdit = (event: CalendarEvent) => {
    form.reset({
      title: event.title,
      eventType: event.eventType,
      startDate: event.startsOn,
      endDate: event.endsOn ?? "",
      description: event.metadata?.description ?? "",
      academicYearId: event.academicYearId ?? ""
    });
    setFormMode({ type: "edit", event });
  };

  const eventTypeLabel = (type: string) => {
    const key = `type${type.charAt(0).toUpperCase()}${type.slice(1)}` as
      | "typeHoliday"
      | "typeExam"
      | "typeEvent"
      | "typeMeeting";
    if (EVENT_TYPES.includes(type as (typeof EVENT_TYPES)[number])) return t(key);
    return type;
  };

  const columns: ColumnDef<CalendarEvent, unknown>[] = [
    { id: "title", header: t("eventTitle"), accessorKey: "title" },
    {
      id: "eventType",
      header: t("eventType"),
      accessorFn: (row) => eventTypeLabel(row.eventType)
    },
    { id: "startDate", header: t("startDate"), accessorKey: "startsOn" },
    {
      id: "endDate",
      header: t("endDate"),
      accessorFn: (row) => row.endsOn ?? "—"
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) =>
        canManage ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="pds-type-body-s-regular row-action" onClick={() => openEdit(row.original)}>
              {t("edit")}
            </button>
            <button
              type="button"
              className="pds-type-body-s-regular row-action"
              disabled={remove.isPending}
              onClick={() => void remove.mutateAsync({ id: row.original.id })}
            >
              {remove.isPending ? t("deleting") : t("delete")}
            </button>
          </div>
        ) : null
    }
  ];

  return (
    <div className="page-stack">
      <ModulePageHeader navKey="calendar" title={nav("calendar")} />
      <TablePanelHead
          title={t("listTitle")}
          extra={
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label className="form-inline">
                <FormDatePicker
                  type="month"
                  variant="filter"
                  ariaLabel={t("month")}
                  placeholder={t("month")}
                  value={month}
                  onValueChange={setMonth}
                />
              </label>
              <label className="form-inline">
                <span className="pds-type-body-s-regular muted">{t("filterType")}</span>
                <PdsSelectField
                  variant="filter"
                  value={typeFilter}
                  onValueChange={(value) => setTypeFilter(typeof value === "string" ? value : "")}
                  placeholder={t("allTypes")}
                  options={EVENT_TYPES.map((type) => ({
                    value: type,
                    label: eventTypeLabel(type)
                  }))}
                />
              </label>
            </div>
          }
          onRefresh={() => void events.refetch()}
          onAdd={canManage ? openCreate : undefined}
          addLabel={t("addEvent")}
        />
        <TablePanelBody
          loading={events.isLoading}
          error={events.isError ? c("somethingWrong") : null}
          empty={!events.data?.length}
        >
          <DataTable columns={columns} data={events.data ?? []} />
        </TablePanelBody>

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            form.reset(defaultValues);
          }
        }}
        title={formMode?.type === "edit" ? t("editEventTitle") : t("addEventTitle")}
        help={t("help")}
        onSubmit={form.handleSubmit(async (values) => {
          const payload = {
            title: values.title,
            eventType: values.eventType,
            startDate: values.startDate,
            endDate: values.endDate || undefined,
            description: values.description || undefined,
            academicYearId: workingYearId || undefined
          };
          if (formMode?.type === "edit") {
            await update.mutateAsync({ id: formMode.event.id, ...payload });
          } else {
            await create.mutateAsync(payload);
          }
          setFormMode(null);
          form.reset(defaultValues);
        })}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => {
                setFormMode(null);
                form.reset(defaultValues);
              }}
            >
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              <Icon name="check" />
              {form.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("eventTitle")} error={form.formState.errors.title?.message}>
          <FormInput type="text" {...form.register("title")} />
        </Field>
        <Field label={t("eventType")} error={form.formState.errors.eventType?.message}>
          <PdsSelectField
            variant="form"
            value={form.watch("eventType")}
            onValueChange={(value) =>
              form.setValue("eventType", typeof value === "string" ? value : "event", {
                shouldValidate: true
              })
            }
            options={EVENT_TYPES.map((type) => ({
              value: type,
              label: eventTypeLabel(type)
            }))}
          />
        </Field>
        <Field label={t("startDate")} error={form.formState.errors.startDate?.message}>
          <FormInput type="date" {...form.register("startDate")} />
        </Field>
        <Field label={t("endDate")} error={form.formState.errors.endDate?.message}>
          <FormInput type="date" {...form.register("endDate")} />
        </Field>
        <Field label={t("academicYear")}>
          <FormInput readOnly value={currentYear.data?.name ?? ""} />
        </Field>
        <Field label={t("eventDescription")} error={form.formState.errors.description?.message}>
          <textarea rows={3} {...form.register("description")} />
        </Field>
      </RecordFormSheet>
    </div>
  );
}