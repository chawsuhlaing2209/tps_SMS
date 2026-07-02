"use client";

import type { SchoolScheduleSettings } from "@sms/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button as PdsButton, SubjectChip, SubjectChipGroup } from "../../../components/pds";
import type { PdsSubjectColorKey } from "../../../components/pds/palettes";
import { PdsSelectField } from "../../../components/pds";
import { Button } from "../../../components/ui/button";
import { ConfirmDialog, AppModal } from "../../../components/shared/confirm-dialog";
import { EmptyState } from "../../../components/shared/empty-state";
import { StatCard, StatGrid } from "../../../components/shared/stat-card";
import { useApiMutation, useApiQuery, apiFetch } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { printDocument } from "../../lib/print-document";
import { hasAnyPermission } from "../../lib/permissions";
import { RecordFormSheet } from "../../lib/record-sheet";
import { getSession } from "../../lib/session";
import { toastSuccess } from "../../lib/toast";
import { useCurrentAcademicYear } from "../../lib/use-current-academic-year";
import { zodResolver } from "../../lib/zod-resolver";
import { ModulePageHeader } from "../module-page-header";
import { resolveSubjectChipColorKey } from "../structure/subject-colors";
import { TimetablePeriodModal } from "./_components/timetable-period-modal";

type GradeOverview = {
  id: string;
  name: string;
  classroomCount: number;
  subjectCount: number;
  subjects: Array<{ id: string; name: string; code: string | null; colorKey?: string | null }>;
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
      noEligibleTeachers?: boolean;
    }
  | null;

type TeacherConflictDetails = {
  slotId: string;
  classroomName: string;
  gradeName: string;
  subjectName: string | null;
  teacherFullName: string | null;
  periodName: string;
  periodStartsAt: string;
  periodEndsAt: string;
  dayOfWeek: number;
};

type EligibleTeacher = { id: string; fullName: string };

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

const eligibleTeachersPath = (
  tenant: string,
  classroomId: string,
  subjectId: string,
  includeStaffId?: string
) => {
  const params = new URLSearchParams();
  if (includeStaffId) {
    params.set("includeStaffId", includeStaffId);
  }
  const query = params.toString();
  return `/tenants/${tenant}/timetable/classrooms/${classroomId}/subjects/${subjectId}/eligible-teachers${query ? `?${query}` : ""}`;
};

const teacherConflictPath = (
  tenant: string,
  input: {
    staffId: string;
    periodId: string;
    dayOfWeek: number;
    excludeSlotId?: string;
  }
) => {
  const params = new URLSearchParams({
    staffId: input.staffId,
    periodId: input.periodId,
    dayOfWeek: String(input.dayOfWeek)
  });
  if (input.excludeSlotId) {
    params.set("excludeSlotId", input.excludeSlotId);
  }
  return `/tenants/${tenant}/timetable/teacher-schedule-conflict?${params.toString()}`;
};

const schoolSchedulePath = (tenant: string) => `/tenants/${tenant}/settings/school-schedule`;

