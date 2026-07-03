"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SubjectChip, SubjectChipGroup } from "../../../components/pds";
import { FilterTab } from "../../../components/pds/composites/filter-tabs";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { ExportCsvButton } from "../../../components/shared/export-csv-button";
import { EmptyState } from "../../../components/shared/empty-state";
import { StatusBadge } from "../../../components/shared/badge";
import { ArchiveVisibilityFilter } from "../../../components/shared/archive-visibility-filter";
import { Button } from "../../../components/ui/button";
import { useApiMutation, useReferenceApiQuery } from "../../lib/api";
import {
  filterByArchiveVisibility,
  isArchivedRecord,
  type ArchiveVisibility
} from "../../lib/archive-filter";
import { cn } from "../../../lib/utils";
import { isPadaukRowInteractiveTarget } from "../../lib/table-row-interaction";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { useCurrentAcademicYear } from "../../lib/use-current-academic-year";
import { ClassroomFormSheet, type ClassroomFormValues, type FacilityRoomOption } from "./classroom-form-sheet";
import { roomAccentColor, roomLetter, resolveSubjectChipColorKey } from "./subject-colors";
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
  subjects: { id: string; name: string; code: string | null; colorKey: string | null }[];
};

type ClassroomOverview = {
  id: string;
  name: string;
  room: string | null;
  capacity: number | null;
  facilityRoomId: string | null;
  studentCount: number;
  classTeacherName: string | null;
  classTeacherStaffId: string | null;
  status: string;
  subjects: { id: string; name: string; code: string | null; colorKey: string | null }[];
};

type StaffMember = { id: string; fullName: string };

