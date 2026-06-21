"use client";
import { FormInput } from "../../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { isPadaukRowInteractiveTarget } from "../../../lib/table-row-interaction";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckboxList, PdsSearchFiltersRow, PdsSelectField } from "../../../../components/pds";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { EmptyState } from "../../../../components/shared/empty-state";
import { StatusBadge } from "../../../../components/shared/badge";
import { ArchiveVisibilityFilter } from "../../../../components/shared/archive-visibility-filter";
import { useApiMutation, useReferenceApiQuery } from "../../../lib/api";
import {
  filterByArchiveVisibility,
  isArchivedRecord,
  type ArchiveVisibility
} from "../../../lib/archive-filter";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { toastSuccess } from "../../../lib/toast";
import { cn } from "../../../../lib/utils";
import { PageHeader } from "../../page-header-context";
import { gradeStreamLabel } from "../grade-label";
import {
  ClassroomFormSheet,
  type ClassroomFormValues,
  type FacilityRoomOption
} from "../../structure/classroom-form-sheet";
import { roomLetter, subjectColor, subjectIcon } from "../../structure/subject-colors";
import { useAcademicYearContext } from "../use-academic-year-context";

type Subject = { id: string; name: string; status: string };
type GradeOverview = {
  id: string;
  name: string;
  minAge: number | null;
  maxAge: number | null;
  status: string;
  subjectCount: number;
  subjects: { id: string; name: string; code: string | null }[];
  classroomCount: number;
  studentCount: number;
  gradeChiefName: string | null;
  gradeChiefStaffId: string | null;
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
};
type StaffMember = { id: string; fullName: string };

type GradeFormValues = {
  name: string;
  minAge: string;
  maxAge: string;
  subjectIds: string[];
  gradeChiefStaffId: string;
  roomName: string;
  facilityRoomId: string;
};

type GradeFormMode = { type: "create" } | { type: "edit"; grade: GradeOverview };
type RoomFormMode =
  | { type: "create" }
  | { type: "edit"; room: ClassroomOverview };

const setupGradesPath = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`;
const setupYearsPath = (tenant: string) => `/tenants/${tenant}/academics/setup/academic-years`;
const setupClassroomsPath = (tenant: string, yearId: string, gradeId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${gradeId}/classrooms`;
const CLASSROOMS_PATH = (tenant: string) => `/tenants/${tenant}/classrooms`;
const GRADES_PATH = (tenant: string) => `/tenants/${tenant}/academics/grades`;

function invalidatePaths(tenant: string, yearId: string, gradeId?: string) {
  const paths = [
    GRADES_PATH(tenant),
    setupGradesPath(tenant, yearId),
    setupYearsPath(tenant),
    CLASSROOMS_PATH(tenant)
  ];
  if (gradeId) {
    paths.push(setupClassroomsPath(tenant, yearId, gradeId));
  }
  return paths;
}

