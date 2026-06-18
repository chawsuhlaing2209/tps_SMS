"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { useCurrentAcademicYear } from "../../lib/use-current-academic-year";
import { ClassroomFormSheet, type ClassroomFormValues } from "./classroom-form-sheet";
import { roomAccentColor, roomLetter, subjectColor } from "./subject-colors";
import { PageHeader } from "../page-header-context";

type YearOverview = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: string;
  gradeCount: number;
  classroomCount: number;
  studentCount: number;
};

type GradeOverview = {
  id: string;
  name: string;
  status: string;
  classroomCount: number;
  studentCount: number;
  subjects: { id: string; name: string; code: string | null }[];
};

type ClassroomOverview = {
  id: string;
  name: string;
  room: string | null;
  capacity: number | null;
  studentCount: number;
  classTeacherName: string | null;
  classTeacherStaffId: string | null;
  status: string;
  subjects: { id: string; name: string; code: string | null }[];
};

type StaffMember = { id: string; fullName: string };

type Term = { id: string; academicYearId: string; name: string };

type GradeTab = "classrooms" | "gradebook" | "leaderboard";

const CLASSROOMS_PATH = (tenant: string) => `/tenants/${tenant}/classrooms`;

function formatDateRange(startsOn: string, endsOn: string) {
  const start = new Date(startsOn);
  const end = new Date(endsOn);
  const fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(start)} → ${fmt.format(end)}`;
}

export default function SchoolStructurePage() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const router = useRouter();
  const searchParams = useSearchParams();
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["classroom.manage", "academic_setup.manage"]);
  const currentYear = useCurrentAcademicYear();
  const yearId = currentYear.data?.id ?? "";
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GradeTab>("classrooms");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingRoom, setEditingRoom] = useState<ClassroomOverview | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<ClassroomOverview | null>(null);

  const years = useApiQuery<YearOverview[]>((tenant) =>
    `/tenants/${tenant}/academics/setup/academic-years`
  );
  const grades = useApiQuery<GradeOverview[]>(
    (tenant) =>
      yearId ? `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades` : null
  );
  const terms = useApiQuery<Term[]>((tenant) => `/tenants/${tenant}/academics/terms`);
  const subjectsOverview = useApiQuery<{ id: string }[]>(
    (tenant) =>
      yearId ? `/tenants/${tenant}/academics/setup/academic-years/${yearId}/subjects` : null
  );

  const activeGrades = useMemo(
    () => (grades.data ?? []).filter((grade) => grade.status !== "archived"),
    [grades.data]
  );

  const gradesInYearCount = useMemo(
    () =>
      activeGrades.filter((grade) => grade.classroomCount > 0 || grade.subjects.length > 0).length,
    [activeGrades]
  );

  useEffect(() => {
    if (!activeGrades.length) {
      setSelectedGradeId(null);
      return;
    }
    const gradeFromUrl = searchParams.get("grade");
    if (gradeFromUrl && activeGrades.some((grade) => grade.id === gradeFromUrl)) {
      setSelectedGradeId(gradeFromUrl);
      return;
    }
    if (!selectedGradeId || !activeGrades.some((grade) => grade.id === selectedGradeId)) {
      setSelectedGradeId(activeGrades[0]!.id);
    }
  }, [activeGrades, searchParams, selectedGradeId]);

  useEffect(() => {
    setActiveTab("classrooms");
  }, [selectedGradeId]);

  const selectGrade = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    router.replace(`/dashboard/structure?grade=${gradeId}`);
  };

  const selectedGrade = activeGrades.find((grade) => grade.id === selectedGradeId) ?? null;

  const classrooms = useApiQuery<ClassroomOverview[]>(
    (tenant) =>
      yearId && selectedGradeId
        ? `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${selectedGradeId}/classrooms`
        : null
  );

  const teachers = useApiQuery<StaffMember[]>(
    (tenant) => `/tenants/${tenant}/hr/staff?employmentRole=teacher`
  );

  const yearOverview = years.data?.find((row) => row.id === yearId);
  const termCount = (terms.data ?? []).filter((term) => term.academicYearId === yearId).length;

  const createRoom = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: CLASSROOMS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        yearId && selectedGradeId
          ? [
              `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${selectedGradeId}/classrooms`,
              `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`,
              `/tenants/${tenant}/academics/setup/academic-years`
            ]
          : []
    }
  );

  const updateRoom = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenant) => {
      const { id, ...payload } = body;
      return {
        path: `${CLASSROOMS_PATH(tenant)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    {
      invalidatePaths: (_b, tenant) =>
        yearId && selectedGradeId
          ? [
              `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${selectedGradeId}/classrooms`,
              `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`,
              `/tenants/${tenant}/academics/setup/academic-years`
            ]
          : []
    }
  );

  const archiveRoom = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${CLASSROOMS_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        yearId && selectedGradeId
          ? [
              `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${selectedGradeId}/classrooms`,
              `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`,
              `/tenants/${tenant}/academics/setup/academic-years`
            ]
          : []
    }
  );

  const openCreate = () => {
    setEditingRoom(null);
    setFormMode("create");
  };

  const submitClassroom = async (values: ClassroomFormValues) => {
    if (!yearId || !selectedGradeId) return;
    if (formMode === "edit" && editingRoom) {
      await updateRoom.mutateAsync({
        id: editingRoom.id,
        name: values.name,
        room: values.room || null,
        capacity: values.capacity ? Number(values.capacity) : null,
        classTeacherStaffId: values.classTeacherStaffId || null
      });
    } else {
      await createRoom.mutateAsync({
        name: values.name,
        academicYearId: yearId,
        gradeId: selectedGradeId,
        room: values.room || undefined,
        capacity: values.capacity ? Number(values.capacity) : undefined,
        classTeacherStaffId: values.classTeacherStaffId || undefined
      });
    }
    setFormMode(null);
    setEditingRoom(null);
  };

  if (currentYear.isLoading || years.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (!currentYear.data) {
    return (
      <div className="structure-empty">
        <h2>{t("structureEmptyTitle")}</h2>
        <p className="muted">{t("structureEmptyHelp")}</p>
        <Link href="/dashboard/academic-setup/years" className="btn-primary">
          <Icon name="settings" />
          {t("manageYears")}
        </Link>
      </div>
    );
  }

  const gradeTabs: { id: GradeTab; label: string; icon: string }[] = [
    { id: "classrooms", label: t("classroomsTab"), icon: "meeting_room" },
    { id: "gradebook", label: t("gradebookTab"), icon: "bar_chart_4_bars" },
    { id: "leaderboard", label: t("leaderboardTab"), icon: "trophy" }
  ];

  return (
    <div className="structure-page">
      <PageHeader
        title={t("structureTitle")}
        description={t("description")}
        breadcrumbs={[{ label: nav("group_academics") }]}
      />

      <section className="structure-year-banner">
        <div className="structure-year-banner__main">
          <p className="structure-year-banner__label">{t("academicYearLabel")}</p>
          <h3>{yearOverview?.name ?? currentYear.data.name}</h3>
          <p className="structure-year-banner__meta">
            {yearOverview
              ? formatDateRange(yearOverview.startsOn, yearOverview.endsOn)
              : formatDateRange(currentYear.data.startsOn, currentYear.data.endsOn)}
            {" · "}
            {t("yearMetaTerms", { count: termCount })}
          </p>
        </div>
        <div className="structure-year-stats">
          <div className="structure-stat">
            <strong>{yearOverview?.gradeCount ?? gradesInYearCount}</strong>
            <span>{t("statGrades")}</span>
          </div>
          <div className="structure-stat">
            <strong>{yearOverview?.classroomCount ?? 0}</strong>
            <span>{t("statRooms")}</span>
          </div>
          <div className="structure-stat">
            <strong>{subjectsOverview.data?.length ?? 0}</strong>
            <span>{t("statSubjects")}</span>
          </div>
        </div>
      </section>

      <p className="structure-select-grade">{t("selectGrade")}</p>

      <div className="structure-grade-scroll">
        <section className="structure-grade-rail" aria-label={t("selectGrade")}>
          {activeGrades.map((grade) => {
            const active = grade.id === selectedGradeId;
            return (
              <button
                key={grade.id}
                type="button"
                className={active ? "structure-grade-chip structure-grade-chip--active" : "structure-grade-chip"}
                onClick={() => selectGrade(grade.id)}
              >
                <span className="structure-grade-chip__name">{grade.name}</span>
                <span className="structure-grade-chip__meta">
                  {t("roomsCount", { count: grade.classroomCount })}
                </span>
              </button>
            );
          })}
          {!activeGrades.length ? (
            <p className="muted">{t("structureNoGrades")}</p>
          ) : null}
        </section>
      </div>

      {selectedGrade ? (
        <section className="structure-rooms">
          <div className="structure-grade-head">
            <div className="structure-grade-head__title">
              <h3>{t("gradeTitleWithStudents", { grade: selectedGrade.name, count: selectedGrade.studentCount })}</h3>
            </div>
            <div className="structure-segment-tabs" role="tablist" aria-label={t("gradeViewsLabel")}>
              {gradeTabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={
                      active
                        ? "structure-segment-tab structure-segment-tab--active"
                        : "structure-segment-tab"
                    }
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon name={tab.icon} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "classrooms" ? (
            <div className="structure-tab-panel" role="tabpanel">
              {canManage && !classrooms.data?.length && !classrooms.isLoading ? (
                <div className="structure-empty structure-empty--compact">
                  <p className="muted">{t("structureNoRooms")}</p>
                  <button type="button" className="btn-primary" onClick={openCreate}>
                    <Icon name="add" />
                    {t("addClassroom")}
                  </button>
                </div>
              ) : null}

              {classrooms.isLoading ? (
                <p className="muted">{c("loading")}</p>
              ) : classrooms.data?.length ? (
                <div className="structure-room-grid">
                  {(classrooms.data ?? [])
                    .filter((room) => room.status !== "archived")
                    .map((room) => {
                      const accent = roomAccentColor(room.name);
                      return (
                        <article key={room.id} className="structure-room-card">
                          <div className="structure-room-card__head">
                            <span className="structure-room-card__mark" style={{ background: accent }}>
                              {roomLetter(room.name)}
                            </span>
                            <div>
                              <h4>{room.name}</h4>
                              <p className="structure-room-card__count">
                                {t("roomStudentCount", { count: room.studentCount })}
                              </p>
                            </div>
                          </div>
                          <p className="structure-room-card__teacher-label">{t("homeroomTeacher")}</p>
                          <p className="structure-room-card__teacher-name">
                            {room.classTeacherName ?? "—"}
                          </p>
                          <div className="structure-room-card__subjects">
                            {(room.subjects ?? []).slice(0, 4).map((subject) => {
                              const colors = subjectColor(subject.name);
                              return (
                                <span
                                  key={subject.id}
                                  className="structure-subject-tag"
                                  style={{ background: colors.bg, color: colors.text }}
                                >
                                  {subject.name}
                                </span>
                              );
                            })}
                            {!room.subjects?.length ? (
                              <span className="muted">{t("noSubjectsYet")}</span>
                            ) : null}
                          </div>
                          <div className="structure-room-card__footer">
                            <Link
                              href={`/dashboard/structure/rooms/${room.id}`}
                              className="structure-room-card__link"
                            >
                              {t("openClassroom")}
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                </div>
              ) : canManage ? null : (
                <div className="structure-empty structure-empty--compact">
                  <p className="muted">{t("structureNoRooms")}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="structure-tab-panel" role="tabpanel">
              <div className="structure-tab-placeholder">
                {activeTab === "gradebook" ? t("gradebookComingSoon") : t("leaderboardComingSoon")}
              </div>
            </div>
          )}
        </section>
      ) : null}

      <ClassroomFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            setEditingRoom(null);
          }
        }}
        mode={formMode === "edit" ? "edit" : "create"}
        teachers={teachers.data ?? []}
        initialValues={
          formMode === "edit" && editingRoom
            ? {
                name: editingRoom.name,
                room: editingRoom.room ?? "",
                capacity: editingRoom.capacity ? String(editingRoom.capacity) : "",
                classTeacherStaffId: editingRoom.classTeacherStaffId ?? ""
              }
            : undefined
        }
        onSubmit={submitClassroom}
      />

      <ConfirmDialog
        open={deletingRoom !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRoom(null);
        }}
        title={t("deleteClassroomTitle")}
        description={t("deleteClassroomHelp")}
        confirmLabel={t("deleteClassroom")}
        destructive
        onConfirm={async () => {
          if (!deletingRoom) return;
          await archiveRoom.mutateAsync({ id: deletingRoom.id });
          setDeletingRoom(null);
        }}
      />
    </div>
  );
}