const timetableInvalidate = (tenant: string) => [
  `/tenants/${tenant}/timetable`,
  `/tenants/${tenant}/classrooms`
];

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
  const [teacherConflictDialog, setTeacherConflictDialog] = useState<TeacherConflictDetails | null>(
    null
  );
  const [subjectJustChanged, setSubjectJustChanged] = useState(false);

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

  const watchedSubjectId = slotForm.watch("subjectId");
  const watchedStaffId = slotForm.watch("staffId");

  const eligibleTeachers = useApiQuery<{ data: EligibleTeacher[] }>((tenant) =>
    resolvedClassroomId && watchedSubjectId && slotSheet
      ? eligibleTeachersPath(tenant, resolvedClassroomId, watchedSubjectId, watchedStaffId || undefined)
      : null
  );

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
      merged.set(subject.id, {
        name: subject.name,
        colorKey: resolveSubjectChipColorKey(subject.name, subject.colorKey)
      });
    }
    for (const subject of fromRoom) {
      merged.set(subject.subjectId, {
        name: subject.subjectName,
        colorKey: resolveSubjectChipColorKey(subject.subjectName, subject.subjectColorKey)
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

  const subjectOptions = useMemo(
    () =>
      (activeGrade?.subjects ?? []).map((subject) => ({
        value: subject.id,
        label: subject.name
      })),
    [activeGrade?.subjects]
  );

  const teacherOptions = useMemo(() => {
    const eligible = eligibleTeachers.data?.data ?? [];
    const options = eligible.map((teacher) => ({
      value: teacher.id,
      label: teacher.fullName
    }));
    return [{ value: "", label: t("noTeacherOption") }, ...options];
  }, [eligibleTeachers.data?.data, t]);

  function subjectNameFor(subjectId: string) {
    return (
      activeGrade?.subjects.find((row) => row.id === subjectId)?.name ??
      roomDetail.data?.subjects.find((row) => row.subjectId === subjectId)?.subjectName ??
      subjectId
    );
  }

  useEffect(() => {
    if (!slotSheet || !watchedSubjectId || !subjectJustChanged || eligibleTeachers.isLoading) {
      return;
    }

    const teachers = eligibleTeachers.data?.data ?? [];
    if (teachers.length === 0) {
      setNoTeacherDialog({
        subjectId: watchedSubjectId,
        subjectName: subjectNameFor(watchedSubjectId),
        noEligibleTeachers: true
      });
      slotForm.setValue("staffId", "", { shouldValidate: true });
      setSubjectJustChanged(false);
      return;
    }

    const assignedTeacher = roomDetail.data?.subjects.find(
      (row) => row.subjectId === watchedSubjectId
    )?.teacherStaffId;
    const preferredTeacher =
      assignedTeacher && teachers.some((teacher) => teacher.id === assignedTeacher)
        ? assignedTeacher
        : "";

    void (async () => {
      if (preferredTeacher && slotSheet) {
        const tenantId = getSession()?.tenantId;
        if (tenantId) {
          const result = await apiFetch<{
            hasConflict: boolean;
            existing?: TeacherConflictDetails;
          }>(
            teacherConflictPath(tenantId, {
              staffId: preferredTeacher,
              periodId: slotSheet.periodId,
              dayOfWeek: slotSheet.dayOfWeek,
              excludeSlotId: slotSheet.slotId
            })
          );
          if (result.hasConflict && result.existing) {
            setTeacherConflictDialog(result.existing);
            slotForm.setValue("staffId", "", { shouldValidate: true });
            setSubjectJustChanged(false);
            return;
          }
        }
      }

      slotForm.setValue("staffId", preferredTeacher, { shouldValidate: true });
      setSubjectJustChanged(false);
    })();
  }, [
    activeGrade?.subjects,
    eligibleTeachers.data?.data,
    eligibleTeachers.isLoading,
    roomDetail.data?.subjects,
    slotForm,
    slotSheet,
    subjectJustChanged,
    watchedSubjectId
  ]);

  async function resolveTeacherConflict(staffId: string): Promise<TeacherConflictDetails | null> {
    if (!slotSheet || !staffId.trim()) {
      return null;
    }

    const tenantId = getSession()?.tenantId;
    if (!tenantId) {
      return null;
    }

    const result = await apiFetch<{
      hasConflict: boolean;
      existing?: TeacherConflictDetails;
    }>(
      teacherConflictPath(tenantId, {
        staffId,
        periodId: slotSheet.periodId,
        dayOfWeek: slotSheet.dayOfWeek,
        excludeSlotId: slotSheet.slotId
      })
    );

    return result.hasConflict ? (result.existing ?? null) : null;
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
    setTeacherConflictDialog(null);
    setSubjectJustChanged(false);
    setSlotSheet(context);
  }

  function handleSubjectChange(subjectId: string) {
    if (!subjectId) {
      slotForm.setValue("subjectId", "", { shouldValidate: true });
      slotForm.setValue("staffId", "", { shouldValidate: true });
      return;
    }

    slotForm.setValue("subjectId", subjectId, { shouldValidate: true });
    slotForm.setValue("staffId", "", { shouldValidate: true });
    setNoTeacherDialog(null);
    setTeacherConflictDialog(null);
    setSubjectJustChanged(true);
  }

  async function handleTeacherChange(staffId: string) {
    if (!staffId.trim()) {
      slotForm.setValue("staffId", "", { shouldValidate: true });
      return;
    }

    const conflict = await resolveTeacherConflict(staffId);
    if (conflict) {
      setTeacherConflictDialog(conflict);
      slotForm.setValue("staffId", "", { shouldValidate: true });
      return;
    }

    slotForm.setValue("staffId", staffId, { shouldValidate: true });
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
    if (!noTeacherDialog?.noEligibleTeachers) {
      setSlotSheet(null);
    }
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
      <ModulePageHeader
        navKey="timetable"
        title={pageTitle}
        actions={
          resolvedClassroomId ? (
            <Button
              type="button"
              buttonType="outlined"
              buttonColor="secondary"
              prefixIcon="print"
              onClick={() =>
                printDocument("#timetable-weekly-grid", {
                  title: pageTitle,
                  layout: "landscape",
                  width: "wide"
                })
              }
            >
              {t("printExport")}
            </Button>
          ) : null
        }
      />

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
              {legendSubjects.length && resolvedClassroomId ? (
                <SubjectChipGroup className="timetable-legend">
                  {legendSubjects.map((subject) => (
                    <SubjectChip key={subject.id} colorKey={subject.colorKey}>
                      {subject.name}
                    </SubjectChip>
                  ))}
                </SubjectChipGroup>
              ) : null}
              {canManage && resolvedClassroomId ? (
                <PdsButton
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
                </PdsButton>
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

          {classrooms.isLoading ? null : !classrooms.data?.length ? (
            <EmptyState
              icon="meeting_room"
              title={t("noClassroomsInGrade")}
              description={t("noClassroomsInGradeHelp")}
              action={
                canManage ? (
                  <Link
                    href={`/dashboard/academic-setup/grades-classrooms?grade=${resolvedGradeId}`}
                    className="pds-type-body-m-bold btn-primary"
                  >
                    <Icon name="add" />
                    {t("addClassroom")}
                  </Link>
                ) : undefined
              }
            />
          ) : !periods.length ? (
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
            <section id="timetable-weekly-grid">
              <div
                className={
                  isEditingTimetable
                    ? "padauk-table-wrap timetable-grid-wrap timetable-grid-wrap--editing"
                    : "padauk-table-wrap timetable-grid-wrap"
                }
              >
                <table className="pds-type-body-m-medium timetable-board">
                  <thead>
                    <tr>
                      <th className="timetable-board__time-col" />
                      {workingDays.map((day) => (
                        <th key={day} className="pds-type-caption-s">
                          {dayLabel(day)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) =>
                      period.isBreak ? (
                        <tr key={period.id} className="timetable-board__break-row">
                          <th className="timetable-board__time-col">
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
                              const colorKey = resolveSubjectChipColorKey(
                                slot.subjectName ?? "",
                                slot.subjectColorKey ??
                                  activeGrade?.subjects.find(
                                    (subject) => subject.id === slot.subjectId
                                  )?.colorKey
                              );
                              return (
                                <td key={`${day}-${period.id}`}>
                                  <button
                                    type="button"
                                    data-print-keep
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
                                    onClick={() => openSlotSheet({ periodId: period.id, dayOfWeek: day })}
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
          selectedSlot && canManage
            ? () =>
                void deleteSlot.mutateAsync({ slotId: selectedSlot.id }).then(() => {
                  setSelectedSlot(null);
                  toastSuccess(t("slotRemoved"));
                })
            : undefined
        }
        onEdit={
          selectedSlot && canManage
            ? () => {
                setIsEditingTimetable(true);
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
          if (values.staffId?.trim()) {
            const conflict = await resolveTeacherConflict(values.staffId.trim());
            if (conflict) {
              setTeacherConflictDialog(conflict);
              return;
            }
            await persistSlot(values);
            return;
          }
          setNoTeacherDialog({
            subjectId: values.subjectId,
            subjectName: subjectNameFor(values.subjectId),
            pendingSubmit: values
          });
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
            options={subjectOptions}
          />
        </Field>
        <Field label={t("teacher")} error={slotForm.formState.errors.staffId?.message}>
          <PdsSelectField
            variant="form"
            value={slotForm.watch("staffId")}
            onValueChange={(value) =>
              void handleTeacherChange(typeof value === "string" ? value : "")
            }
            placeholder={
              !watchedSubjectId
                ? t("selectSubjectFirst")
                : eligibleTeachers.isLoading
                  ? c("loading")
                  : t("selectTeacher")
            }
            disabled={!watchedSubjectId || eligibleTeachers.isLoading}
            options={teacherOptions}
          />
        </Field>
      </RecordFormSheet>

      <ConfirmDialog
        open={Boolean(noTeacherDialog)}
        onOpenChange={handleNoTeacherDialogOpenChange}
        title={
          noTeacherDialog?.noEligibleTeachers
            ? t("noEligibleTeachersDialogTitle")
            : t("noTeacherDialogTitle")
        }
        description={
          noTeacherDialog?.noEligibleTeachers
            ? t("noEligibleTeachersDialogDescription", {
                subject: noTeacherDialog?.subjectName ?? ""
              })
            : t("noTeacherDialogDescription", {
                subject: noTeacherDialog?.subjectName ?? ""
              })
        }
        confirmLabel={t("continueWithoutTeacher")}
        cancelLabel={
          noTeacherDialog?.pendingSubmit ? c("cancel") : t("cancelAddingSlot")
        }
        onConfirm={() => void handleContinueWithoutTeacher()}
        loading={slotForm.formState.isSubmitting || createSlot.isPending || updateSlot.isPending}
      />

      <AppModal
        open={Boolean(teacherConflictDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setTeacherConflictDialog(null);
          }
        }}
        title={t("teacherConflictDialogTitle")}
        description={
          teacherConflictDialog
            ? t("teacherConflictDialogDescription", {
                teacher: teacherConflictDialog.teacherFullName ?? t("unknownTeacher"),
                day: dayLabel(teacherConflictDialog.dayOfWeek),
                period: teacherConflictDialog.periodName,
                start: teacherConflictDialog.periodStartsAt,
                end: teacherConflictDialog.periodEndsAt,
                grade: teacherConflictDialog.gradeName,
                classroom: teacherConflictDialog.classroomName,
                subject: teacherConflictDialog.subjectName ?? t("unknownSubject")
              })
            : ""
        }
        footer={
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            onClick={() => setTeacherConflictDialog(null)}
          >
            {c("close")}
          </button>
        }
      />
    </div>
  );
}
