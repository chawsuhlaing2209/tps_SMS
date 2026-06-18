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
import { useAcademicYearContext } from "../academic-setup/use-academic-year-context";
import { useCurrentAcademicYear } from "../../lib/use-current-academic-year";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../../../components/ui/table";
type Classroom = { id: string; name: string; status: string };
type Subject = { id: string; name: string; code: string | null };
type Staff = { id: string; fullName: string };
type Period = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  updatedAt?: string;
};
type Slot = {
  id: string;
  classroomId: string;
  subjectId: string;
  subjectName: string | null;
  teacherStaffId: string;
  periodId: string;
  room: string | null;
  dayOfWeek: number;
  publishedAt: string | null;
  updatedAt?: string;
};

type PeriodValues = { name: string; startTime: string; endTime: string; sortOrder: string };
type SlotValues = {
  classroomId: string;
  subjectId: string;
  staffId: string;
  periodId: string;
  dayOfWeek: string;
  roomLabel: string;
};

const PERIODS_PATH = (tenant: string) => `/tenants/${tenant}/timetable/periods`;
const SLOTS_PATH = (tenant: string) => `/tenants/${tenant}/timetable/slots`;
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export default function TimetablePage() {
  const t = useTranslations("timetable");
  const c = useTranslations("common");
  const requiredMessage = c("required");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["timetable.manage"]);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [classroomFilter, setClassroomFilter] = useState("");

  const currentYear = useCurrentAcademicYear();
  const { contextYearId } = useAcademicYearContext(currentYear.data);
  const classrooms = useApiQuery<Classroom[]>((tn) => `/tenants/${tn}/classrooms`);
  const subjects = useApiQuery<Subject[]>((tn) => `/tenants/${tn}/academics/subjects`);
  const staff = useApiQuery<Staff[]>((tn) => `/tenants/${tn}/hr/staff`);
  const periods = useApiQuery<Period[]>(PERIODS_PATH);

  const slotsQuery = useMemo(
    () => (classroomFilter ? `?classroomId=${classroomFilter}` : ""),
    [classroomFilter]
  );
  const slots = useApiQuery<Slot[]>((tn) => `${SLOTS_PATH(tn)}${slotsQuery}`);

  const dayLabel = (day: number) =>
    t(`day${day}` as "day1" | "day2" | "day3" | "day4" | "day5" | "day6" | "day7");
  const classroomName = (id: string) => classrooms.data?.find((cl) => cl.id === id)?.name ?? id;
  const staffName = (id: string) => staff.data?.find((s) => s.id === id)?.fullName ?? id;
  const periodName = (id: string) => periods.data?.find((p) => p.id === id)?.name ?? id;

  const createPeriod = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: PERIODS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [PERIODS_PATH(tenant)] }
  );

  const createSlot = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: SLOTS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [SLOTS_PATH(tenant)] }
  );

  const deleteSlot = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${SLOTS_PATH(tenant)}/${id}`,
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [SLOTS_PATH(tenant)] }
  );

  const publish = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/timetable/publish`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [SLOTS_PATH(tenant)] }
  );

  const periodSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        startTime: z.string().trim().min(1, requiredMessage),
        endTime: z.string().trim().min(1, requiredMessage),
        sortOrder: z.string()
      }),
    [requiredMessage]
  );

  const slotSchema = useMemo(
    () =>
      z.object({
        classroomId: z.string().uuid(requiredMessage),
        subjectId: z.string().uuid(requiredMessage),
        staffId: z.string().uuid(requiredMessage),
        periodId: z.string().uuid(requiredMessage),
        dayOfWeek: z.string().min(1, requiredMessage),
        roomLabel: z.string()
      }),
    [requiredMessage]
  );

  const periodForm = useForm<PeriodValues>({
    resolver: zodResolver(periodSchema),
    defaultValues: { name: "", startTime: "", endTime: "", sortOrder: "0" }
  });

  const slotForm = useForm<SlotValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      classroomId: "",
      subjectId: "",
      staffId: "",
      periodId: "",
      dayOfWeek: "1",
      roomLabel: ""
    }
  });

  const periodColumns: ColumnDef<Period, unknown>[] = [
    { id: "name", header: t("periodName"), accessorKey: "name" },
    { id: "start", header: t("startTime"), accessorKey: "startsAt" },
    { id: "end", header: t("endTime"), accessorKey: "endsAt" },
    { id: "order", header: t("sortOrder"), accessorKey: "sortOrder" }
  ];

  const gridPeriods = useMemo(
    () => [...(periods.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [periods.data]
  );

  const gridSlots = useMemo(() => {
    const rows = slots.data ?? [];
    const filtered = classroomFilter
      ? rows.filter((slot) => slot.classroomId === classroomFilter)
      : rows;
    const map = new Map<string, Slot>();
    for (const slot of filtered) {
      map.set(`${slot.dayOfWeek}:${slot.periodId}`, slot);
    }
    return map;
  }, [classroomFilter, slots.data]);

  const slotColumns: ColumnDef<Slot, unknown>[] = [
    { id: "day", header: t("dayOfWeek"), accessorFn: (row) => dayLabel(row.dayOfWeek) },
    { id: "period", header: t("period"), accessorFn: (row) => periodName(row.periodId) },
    { id: "classroom", header: t("classroom"), accessorFn: (row) => classroomName(row.classroomId) },
    { id: "subject", header: t("subject"), accessorFn: (row) => row.subjectName ?? row.subjectId },
    { id: "teacher", header: t("teacher"), accessorFn: (row) => staffName(row.teacherStaffId) },
    { id: "room", header: t("room"), accessorFn: (row) => row.room ?? "—" },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) =>
        canManage ? (
          <button
            type="button"
            className="row-action"
            disabled={deleteSlot.isPending}
            onClick={() => void deleteSlot.mutateAsync({ id: row.original.id })}
          >
            {deleteSlot.isPending ? t("deleting") : t("delete")}
          </button>
        ) : null
    }
  ];

  return (
    <div className="page-stack">
      {classroomFilter ? (
        <section className="timetable-grid-panel">
          <div className="timetable-grid-panel__head">
            <h2>{t("weeklyGrid")}</h2>
            <p className="muted">{classroomName(classroomFilter)}</p>
          </div>
          {!gridPeriods.length ? (
            <p className="muted">{t("noPeriods")}</p>
          ) : (
            <div className="timetable-grid-wrap">
              <Table className="timetable-grid">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("period")}</TableHead>
                    {DAYS.map((day) => (
                      <TableHead key={day}>{dayLabel(day)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gridPeriods.map((period) => (
                    <TableRow key={period.id}>
                      <TableHead scope="row">
                        <span>{period.name}</span>
                        <span className="muted timetable-grid__time">
                          {period.startsAt}–{period.endsAt}
                        </span>
                      </TableHead>
                      {DAYS.map((day) => {
                        const slot = gridSlots.get(`${day}:${period.id}`);
                        return (
                          <TableCell key={`${day}-${period.id}`} className={slot ? "timetable-grid__slot" : undefined}>
                            {slot ? (
                              <>
                                <strong>{slot.subjectName ?? slot.subjectId}</strong>
                                <span className="muted">{staffName(slot.teacherStaffId)}</span>
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : null}

      <TablePanelHead
        title={t("periodsTitle")}
        onRefresh={() => void periods.refetch()}
        onAdd={canManage ? () => setPeriodOpen(true) : undefined}
        addLabel={t("addPeriod")}
      />
      <TablePanelBody
        loading={periods.isLoading}
        error={periods.isError ? c("somethingWrong") : null}
        empty={!periods.data?.length}
      >
        <DataTable columns={periodColumns} data={periods.data ?? []} />
      </TablePanelBody>

      <TablePanelHead
          title={t("slotsTitle")}
          help={t("help")}
          extra={
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label className="form-inline">
                <span className="muted">{t("filterClassroom")}</span>
                <select
                  value={classroomFilter}
                  onChange={(e) => setClassroomFilter(e.target.value)}
                >
                  <option value="">{t("allClassrooms")}</option>
                  {classrooms.data?.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </label>
              {canManage ? (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={publish.isPending}
                  onClick={() =>
                    void publish.mutateAsync(
                      contextYearId ? { academicYearId: contextYearId } : {}
                    )
                  }
                >
                  <Icon name="publish" />
                  {publish.isPending ? t("publishing") : t("publish")}
                </button>
              ) : null}
            </div>
          }
          onRefresh={() => void slots.refetch()}
          onAdd={canManage ? () => setSlotOpen(true) : undefined}
          addLabel={t("addSlot")}
        />
        <TablePanelBody
          loading={slots.isLoading}
          error={slots.isError ? c("somethingWrong") : null}
          empty={!slots.data?.length}
        >
          <DataTable columns={slotColumns} data={slots.data ?? []} />
        </TablePanelBody>

      <RecordFormSheet
        open={periodOpen}
        onOpenChange={(open) => {
          setPeriodOpen(open);
          if (!open) periodForm.reset();
        }}
        title={t("addPeriodTitle")}
        onSubmit={periodForm.handleSubmit(async (values) => {
          await createPeriod.mutateAsync({
            name: values.name,
            startTime: values.startTime,
            endTime: values.endTime,
            sortOrder: Number(values.sortOrder) || 0,
            academicYearId: contextYearId || undefined
          });
          setPeriodOpen(false);
          periodForm.reset();
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setPeriodOpen(false)}>
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={periodForm.formState.isSubmitting}
            >
              <Icon name="check" />
              {periodForm.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("periodName")} error={periodForm.formState.errors.name?.message}>
          <input type="text" {...periodForm.register("name")} />
        </Field>
        <Field label={t("startTime")} error={periodForm.formState.errors.startTime?.message}>
          <input type="time" {...periodForm.register("startTime")} />
        </Field>
        <Field label={t("endTime")} error={periodForm.formState.errors.endTime?.message}>
          <input type="time" {...periodForm.register("endTime")} />
        </Field>
        <Field label={t("sortOrder")} error={periodForm.formState.errors.sortOrder?.message}>
          <input type="number" min={0} {...periodForm.register("sortOrder")} />
        </Field>
      </RecordFormSheet>

      <RecordFormSheet
        open={slotOpen}
        onOpenChange={(open) => {
          setSlotOpen(open);
          if (!open) slotForm.reset();
        }}
        title={t("addSlotTitle")}
        help={periods.data?.length ? undefined : t("noPeriods")}
        onSubmit={slotForm.handleSubmit(async (values) => {
          await createSlot.mutateAsync({
            classroomId: values.classroomId,
            subjectId: values.subjectId,
            staffId: values.staffId,
            periodId: values.periodId,
            dayOfWeek: Number(values.dayOfWeek),
            roomLabel: values.roomLabel || undefined,
            academicYearId: contextYearId || undefined
          });
          setSlotOpen(false);
          slotForm.reset();
        })}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setSlotOpen(false)}>
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={slotForm.formState.isSubmitting || !periods.data?.length}
            >
              <Icon name="check" />
              {slotForm.formState.isSubmitting ? t("creating") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("dayOfWeek")} error={slotForm.formState.errors.dayOfWeek?.message}>
          <select {...slotForm.register("dayOfWeek")}>
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {dayLabel(day)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("period")} error={slotForm.formState.errors.periodId?.message}>
          <select {...slotForm.register("periodId")}>
            <option value="">{t("selectPeriod")}</option>
            {periods.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("classroom")} error={slotForm.formState.errors.classroomId?.message}>
          <select {...slotForm.register("classroomId")}>
            <option value="">{t("selectClassroom")}</option>
            {classrooms.data?.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("subject")} error={slotForm.formState.errors.subjectId?.message}>
          <select {...slotForm.register("subjectId")}>
            <option value="">{t("selectSubject")}</option>
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("teacher")} error={slotForm.formState.errors.staffId?.message}>
          <select {...slotForm.register("staffId")}>
            <option value="">{t("selectTeacher")}</option>
            {staff.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("room")} error={slotForm.formState.errors.roomLabel?.message}>
          <input type="text" {...slotForm.register("roomLabel")} />
        </Field>
      </RecordFormSheet>
    </div>
  );
}