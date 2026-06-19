"use client";

import type { SchoolScheduleSettings } from "@sms/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, SubjectChip, SubjectChipGroup } from "../../../components/pds";
import type { PdsSubjectColorKey } from "../../../components/pds/palettes";
import { PdsSelectField } from "../../../components/pds";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { EmptyState } from "../../../components/shared/empty-state";
import { StatCard, StatGrid } from "../../../components/shared/stat-card";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { toastSuccess } from "../../lib/toast";
import { useCurrentAcademicYear } from "../../lib/use-current-academic-year";
import { zodResolver } from "../../lib/zod-resolver";
import { ModulePageHeader } from "../module-page-header";
import { TimetablePeriodModal } from "./_components/timetable-period-modal";

type GradeOverview = {
  id: string;
  name: string;
  classroomCount: number;
  subjectCount: number;
  subjects: Array<{ id: string; name: string; code: string | null }>;
};

type ClassroomRow = {
  id: string;
  name: string;
  gradeId: string;
  gradeName: string;
};

type PeriodRow = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  periodType: string;
  isBreak: boolean;
};

type SlotRow = {
  id: string;
  classroomId: string;
  subjectId: string;
  teacherStaffId: string | null;
  periodId: string;
  dayOfWeek: number;
  subjectName: string | null;
  subjectColorKey: string | null;
  subjectIconKey?: string | null;
  teacherFullName: string | null;
  periodName: string | null;
  periodStartsAt: string | null;
  periodEndsAt: string | null;
};

type NoTeacherDialogState =
  | {
      subjectId: string;
      subjectName: string;
      pendingSubmit?: SlotFormValues;
    }
  | null;

type SlotFormValues = { subjectId: string; staffId: string };

type SlotSheetContext = {
  periodId: string;
  dayOfWeek: number;
  slotId?: string;
};

type OverviewResponse = {
  classroom: { id: string; name: string; gradeId: string };
  workingDays: number[];
  stats: {
    periodsPerWeek: number;
    subjects: number;
    teachers: number;
    freePeriods: number;
  };
  periods: PeriodRow[];
  slots: SlotRow[];
};

type RoomDetailSubject = {
  subjectId: string;
  subjectName: string;
  subjectColorKey?: string | null;
  teacherStaffId: string | null;
  teacherName: string | null;
};

type RoomDetail = {
  subjects: RoomDetailSubject[];
};

const overviewPath = (tenant: string, classroomId: string, yearId: string) =>
  `/tenants/${tenant}/timetable/classrooms/${classroomId}/overview?academicYearId=${encodeURIComponent(yearId)}`;

const gradesPath = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`;

const classroomsPath = (tenant: string, yearId: string, gradeId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${gradeId}/classrooms`;

const schoolSchedulePath = (tenant: string) => `/tenants/${tenant}/settings/school-schedule`;

const timetableInvalidate = (tenant: string) => [
  `/tenants/${tenant}/timetable`,
  `/tenants/${tenant}/classrooms`
];

const DEFAULT_COLOR: PdsSubjectColorKey = "blue";

function normalizeColorKey(value: string | null | undefined): PdsSubjectColorKey {
  const allowed: PdsSubjectColorKey[] = [
    "azure",
    "pomegranate",
    "purple",
    "yellow",
    "green",
    "pink",
    "cyan",
    "blue"
  ];
  if (value && allowed.includes(value as PdsSubjectColorKey)) {
    return value as PdsSubjectColorKey;
  }
  return DEFAULT_COLOR;
}