type Term = { id: string; academicYearId: string; name: string };

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
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingRoom, setEditingRoom] = useState<ClassroomOverview | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<ClassroomOverview | null>(null);
  const [archiveVisibility, setArchiveVisibility] = useState<ArchiveVisibility>("active");

  const years = useReferenceApiQuery<YearOverview[]>((tenant) =>
    `/tenants/${tenant}/academics/setup/academic-years`
  );
  const grades = useReferenceApiQuery<GradeOverview[]>(
    (tenant) =>
      yearId ? `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades` : null
  );
  const terms = useReferenceApiQuery<Term[]>((tenant) => `/tenants/${tenant}/academics/terms`);
  const subjectsOverview = useReferenceApiQuery<{ id: string }[]>(
    (tenant) =>
      yearId ? `/tenants/${tenant}/academics/setup/academic-years/${yearId}/subjects` : null
  );

  const visibleGrades = useMemo(
    () => filterByArchiveVisibility(grades.data ?? [], archiveVisibility),
    [grades.data, archiveVisibility]
  );

  const gradesInYearCount = useMemo(
    () =>
      visibleGrades.filter((grade) => grade.classroomCount > 0 || grade.subjects.length > 0).length,
    [visibleGrades]
  );

  useEffect(() => {
    if (!visibleGrades.length) {
      setSelectedGradeId(null);
      return;
    }
    const gradeFromUrl = searchParams.get("grade") ?? searchParams.get("gradeId");
    if (gradeFromUrl && visibleGrades.some((grade) => grade.id === gradeFromUrl)) {
      setSelectedGradeId(gradeFromUrl);
      return;
    }
    if (!selectedGradeId || !visibleGrades.some((grade) => grade.id === selectedGradeId)) {
      setSelectedGradeId(visibleGrades[0]!.id);
    }
  }, [visibleGrades, searchParams, selectedGradeId]);

  const selectGrade = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("grade", gradeId);
    params.delete("gradeId");
    router.replace(`/dashboard/structure?${params.toString()}`, { scroll: false });
  };

  const selectedGrade = visibleGrades.find((grade) => grade.id === selectedGradeId) ?? null;
  const selectedGradeArchived = selectedGrade ? isArchivedRecord(selectedGrade.status) : false;

  const classrooms = useReferenceApiQuery<ClassroomOverview[]>(
    (tenant) =>
      yearId && selectedGradeId
        ? `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${selectedGradeId}/classrooms`
        : null
  );

  const visibleRooms = useMemo(
    () => filterByArchiveVisibility(classrooms.data ?? [], archiveVisibility),
    [classrooms.data, archiveVisibility]
  );

  const homeroomIncludeStaffId =
    formMode === "edit" ? editingRoom?.classTeacherStaffId ?? undefined : undefined;

  const teachers = useReferenceApiQuery<{ data: StaffMember[] }>((tenant) => {
    if (!selectedGradeId) {
      return null;
    }
    const params = new URLSearchParams({
      employmentRole: "teacher",
      eligibleGradeId: selectedGradeId,
      limit: "200"
    });
    if (homeroomIncludeStaffId) {
      params.set("includeStaffId", homeroomIncludeStaffId);
    }
    return `/tenants/${tenant}/hr/staff?${params.toString()}`;
  });
  const facilityRooms = useReferenceApiQuery<FacilityRoomOption[]>((tenant) =>
    canManage ? `/tenants/${tenant}/facility-rooms/active` : null
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
        facilityRoomId: values.facilityRoomId || null,
        classTeacherStaffId: values.classTeacherStaffId || null
      });
    } else {
      await createRoom.mutateAsync({
        name: values.name,
        academicYearId: yearId,
        gradeId: selectedGradeId,
        facilityRoomId: values.facilityRoomId || undefined,
        classTeacherStaffId: values.classTeacherStaffId || undefined
      });
    }
    setFormMode(null);
    setEditingRoom(null);
  };

  if (currentYear.isLoading || years.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (!currentYear.data) {
    return (
      <EmptyState
        icon="account_tree"
        title={t("structureEmptyTitle")}
        description={t("structureEmptyHelp")}
        action={
          <Button buttonType="filled" buttonColor="secondary" prefixIcon="settings" asChild>
            <Link href="/dashboard/academic-setup/years">{t("manageYears")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="structure-page">
      <PageHeader
        title={t("structureTitle")}
        description={t("description")}
        breadcrumbs={[{ label: nav("group_academics") }]}
        actionsPortal
      />
      <StructureExportPortal
        yearName={yearOverview?.name ?? currentYear.data?.name ?? ""}
        grades={visibleGrades}
        classrooms={visibleRooms}
        selectedGradeId={selectedGradeId}
        loading={grades.isLoading || classrooms.isLoading}
      />

      <section className="structure-year-banner">
        <div className="structure-year-banner__main">
          <p className="pds-type-caption-m structure-year-banner__label">{t("academicYearLabel")}</p>
          <h2 className="pds-type-title-xl-extrabold">{yearOverview?.name ?? currentYear.data.name}</h2>
          <p className="pds-type-body-m-medium structure-year-banner__meta">
            {yearOverview
              ? formatDateRange(yearOverview.startsOn, yearOverview.endsOn)
              : formatDateRange(currentYear.data.startsOn, currentYear.data.endsOn)}
            {" · "}
            {t("yearMetaTerms", { count: termCount })}
          </p>
        </div>
        <div className="structure-year-stats">
          <div className="pds-type-title-m-extrabold structure-stat">
            <strong>{yearOverview?.gradeCount ?? gradesInYearCount}</strong>
            <span>{t("statGrades")}</span>
          </div>
          <div className="pds-type-title-m-extrabold structure-stat">
            <strong>{yearOverview?.classroomCount ?? 0}</strong>
            <span>{t("statRooms")}</span>
          </div>
          <div className="pds-type-title-m-extrabold structure-stat">
            <strong>{subjectsOverview.data?.length ?? 0}</strong>
            <span>{t("statSubjects")}</span>
          </div>
        </div>
      </section>

      <div className="structure-select-grade-row">
        <p className="structure-select-grade">{t("selectGrade")}</p>
        <ArchiveVisibilityFilter value={archiveVisibility} onChange={setArchiveVisibility} />
      </div>

      <div className="structure-grade-scroll">
        <section className="structure-grade-rail" role="tablist" aria-label={t("selectGrade")}>
          {visibleGrades.map((grade) => {
            const active = grade.id === selectedGradeId;
            const archived = isArchivedRecord(grade.status);
            return (
              <FilterTab
                key={grade.id}
                label={grade.name}
                meta={t("roomsCount", { count: grade.classroomCount })}
                active={active}
                className={archived ? "pds-filter-tab--archived" : undefined}
                onClick={() => selectGrade(grade.id)}
              />
            );
          })}
          {!visibleGrades.length ? (
            <EmptyState
              compact
              embedded
              icon="school"
              title={
                archiveVisibility === "archived" ? t("archivedGradesEmpty") : t("structureNoGrades")
              }
            />
          ) : null}
        </section>
      </div>

      {selectedGrade ? (
        <section className="structure-grade-section">
          <header className="structure-grade-head">
            <div className="structure-grade-head__intro">
              <h3 className="pds-type-title-l-extrabold structure-grade-head__title">
                {t("gradeSectionTitle", {
                  grade: selectedGrade.name,
                  students: selectedGrade.studentCount
                })}
              </h3>
            </div>
          </header>

          <div className="structure-grade-body">
              {selectedGradeArchived ? (
                <p className="pds-type-body-s-regular muted structure-grade-body__archived-note">
                  {c("archivedViewOnly")}
                </p>
              ) : null}
              {classrooms.isLoading ? (
                <p className="pds-type-body-s-regular muted structure-grade-body__status">{c("loading")}</p>
              ) : visibleRooms.length ? (
                <div className="structure-room-grid">
                  {visibleRooms.map((room) => {
                      const roomArchived = isArchivedRecord(room.status);
                      const accent = roomAccentColor(room.name);
                      return (
                        <article
                          key={room.id}
                          className={cn("structure-room-card", "structure-room-card--clickable", roomArchived && "structure-room-card--archived")}
                          role="link"
                          tabIndex={0}
                          aria-label={room.name}
                          onClick={(event) => {
                            if (isPadaukRowInteractiveTarget(event.target)) return;
                            router.push(`/dashboard/structure/rooms/${room.id}`);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            router.push(`/dashboard/structure/rooms/${room.id}`);
                          }}
                        >
                          <div className="structure-room-card__head">
                            <span className="pds-type-title-s-extrabold structure-room-card__mark" style={{ background: accent }}>
                              {roomLetter(room.name)}
                            </span>
                            <div>
                              <div className="structure-room-card__title-row">
                                <h4>{room.name}</h4>
                                {roomArchived ? (
                                  <StatusBadge status="archived" label={c("archivedBadge")} />
                                ) : null}
                              </div>
                              <p className="pds-type-body-s-regular structure-room-card__count">
                                {t("roomStudentCount", { count: room.studentCount })}
                              </p>
                            </div>
                          </div>
                          <p className="pds-type-body-s-regular structure-room-card__teacher-label">{t("homeroomTeacher")}</p>
                          <p className="pds-type-body-m-medium structure-room-card__teacher-name">
                            {room.classTeacherName ?? "—"}
                          </p>
                          {room.subjects?.length ? (
                            <SubjectChipGroup className="structure-room-card__subjects">
                              {room.subjects.slice(0, 4).map((subject) => (
                                <SubjectChip
                                  key={subject.id}
                                  colorKey={resolveSubjectChipColorKey(subject.name, subject.colorKey)}
                                >
                                  {subject.name}
                                </SubjectChip>
                              ))}
                            </SubjectChipGroup>
                          ) : (
                            <p className="pds-type-body-s-regular muted structure-room-card__subjects structure-room-card__subjects--empty">
                              {t("noSubjectsYet")}
                            </p>
                          )}
                          <div className="structure-room-card__footer">
                            <Link
                              href={`/dashboard/structure/rooms/${room.id}`}
                              className="pds-type-body-s-regular structure-room-card__link"
                            >
                              {t("openClassroom")}
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                </div>
              ) : archiveVisibility === "archived" ? (
                <EmptyState compact embedded icon="meeting_room" title={t("archivedClassroomsEmpty")} />
              ) : canManage && !selectedGradeArchived ? (
                <EmptyState
                  icon="meeting_room"
                  title={t("structureNoRooms")}
                  action={
                    <Button
                      buttonType="filled"
                      buttonColor="secondary"
                      prefixIcon="add"
                      onClick={openCreate}
                    >
                      {t("addClassroom")}
                    </Button>
                  }
                />
              ) : (
                <EmptyState icon="meeting_room" title={t("structureNoRooms")} />
              )}
          </div>
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
        teachers={teachers.data?.data ?? []}
        facilityRooms={facilityRooms.data ?? []}
        initialValues={
          formMode === "edit" && editingRoom
            ? {
                name: editingRoom.name,
                facilityRoomId: editingRoom.facilityRoomId ?? "",
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
        title={t("archiveClassroomTitle")}
        description={t("archiveClassroomHelp")}
        confirmLabel={t("archiveClassroom")}
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

function StructureExportPortal({
  yearName,
  grades,
  classrooms,
  selectedGradeId,
  loading
}: {
  yearName: string;
  grades: GradeOverview[];
  classrooms: ClassroomOverview[];
  selectedGradeId: string | null;
  loading: boolean;
}) {
  const t = useTranslations("academics");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  const yearSlug = yearName.replace(/\s+/g, "-").toLowerCase() || "structure";

  return createPortal(
    <ExportCsvButton
      disabled={loading || !grades.length}
      onExport={async () => {
        const gradeRows = grades.map((grade) => ({
          grade: grade.name,
          classrooms: grade.classroomCount,
          students: grade.studentCount
        }));
        const classroomRows = classrooms.map((room) => ({
            grade: grades.find((g) => g.id === selectedGradeId)?.name ?? "",
            classroom: room.name,
            homeroom: room.classTeacherName ?? "",
            students: room.studentCount
          }));

        return {
          filename: `school-structure-${yearSlug}.csv`,
          sections: [
            {
              title: t("statGrades"),
              columns: [
                { key: "grade", header: t("statGrades") },
                { key: "classrooms", header: t("statRooms") },
                { key: "students", header: t("students") }
              ],
              rows: gradeRows
            },
            ...(classroomRows.length
              ? [
                  {
                    title: t("classroomsTab"),
                    columns: [
                      { key: "grade", header: t("statGrades") },
                      { key: "classroom", header: t("classroomsTab") },
                      { key: "homeroom", header: t("homeroomTeacher") },
                      { key: "students", header: t("students") }
                    ],
                    rows: classroomRows
                  }
                ]
              : [])
          ]
        };
      }}
    />,
    target
  );
}