export default function GradesClassroomsPage() {
  const t = useTranslations("academics");
  const setup = useTranslations("academicSetup");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["classroom.manage", "academic_setup.manage"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requiredMessage = c("required");

  const currentYear = useCurrentAcademicYear();
  const { contextYearId } = useAcademicYearContext(currentYear.data);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [gradeFormMode, setGradeFormMode] = useState<GradeFormMode | null>(null);
  const [roomFormMode, setRoomFormMode] = useState<RoomFormMode | null>(null);
  const [deletingGrade, setDeletingGrade] = useState<GradeOverview | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<ClassroomOverview | null>(null);
  const [archiveVisibility, setArchiveVisibility] = useState<ArchiveVisibility>("active");

  const grades = useReferenceApiQuery<GradeOverview[]>((tn) =>
    contextYearId ? setupGradesPath(tn, contextYearId) : null
  );
  const subjects = useReferenceApiQuery<Subject[]>((tn) => `/tenants/${tn}/academics/subjects`);
  const homeroomIncludeStaffId =
    roomFormMode?.type === "edit" ? roomFormMode.room.classTeacherStaffId ?? undefined : undefined;

  const teachers = useReferenceApiQuery<{ data: StaffMember[] }>((tn) => {
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
    return `/tenants/${tn}/hr/staff?${params.toString()}`;
  });
  const facilityRooms = useReferenceApiQuery<FacilityRoomOption[]>((tn) =>
    `/tenants/${tn}/facility-rooms/active`
  );

  const visibleGrades = useMemo(
    () => filterByArchiveVisibility(grades.data ?? [], archiveVisibility),
    [grades.data, archiveVisibility]
  );

  useEffect(() => {
    if (!visibleGrades.length) {
      setSelectedGradeId(null);
      return;
    }
    const fromUrl = searchParams.get("grade");
    if (fromUrl && visibleGrades.some((g) => g.id === fromUrl)) {
      setSelectedGradeId(fromUrl);
      return;
    }
    if (!selectedGradeId || !visibleGrades.some((g) => g.id === selectedGradeId)) {
      setSelectedGradeId(visibleGrades[0]!.id);
    }
  }, [visibleGrades, searchParams, selectedGradeId]);

  const selectGrade = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    router.replace(`/dashboard/academic-setup/grades-classrooms?grade=${gradeId}`);
  };

  const selectedGrade = visibleGrades.find((g) => g.id === selectedGradeId) ?? null;
  const selectedGradeArchived = selectedGrade ? isArchivedRecord(selectedGrade.status) : false;

  const classrooms = useReferenceApiQuery<ClassroomOverview[]>(
    (tn) =>
      contextYearId && selectedGradeId
        ? setupClassroomsPath(tn, contextYearId, selectedGradeId)
        : null
  );

  const createGrade = useApiMutation<Record<string, unknown>, { id: string }>(
    (body, tenant) => ({
      path: GRADES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId ? invalidatePaths(tenant, contextYearId) : [GRADES_PATH(tenant)]
    }
  );

  const updateGrade = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenant) => {
      const { id, ...payload } = body;
      return {
        path: `${GRADES_PATH(tenant)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId ? invalidatePaths(tenant, contextYearId) : [GRADES_PATH(tenant)]
    }
  );

  const createRoom = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: CLASSROOMS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId && selectedGradeId
          ? invalidatePaths(tenant, contextYearId, selectedGradeId)
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
        contextYearId && selectedGradeId
          ? invalidatePaths(tenant, contextYearId, selectedGradeId)
          : []
    }
  );

  const archiveGrade = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${GRADES_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId ? invalidatePaths(tenant, contextYearId) : [GRADES_PATH(tenant)]
    }
  );

  const archiveRoom = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${CLASSROOMS_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId && selectedGradeId
          ? invalidatePaths(tenant, contextYearId, selectedGradeId)
          : []
    }
  );

  const reactivateGrade = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${GRADES_PATH(tenant)}/${id}/reactivate`,
      init: { method: "POST" }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId ? invalidatePaths(tenant, contextYearId) : [GRADES_PATH(tenant)]
    }
  );

  const reactivateRoom = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${CLASSROOMS_PATH(tenant)}/${id}/reactivate`,
      init: { method: "POST" }
    }),
    {
      invalidatePaths: (_b, tenant) =>
        contextYearId && selectedGradeId
          ? invalidatePaths(tenant, contextYearId, selectedGradeId)
          : []
    }
  );

  const gradeSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, requiredMessage),
        minAge: z.string(),
        maxAge: z.string(),
        subjectIds: z.array(z.string()),
        gradeChiefStaffId: z.string(),
        roomName: z.string(),
        facilityRoomId: z.string()
      }),
    [requiredMessage]
  );

  const gradeDefaultValues: GradeFormValues = {
    name: "",
    minAge: "",
    maxAge: "",
    subjectIds: [],
    gradeChiefStaffId: "",
    roomName: "",
    facilityRoomId: ""
  };

  const gradeForm = useForm<GradeFormValues>({
    resolver: zodResolver(gradeSchema),
    defaultValues: gradeDefaultValues
  });

  const activeSubjects = subjects.data?.filter((s) => s.status !== "archived") ?? [];
  const selectedSubjectIds = gradeForm.watch("subjectIds");
  const visibleRooms = useMemo(
    () => filterByArchiveVisibility(classrooms.data ?? [], archiveVisibility),
    [classrooms.data, archiveVisibility]
  );

  const openCreateGrade = () => {
    gradeForm.reset(gradeDefaultValues);
    setGradeFormMode({ type: "create" });
  };

  const openEditGrade = () => {
    if (!selectedGrade) return;
    gradeForm.reset({
      name: selectedGrade.name,
      minAge: selectedGrade.minAge != null ? String(selectedGrade.minAge) : "",
      maxAge: selectedGrade.maxAge != null ? String(selectedGrade.maxAge) : "",
      subjectIds: selectedGrade.subjects.map((s) => s.id),
      gradeChiefStaffId: selectedGrade.gradeChiefStaffId ?? "",
      roomName: "",
      facilityRoomId: ""
    });
    setGradeFormMode({ type: "edit", grade: selectedGrade });
  };

  const submitGrade = async (values: GradeFormValues) => {
    if (!contextYearId) return;
    const payload = {
      name: values.name,
      minAge: values.minAge ? Number(values.minAge) : null,
      maxAge: values.maxAge ? Number(values.maxAge) : null,
      academicYearId: contextYearId,
      subjectIds: values.subjectIds,
      gradeChiefStaffId: values.gradeChiefStaffId || null
    };

    if (gradeFormMode?.type === "edit") {
      await updateGrade.mutateAsync({ id: gradeFormMode.grade.id, ...payload });
    } else {
      const created = await createGrade.mutateAsync(payload);
      const gradeId = created.id;
      if (values.roomName.trim()) {
        await createRoom.mutateAsync({
          name: values.roomName.trim(),
          academicYearId: contextYearId,
          gradeId,
          facilityRoomId: values.facilityRoomId || undefined
        });
      }
      selectGrade(gradeId);
    }
    setGradeFormMode(null);
    gradeForm.reset(gradeDefaultValues);
  };

  const openCreateRoom = () => setRoomFormMode({ type: "create" });
  const openEditRoom = (room: ClassroomOverview) => setRoomFormMode({ type: "edit", room });

  const submitRoom = async (values: ClassroomFormValues) => {
    if (!contextYearId || !selectedGradeId) return;
    if (roomFormMode?.type === "edit") {
      await updateRoom.mutateAsync({
        id: roomFormMode.room.id,
        name: values.name,
        facilityRoomId: values.facilityRoomId || null,
        classTeacherStaffId: values.classTeacherStaffId || null
      });
    } else {
      await createRoom.mutateAsync({
        name: values.name,
        academicYearId: contextYearId,
        gradeId: selectedGradeId,
        facilityRoomId: values.facilityRoomId || undefined,
        classTeacherStaffId: values.classTeacherStaffId || undefined
      });
    }
    setRoomFormMode(null);
  };

  if (currentYear.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (!currentYear.data || !contextYearId) {
    return (
      <EmptyState
        icon="school"
        title={t("structureEmptyTitle")}
        description={setup("gradesClassroomsNeedYear")}
      />
    );
  }

  const stream = selectedGrade
    ? gradeStreamLabel(selectedGrade.minAge, selectedGrade.maxAge)
    : null;

  return (
    <>
      <PageHeader
        title={setup("gradesClassrooms")}
        breadcrumbs={[
          { label: nav("academicSetup") },
          { label: setup("gradesClassrooms") }
        ]}
      />

      <section className="setup-grade-selector">
        <div className="setup-grade-selector__head">
          <p className="pds-type-label-s-medium setup-grade-selector__label">{setup("selectGradeLevel")}</p>
          <ArchiveVisibilityFilter value={archiveVisibility} onChange={setArchiveVisibility} />
        </div>
        <div className="setup-grade-row">
          <div className="setup-grade-scroll">
            <div className="setup-grade-rail" aria-label={setup("selectGradeLevel")}>
              {visibleGrades.map((grade) => {
                const active = grade.id === selectedGradeId;
                const archived = isArchivedRecord(grade.status);
                return (
                  <button
                    key={grade.id}
                    type="button"
                    className={cn(
                      "pds-type-body-s-semibold setup-grade-chip",
                      active && "setup-grade-chip--active",
                      archived && "setup-grade-chip--archived"
                    )}
                    onClick={() => selectGrade(grade.id)}
                  >
                    {grade.name}
                    {archived ? (
                      <StatusBadge
                        status="archived"
                        label={c("archivedBadge")}
                        className="setup-grade-chip__badge"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          {canManage && archiveVisibility !== "archived" ? (
            <div className="setup-grade-add-wrap">
              <button type="button" className="pds-type-body-s-semibold setup-grade-add" onClick={openCreateGrade}>
                <Icon name="add" />
                {setup("newGrade")}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {!visibleGrades.length ? (
        <EmptyState
          compact
          embedded
          icon="school"
          title={
            archiveVisibility === "archived" ? t("archivedGradesEmpty") : t("structureNoGrades")
          }
        />
      ) : !selectedGrade ? (
        <EmptyState compact embedded icon="school" title={t("structureNoGrades")} />
      ) : (
        <div className="setup-grade-layout">
          <aside className="setup-grade-sidebar">
            <div className="pds-type-title-xl-extrabold setup-grade-summary">
              <div className="setup-grade-summary__head">
                <div className="setup-grade-summary__title-row">
                  <h3 className="pds-type-title-xxs-extrabold">{selectedGrade.name}</h3>
                  {selectedGradeArchived ? (
                    <StatusBadge status="archived" label={c("archivedBadge")} />
                  ) : null}
                </div>
                {canManage ? (
                  <RowMoreActionsMenu
                    ariaLabel={c("moreActions")}
                    tone="inverse"
                    items={
                      selectedGradeArchived
                        ? [
                            {
                              id: "reactivate",
                              label: c("reactivate"),
                              icon: "unarchive",
                              onSelect: async () => {
                                await reactivateGrade.mutateAsync({ id: selectedGrade.id });
                                toastSuccess(t("gradeReactivated"));
                              }
                            }
                          ]
                        : [
                            {
                              id: "edit",
                              label: c("edit"),
                              icon: "edit",
                              onSelect: openEditGrade
                            },
                            {
                              id: "archive",
                              label: c("archive"),
                              icon: "inventory_2",
                              destructive: true,
                              onSelect: () => setDeletingGrade(selectedGrade)
                            }
                          ]
                    }
                  />
                ) : null}
              </div>
              {/* {stream ? <p className="pds-type-body-m-medium setup-grade-summary__stream">{stream}</p> : null} */}
              <div className="setup-grade-summary__chief">
                <span className="pds-type-label-s-medium setup-grade-summary__chief-label">{t("gradeChiefTitle")}</span>
                <strong className="pds-type-body-l-medium setup-grade-summary__chief-name">
                  {selectedGrade.gradeChiefName ?? t("gradeChiefUnassigned")}
                </strong>
              </div>
              <div className="setup-grade-summary__stats">
                <div>
                  <span className="pds-type-label-s-medium setup-grade-summary__stat-label">{setup("roomsStat")}</span>
                  <strong className="pds-type-display-m setup-grade-summary__stat-value">
                    {selectedGrade.classroomCount}
                  </strong>
                </div>
                <div>
                  <span className="pds-type-label-s-medium setup-grade-summary__stat-label">{setup("subjectsStat")}</span>
                  <strong className="pds-type-display-m setup-grade-summary__stat-value">
                    {selectedGrade.subjectCount}
                  </strong>
                </div>
              </div>
            </div>

            <div className="setup-subjects-offered">
              <p className="pds-type-label-s-medium setup-subjects-offered__label">{setup("subjectsOffered")}</p>
              {selectedGrade.subjects.length ? (
                <ul className="setup-subjects-offered__list">
                  {selectedGrade.subjects.map((subject) => {
                    const colors = subjectColor(subject.name);
                    return (
                      <li key={subject.id} className="setup-subjects-offered__item">
                        <span
                          className="setup-subjects-offered__dot"
                          style={{ background: colors.bg }}
                        />
                        <span className="pds-type-body-m-medium setup-subjects-offered__name">{subject.name}</span>
                        <Icon name={subjectIcon(subject.name)} className="pds-type-title-xs-bold setup-subjects-offered__icon" />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState compact embedded icon="menu_book" title={t("noSubjectsYet")} />
              )}
            </div>
          </aside>

          <section className="setup-classrooms-main">
            <div className="pds-type-title-xs-bold setup-classrooms-panel__head">
              <h3 className="pds-type-title-xxs-extrabold">{setup("classroomsInGrade", { grade: selectedGrade.name })}</h3>
              {canManage && !selectedGradeArchived && archiveVisibility !== "archived" ? (
                <button type="button" className="pds-type-body-m-bold btn-hero-primary" onClick={openCreateRoom}>
                  <Icon name="add" />
                  {setup("addRoom")}
                </button>
              ) : null}
            </div>

            {selectedGradeArchived ? (
              <p className="pds-type-body-s-regular muted setup-classrooms-panel__archived-note">
                {c("archivedViewOnly")}
              </p>
            ) : null}

            {classrooms.isLoading ? (
              <p className="pds-type-body-s-regular muted">{c("loading")}</p>
            ) : !visibleRooms.length ? (
              <EmptyState
                compact
                embedded
                icon="meeting_room"
                title={
                  archiveVisibility === "archived"
                    ? t("archivedClassroomsEmpty")
                    : t("structureNoRooms")
                }
              />
            ) : (
              <ul className="setup-classroom-list">
                {visibleRooms.map((room) => {
                  const roomArchived = isArchivedRecord(room.status);
                  const capacityLabel =
                    room.capacity != null
                      ? t("roomCapacityStudents", { capacity: room.capacity })
                      : t("roomStudentCount", { count: room.studentCount });
                  return (
                    <li
                      key={room.id}
                      className={cn(
                        "setup-classroom-card setup-classroom-card--clickable",
                        roomArchived && "setup-classroom-card--archived"
                      )}
                      tabIndex={0}
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
                      <div className="setup-classroom-card__top">
                        <div className="pds-type-title-s-extrabold setup-classroom-card__identity">
                          <span className="pds-type-title-s-extrabold setup-classroom-card__mark" aria-hidden>
                            {roomLetter(room.name)}
                          </span>
                          <div>
                            <div className="setup-classroom-card__title-row">
                              <h4>{room.name}</h4>
                              {roomArchived ? (
                                <StatusBadge status="archived" label={c("archivedBadge")} />
                              ) : null}
                            </div>
                            <p className="pds-type-body-s-semibold setup-classroom-card__meta">{capacityLabel}</p>
                          </div>
                        </div>
                        {canManage ? (
                          <RowMoreActionsMenu
                            ariaLabel={c("moreActions")}
                            items={
                              roomArchived
                                ? [
                                    {
                                      id: "view",
                                      label: c("view"),
                                      icon: "visibility",
                                      onSelect: () => router.push(`/dashboard/structure/rooms/${room.id}`)
                                    },
                                    {
                                      id: "reactivate",
                                      label: c("reactivate"),
                                      icon: "unarchive",
                                      onSelect: async () => {
                                        await reactivateRoom.mutateAsync({ id: room.id });
                                        toastSuccess(t("classroomReactivated"));
                                      }
                                    }
                                  ]
                                : [
                                    {
                                      id: "view",
                                      label: c("view"),
                                      icon: "visibility",
                                      onSelect: () => router.push(`/dashboard/structure/rooms/${room.id}`)
                                    },
                                    {
                                      id: "edit",
                                      label: c("edit"),
                                      icon: "edit",
                                      onSelect: () => openEditRoom(room)
                                    },
                                    {
                                      id: "archive",
                                      label: c("archive"),
                                      icon: "inventory_2",
                                      destructive: true,
                                      onSelect: () => setDeletingRoom(room)
                                    }
                                  ]
                            }
                          />
                        ) : null}
                      </div>
                      <div className="pds-type-body-m-medium setup-classroom-card__homeroom">
                        <Icon name="person" />
                        <div className="pds-type-body-s-regular setup-classroom-card__homeroom-text">
                          <p className="pds-type-label-s-bold setup-classroom-card__homeroom-label">
                            {t("homeroomTeacher")}
                          </p>
                          <p>
                            {room.classTeacherName ?? t("homeroomUnassigned")}
                          </p>
                        </div>
                        {canManage && !roomArchived ? (
                          <button
                            type="button"
                            className="pds-type-body-m-bold btn-ghost"
                            onClick={() => openEditRoom(room)}
                          >
                            {setup("changeHomeroom")}
                            <Icon name="chevron_right" className="pds-type-body-m-medium ms" />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <RecordFormSheet
        open={gradeFormMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setGradeFormMode(null);
            gradeForm.reset(gradeDefaultValues);
          }
        }}
        title={
          gradeFormMode?.type === "edit" ? t("editGradeTitle") : setup("addGradeWithRoomTitle")
        }
        onSubmit={gradeForm.handleSubmit(submitGrade)}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => {
                setGradeFormMode(null);
                gradeForm.reset(gradeDefaultValues);
              }}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={gradeForm.formState.isSubmitting}
            >
              <Icon name="check" />
              {gradeForm.formState.isSubmitting
                ? t("creating")
                : gradeFormMode?.type === "edit"
                  ? c("save")
                  : t("addGrade")}
            </button>
          </>
        }
      >
        <Field label={t("gradeName")} error={gradeForm.formState.errors.name?.message}>
          <FormInput type="text" placeholder={t("gradeNamePlaceholder")} {...gradeForm.register("name")} />
        </Field>
        <Field label={t("minAge")}>
          <FormInput type="number" min={0} {...gradeForm.register("minAge")} />
        </Field>
        <Field label={t("maxAge")}>
          <FormInput type="number" min={0} {...gradeForm.register("maxAge")} />
        </Field>
        <Field label={t("gradeChiefTitle")}>
          <PdsSelectField
            variant="form"
            value={gradeForm.watch("gradeChiefStaffId")}
            onValueChange={(value) =>
              gradeForm.setValue("gradeChiefStaffId", typeof value === "string" ? value : "", {
                shouldDirty: true
              })
            }
            placeholder={t("selectGradeChief")}
            options={(teachers.data?.data ?? []).map((member) => ({
              value: member.id,
              label: member.fullName
            }))}
          />
          <p className="pds-type-body-s-regular muted">{setup("gradeChiefHelp")}</p>
        </Field>
        <Field label={t("subjectsForGrade")}>
          <CheckboxList
            title={t("subjectsForGrade")}
            options={activeSubjects.map((s) => ({ id: s.id, label: s.name }))}
            selectedIds={selectedSubjectIds}
            onChange={(ids) => gradeForm.setValue("subjectIds", ids, { shouldDirty: true })}
            emptyTitle={t("noSubjectsYet")}
          />
        </Field>
        {gradeFormMode?.type === "create" ? (
          <>
            <p className="pds-type-body-s-regular setup-form-section-label">{setup("firstClassroomOptional")}</p>
            <Field label={t("classroomName")}>
              <FormInput type="text" placeholder={t("classroomNamePlaceholder")} {...gradeForm.register("roomName")} />
            </Field>
            <Field label={t("facilityRoom")}>
              <p className="pds-type-body-s-regular form-field-block__hint muted">{t("facilityRoomHint")}</p>
              <PdsSelectField
                variant="form"
                value={gradeForm.watch("facilityRoomId")}
                onValueChange={(value) =>
                  gradeForm.setValue("facilityRoomId", typeof value === "string" ? value : "", {
                    shouldDirty: true
                  })
                }
                placeholder={t("selectFacilityRoom")}
                options={(facilityRooms.data ?? []).map((room) => ({
                  value: room.id,
                  label:
                    room.capacity != null
                      ? t("facilityRoomOption", { name: room.name, capacity: room.capacity })
                      : room.name
                }))}
              />
            </Field>
          </>
        ) : null}
      </RecordFormSheet>

      <ClassroomFormSheet
        open={roomFormMode !== null}
        onOpenChange={(open) => {
          if (!open) setRoomFormMode(null);
        }}
        mode={roomFormMode?.type === "edit" ? "edit" : "create"}
        teachers={teachers.data?.data ?? []}
        facilityRooms={facilityRooms.data ?? []}
        initialValues={
          roomFormMode?.type === "edit"
            ? {
                name: roomFormMode.room.name,
                facilityRoomId: roomFormMode.room.facilityRoomId ?? "",
                classTeacherStaffId: roomFormMode.room.classTeacherStaffId ?? ""
              }
            : undefined
        }
        onSubmit={submitRoom}
      />

      <ConfirmDialog
        open={deletingGrade !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingGrade(null);
        }}
        title={t("archiveGradeTitle")}
        description={t("archiveGradeHelp", { name: deletingGrade?.name ?? "" })}
        confirmLabel={t("archive")}
        destructive
        loading={archiveGrade.isPending}
        onConfirm={async () => {
          if (!deletingGrade) return;
          await archiveGrade.mutateAsync({ id: deletingGrade.id });
          setDeletingGrade(null);
          if (selectedGradeId === deletingGrade.id) {
            setSelectedGradeId(null);
          }
        }}
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
        loading={archiveRoom.isPending}
        onConfirm={async () => {
          if (!deletingRoom) return;
          await archiveRoom.mutateAsync({ id: deletingRoom.id });
          setDeletingRoom(null);
        }}
      />
    </>
  );
}