export function TimetableWorkspace() {
  const t = useTranslations("timetable");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["timetable.manage"]);

  const currentYear = useCurrentAcademicYear();
  const yearId = currentYear.data?.id ?? "";

  const [gradeId, setGradeId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [isEditingTimetable, setIsEditingTimetable] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(null);
  const [slotSheet, setSlotSheet] = useState<SlotSheetContext | null>(null);
  const [noTeacherDialog, setNoTeacherDialog] = useState<NoTeacherDialogState>(null);

  const grades = useApiQuery<GradeOverview[]>((tenant) =>
    yearId ? gradesPath(tenant, yearId) : null
  );

  const classrooms = useApiQuery<ClassroomRow[]>((tenant) =>
    yearId && gradeId ? classroomsPath(tenant, yearId, gradeId) : null
  );

  const resolvedGradeId = gradeId || grades.data?.[0]?.id || "";
  const resolvedClassroomId = classroomId || classrooms.data?.[0]?.id || "";

  const roomDetail = useApiQuery<RoomDetail>((tenant) =>
    resolvedClassroomId ? `/tenants/${tenant}/classrooms/${resolvedClassroomId}/room-detail` : null
  );

  const overviewQuery = useApiQuery<OverviewResponse>((tenant) =>
    yearId && resolvedClassroomId
      ? overviewPath(tenant, resolvedClassroomId, yearId)
      : null
  );

  const schoolSettings = useApiQuery<SchoolScheduleSettings>((tenant) => schoolSchedulePath(tenant));

  useEffect(() => {
    const firstGrade = grades.data?.[0];
    if (!gradeId && firstGrade) {
      setGradeId(firstGrade.id);
    }
  }, [gradeId, grades.data]);

  useEffect(() => {
    const firstRoom = classrooms.data?.[0];
    if (!classroomId && firstRoom) {
      setClassroomId(firstRoom.id);
    }
  }, [classroomId, classrooms.data]);

  useEffect(() => {
    setIsEditingTimetable(false);
    setSlotSheet(null);
    setSelectedSlot(null);
  }, [resolvedClassroomId, resolvedGradeId]);

  const activeGrade = grades.data?.find((grade) => grade.id === resolvedGradeId);
  const activeClassroom = classrooms.data?.find((room) => room.id === resolvedClassroomId);

  const createSlot = useApiMutation<
    {
      classroomId: string;
      subjectId: string;
      staffId?: string;
      periodId: string;
      dayOfWeek: number;
    },
    unknown
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/timetable/slots`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_body, tenant) => timetableInvalidate(tenant)
    }
  );

  const updateSlot = useApiMutation<
    { slotId: string; subjectId: string; staffId?: string },
    unknown
  >(
    ({ slotId, ...body }, tenant) => ({
      path: `/tenants/${tenant}/timetable/slots/${slotId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_body, tenant) => timetableInvalidate(tenant)
    }
  );

  const deleteSlot = useApiMutation<{ slotId: string }, unknown>(
    ({ slotId }, tenant) => ({
      path: `/tenants/${tenant}/timetable/slots/${slotId}`,
      init: { method: "DELETE" }
    }),
    {
      invalidatePaths: (_body, tenant) => timetableInvalidate(tenant)
    }
  );

  const generatePeriods = useApiMutation<
    { academicYearId: string; replaceExisting?: boolean },
    { generated: number }
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/timetable/periods/generate`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      showSuccessToast: false,
      invalidatePaths: (_body, tenant) => timetableInvalidate(tenant)
    }
  );

  const slotSchema = useMemo(
    () =>
      z.object({
        subjectId: z.string().uuid(c("required")),
        staffId: z.string()
      }),
    [c]
  );

  const slotForm = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: { subjectId: "", staffId: "" }
  });

  const workingDays = overviewQuery.data?.workingDays ?? [1, 2, 3, 4, 5];
  const periods = overviewQuery.data?.periods ?? [];
  const slots = overviewQuery.data?.slots ?? [];
  const stats = overviewQuery.data?.stats;

  const slotMap = useMemo(() => {
    const map = new Map<string, SlotRow>();
    for (const slot of slots) {
      map.set(`${slot.dayOfWeek}:${slot.periodId}`, slot);
    }
    return map;
  }, [slots]);

  const legendSubjects = useMemo(() => {
    const fromGrade = activeGrade?.subjects ?? [];
    const fromRoom = roomDetail.data?.subjects ?? [];
    const merged = new Map<string, { name: string; colorKey: PdsSubjectColorKey }>();
    for (const subject of fromGrade) {
      merged.set(subject.id, { name: subject.name, colorKey: DEFAULT_COLOR });
    }
    for (const subject of fromRoom) {
      merged.set(subject.subjectId, {
        name: subject.subjectName,
        colorKey: normalizeColorKey(subject.subjectColorKey)
      });
    }
    return [...merged.entries()].map(([id, value]) => ({ id, ...value }));
  }, [activeGrade?.subjects, roomDetail.data?.subjects]);

  const pageTitle =
    activeGrade && activeClassroom
      ? t("roomTitle", { grade: activeGrade.name, room: activeClassroom.name })
      : nav("timetable");

  const dayLabel = (day: number) => t(`day${day}` as "day1");

  const activeSheetPeriod = useMemo(
    () => periods.find((period) => period.id === slotSheet?.periodId) ?? null,
    [periods, slotSheet?.periodId]
  );

  const canGeneratePeriods = (schoolSettings.data?.operatingHourBlocks?.length ?? 0) > 0;

  const teacherOptions = useMemo(() => {
    const rows = roomDetail.data?.subjects ?? [];
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const row of rows) {
      if (!row.teacherStaffId || seen.has(row.teacherStaffId)) {
        continue;
      }
      seen.add(row.teacherStaffId);
      options.push({
        value: row.teacherStaffId,
        label: row.teacherName ?? row.teacherStaffId
      });
    }
    return options;
  }, [roomDetail.data?.subjects]);

  function subjectNameFor(subjectId: string) {
    return (
      roomDetail.data?.subjects.find((row) => row.subjectId === subjectId)?.subjectName ??
      activeGrade?.subjects.find((row) => row.id === subjectId)?.name ??
      subjectId
    );
  }

  async function persistSlot(values: SlotFormValues) {
    if (!slotSheet || !resolvedClassroomId) {
      return;
    }
    const staffId = values.staffId?.trim() ? values.staffId : undefined;
    if (slotSheet.slotId) {
      await updateSlot.mutateAsync({
        slotId: slotSheet.slotId,
        subjectId: values.subjectId,
        staffId
      });
      toastSuccess(t("slotUpdated"));
    } else {
      await createSlot.mutateAsync({
        classroomId: resolvedClassroomId,
        subjectId: values.subjectId,
        staffId,
        periodId: slotSheet.periodId,
        dayOfWeek: slotSheet.dayOfWeek
      });
      toastSuccess(t("slotSaved"));
    }
    setSlotSheet(null);
    setNoTeacherDialog(null);
  }

  function openSlotSheet(context: SlotSheetContext, values?: SlotFormValues) {
    slotForm.reset(values ?? { subjectId: "", staffId: "" });
    setNoTeacherDialog(null);
    setSlotSheet(context);
  }

  function handleSubjectChange(subjectId: string) {
    if (!subjectId) {
      slotForm.setValue("subjectId", "", { shouldValidate: true });
      slotForm.setValue("staffId", "", { shouldValidate: true });
      return;
    }

    const match = roomDetail.data?.subjects.find((row) => row.subjectId === subjectId);
    if (match?.teacherStaffId) {
      slotForm.setValue("subjectId", subjectId, { shouldValidate: true });
      slotForm.setValue("staffId", match.teacherStaffId, { shouldValidate: true });
      return;
    }

    setNoTeacherDialog({
      subjectId,
      subjectName: subjectNameFor(subjectId)
    });
  }

  function handleNoTeacherDialogOpenChange(open: boolean) {
    if (open) {
      return;
    }
    if (noTeacherDialog?.pendingSubmit) {
      setNoTeacherDialog(null);
      return;
    }
    setNoTeacherDialog(null);
    setSlotSheet(null);
  }

  async function handleContinueWithoutTeacher() {
    if (!noTeacherDialog) {
      return;
    }
    const dialog = noTeacherDialog;
    const values: SlotFormValues = dialog.pendingSubmit ?? {
      subjectId: dialog.subjectId,
      staffId: ""
    };
    slotForm.setValue("subjectId", values.subjectId, { shouldValidate: true });
    slotForm.setValue("staffId", "", { shouldValidate: true });
    setNoTeacherDialog(null);
    if (dialog.pendingSubmit) {
      await persistSlot(values);
    }
  }

  const isEditingSlot = Boolean(slotSheet?.slotId);

  return (
    <div className="page-stack timetable-workspace">
      <ModulePageHeader navKey="timetable" title={pageTitle} />

      {!yearId ? (
        <EmptyState icon="calendar_month" title={t("noAcademicYear")} />
      ) : (
        <>
          <section className="timetable-grade-nav" aria-label={t("gradeNavLabel")}>
            {grades.data?.map((grade) => (
              <button
                key={grade.id}
                type="button"
                className={
                  resolvedGradeId === grade.id
                    ? "timetable-grade-card timetable-grade-card--active"
                    : "timetable-grade-card"
                }
                onClick={() => {
                  setGradeId(grade.id);
                  setClassroomId("");
                }}
              >
                <span className="pds-type-body-m-bold">{grade.name}</span>
                <span className="pds-type-body-s-regular muted">
                  {t("roomCount", { count: grade.classroomCount })}
                </span>
              </button>
            ))}
          </section>

          <div className="timetable-toolbar">
            <div className="timetable-room-nav" role="tablist" aria-label={t("roomNavLabel")}>
              {classrooms.data?.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  role="tab"
                  aria-selected={resolvedClassroomId === room.id}
                  className={
                    resolvedClassroomId === room.id
                      ? "timetable-room-chip timetable-room-chip--active"
                      : "timetable-room-chip"
                  }
                  onClick={() => setClassroomId(room.id)}
                >
                  {room.name}
                </button>
              ))}
            </div>

            <div className="timetable-toolbar__meta">
              {legendSubjects.length ? (
                <SubjectChipGroup className="timetable-legend">
                  {legendSubjects.map((subject) => (
                    <SubjectChip key={subject.id} colorKey={subject.colorKey}>
                      {subject.name}
                    </SubjectChip>
                  ))}
                </SubjectChipGroup>
              ) : null}
              {canManage ? (
                <Button
                  buttonType={isEditingTimetable ? "filled" : "outlined"}
                  buttonColor={isEditingTimetable ? "primary" : "secondary"}
                  prefixIcon={isEditingTimetable ? "save" : "edit"}
                  onClick={() => {
                    if (isEditingTimetable) {
                      setIsEditingTimetable(false);
                      setSlotSheet(null);
                      return;
                    }
                    setIsEditingTimetable(true);
                    document
                      .getElementById("timetable-weekly-grid")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {isEditingTimetable ? c("saveChanges") : t("editTimetable")}
                </Button>
              ) : null}
            </div>
          </div>

          {stats ? (
            <StatGrid>
              <StatCard
                accent
                icon={<Icon name="schedule" size={18} />}
                label={t("statPeriods")}
                value={String(stats.periodsPerWeek)}
              />
              <StatCard
                icon={<Icon name="menu_book" size={18} />}
                label={t("statSubjects")}
                value={String(stats.subjects)}
              />
              <StatCard
                icon={<Icon name="co_present" size={18} />}
                label={t("statTeachers")}
                value={String(stats.teachers)}
              />
              <StatCard
                icon={<Icon name="coffee" size={18} />}
                label={t("statFreePeriods")}
                value={String(stats.freePeriods)}
              />
            </StatGrid>
          ) : null}

          {!periods.length ? (
            <EmptyState
              icon="schedule"
              title={t("noPeriodsConfigured")}
              description={t("configureHoursHelp")}
              action={
                canManage ? (
                  <div className="timetable-empty-actions">
                    {canGeneratePeriods ? (
                      <button
                        type="button"
                        className="pds-type-body-m-bold btn-primary"
                        disabled={!yearId || generatePeriods.isPending}
                        onClick={() => {
                          if (!yearId) return;
                          void generatePeriods
                            .mutateAsync({ academicYearId: yearId })
                            .then((result) =>
                              toastSuccess(t("periodsGenerated", { count: result.generated }))
                            );
                        }}
                      >
                        <Icon name="auto_awesome" />
                        {generatePeriods.isPending ? t("generatingPeriods") : t("generatePeriods")}
                      </button>
                    ) : null}
                    <Link href="/dashboard/settings/school-schedule" className="pds-type-body-m-bold btn-ghost">
                      <Icon name="schedule" />
                      {t("openSchoolHours")}
                    </Link>
                  </div>
                ) : undefined
              }
            />
          ) : !resolvedClassroomId ? (
            <EmptyState icon="meeting_room" title={t("selectClassroom")} />
          ) : (
            <section
              id="timetable-weekly-grid"
              className={
                isEditingTimetable
                  ? "panel timetable-grid-panel timetable-grid-panel--editing"
                  : "panel timetable-grid-panel"
              }
            >
              <div className="timetable-grid-wrap">
                <table className="pds-type-body-m-medium timetable-board">
                  <thead>
                    <tr>
                      <th className="timetable-board__time-col" />
                      {workingDays.map((day) => (
                        <th key={day}>{dayLabel(day)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) =>
                      period.isBreak ? (
                        <tr key={period.id} className="timetable-board__break-row">
                          <th>
                            <span>{period.startsAt}</span>
                            <span className="pds-type-body-s-regular muted">{period.name}</span>
                          </th>
                          <td colSpan={workingDays.length}>
                            <div className="timetable-break-banner">
                              <Icon
                                name={period.periodType === "lunch_break" ? "restaurant" : "coffee"}
                                size={18}
                              />
                              <span>
                                {period.name} · {period.startsAt}–{period.endsAt}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={period.id}>
                          <th className="timetable-board__time-col">
                            <span>{period.startsAt}</span>
                            <span className="pds-type-body-s-regular muted">{period.name}</span>
                          </th>
                          {workingDays.map((day) => {
                            const slot = slotMap.get(`${day}:${period.id}`);
                            if (slot) {
                              const colorKey = normalizeColorKey(slot.subjectColorKey);
                              return (
                                <td key={`${day}-${period.id}`}>
                                  <button
                                    type="button"
                                    className={`timetable-slot-card timetable-slot-card--${colorKey}`}
                                    onClick={() => setSelectedSlot(slot)}
                                  >
                                    <SubjectChip colorKey={colorKey}>{slot.subjectName}</SubjectChip>
                                    <span className="pds-type-body-s-regular">{slot.teacherFullName}</span>
                                  </button>
                                </td>
                              );
                            }

                            return (
                              <td key={`${day}-${period.id}`}>
                                {canManage && isEditingTimetable ? (
                                  <button
                                    type="button"
                                    className="timetable-slot-empty"
                                    aria-label={t("addSlot")}
                                    onClick={() => {
                                      openSlotSheet({ periodId: period.id, dayOfWeek: day });
                                    }}
                                  >
                                    <Icon name="add" />
                                  </button>
                                ) : (
                                  <span className="timetable-slot-empty timetable-slot-empty--readonly" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <TimetablePeriodModal
        open={Boolean(selectedSlot)}
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        canManage={canManage}
        onDelete={
          selectedSlot && canManage && isEditingTimetable
            ? () =>
                void deleteSlot.mutateAsync({ slotId: selectedSlot.id }).then(() => {
                  setSelectedSlot(null);
                  toastSuccess(t("slotRemoved"));
                })
            : undefined
        }
        onEdit={
          selectedSlot && canManage && isEditingTimetable
            ? () => {
                setSelectedSlot(null);
                openSlotSheet(
                  {
                    periodId: selectedSlot.periodId,
                    dayOfWeek: selectedSlot.dayOfWeek,
                    slotId: selectedSlot.id
                  },
                  {
                    subjectId: selectedSlot.subjectId,
                    staffId: selectedSlot.teacherStaffId ?? ""
                  }
                );
              }
            : undefined
        }
      />

      <RecordFormSheet
        open={Boolean(slotSheet)}
        onOpenChange={(open) => {
          if (!open) setSlotSheet(null);
        }}
        title={isEditingSlot ? t("editSlotTitle") : t("addSlotTitle")}
        onSubmit={slotForm.handleSubmit(async (values) => {
          if (!slotSheet || !resolvedClassroomId) {
            return;
          }
          if (!values.staffId?.trim()) {
            setNoTeacherDialog({
              subjectId: values.subjectId,
              subjectName: subjectNameFor(values.subjectId),
              pendingSubmit: values
            });
            return;
          }
          await persistSlot(values);
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setSlotSheet(null)}>
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={slotForm.formState.isSubmitting}
            >
              <Icon name="check" />
              {slotForm.formState.isSubmitting ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        {activeSheetPeriod && slotSheet ? (
          <Field label={t("dayAndTime")}>
            <div className="timetable-slot-sheet__readonly pds-type-body-m-medium">
              {t("slotDayTimeReadonly", {
                day: dayLabel(slotSheet.dayOfWeek),
                period: activeSheetPeriod.name,
                start: activeSheetPeriod.startsAt,
                end: activeSheetPeriod.endsAt
              })}
            </div>
          </Field>
        ) : null}
        <Field label={t("subject")} error={slotForm.formState.errors.subjectId?.message}>
          <PdsSelectField
            variant="form"
            value={slotForm.watch("subjectId")}
            onValueChange={(value) =>
              handleSubjectChange(typeof value === "string" ? value : "")
            }
            placeholder={t("selectSubject")}
            options={(roomDetail.data?.subjects ?? []).map((subject) => ({
              value: subject.subjectId,
              label: subject.subjectName
            }))}
          />
        </Field>
        <Field label={t("teacher")} error={slotForm.formState.errors.staffId?.message}>
          <PdsSelectField
            variant="form"
            value={slotForm.watch("staffId")}
            onValueChange={(value) =>
              slotForm.setValue("staffId", typeof value === "string" ? value : "", {
                shouldValidate: true
              })
            }
            placeholder={t("selectTeacher")}
            options={teacherOptions}
          />
        </Field>
      </RecordFormSheet>

      <ConfirmDialog
        open={Boolean(noTeacherDialog)}
        onOpenChange={handleNoTeacherDialogOpenChange}
        title={t("noTeacherDialogTitle")}
        description={t("noTeacherDialogDescription", {
          subject: noTeacherDialog?.subjectName ?? ""
        })}
        confirmLabel={t("continueWithoutTeacher")}
        cancelLabel={
          noTeacherDialog?.pendingSubmit ? c("cancel") : t("cancelAddingSlot")
        }
        onConfirm={() => void handleContinueWithoutTeacher()}
        loading={slotForm.formState.isSubmitting || createSlot.isPending || updateSlot.isPending}
      />
    </div>
  );
}
