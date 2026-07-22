"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, use } from "react";
import { ConfirmDialog } from "../../../../../components/shared/confirm-dialog";
import { NavigationBackLink } from "../../../../../components/shared/navigation-back-link";
import { EmptyState } from "../../../../../components/shared/empty-state";
import { StatusBadge } from "../../../../../components/shared/badge";
import { useApiMutation, useApiQuery, useReferenceApiQuery } from "../../../../lib/api";
import { isArchivedRecord } from "../../../../lib/archive-filter";
import { DetailHero } from "../../../../lib/detail-hero";
import { HeroMoreActionsMenu } from "../../../../lib/hero-more-actions";
import { Icon } from "../../../../lib/material-icon";
import { Button, EntityList, EntityListItem, EntityListPanel } from "../../../../../components/pds";
import { hasAnyPermission } from "../../../../lib/permissions";
import { getSession } from "../../../../lib/session";
import { toastSuccess } from "../../../../lib/toast";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { ClassroomFormSheet, type FacilityRoomOption } from "../../classroom-form-sheet";
import { roomAccentColor, roomLetter, subjectColor, subjectIcon } from "../../subject-colors";
import { PageHeader } from "../../../page-header-context";
import { ClassroomOpsTabs } from "../classroom-ops-tabs";
import { SubjectTeacherAssignmentSheet } from "../subject-teacher-assignment-sheet";
import { cn } from "../../../../../lib/utils";

type RoomDetail = {
  id: string;
  name: string;
  room: string | null;
  capacity: number | null;
  facilityRoomId: string | null;
  status: string;
  gradeId: string;
  gradeName: string | null;
  academicYearId: string;
  academicYearName: string | null;
  classTeacherStaffId: string | null;
  homeroomTeacher: {
    id: string;
    fullName: string;
    department: string | null;
    employeeNumber: string | null;
  } | null;
  studentCount: number;
  subjects: {
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    subjectColorKey: string | null;
    teacherStaffId: string | null;
    teacherName: string | null;
    periodsPerWeek: number;
  }[];
};

type StaffMember = { id: string; fullName: string };

type SubjectRow = RoomDetail["subjects"][number];

const CLASSROOMS_PATH = (tenant: string) => `/tenants/${tenant}/classrooms`;

function staffInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function StructureRoomPage({
  params
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const { classroomId } = use(params);
  const router = useRouter();
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["classroom.manage", "academic_setup.manage"]);
  const currentYear = useCurrentAcademicYear();

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [assigningSubject, setAssigningSubject] = useState<SubjectRow | null>(null);


  const detail = useApiQuery<RoomDetail>(
    (tenant) => `/tenants/${tenant}/classrooms/${classroomId}/room-detail`
  );
  const homeroomTeachers = useApiQuery<{ data: StaffMember[] }>((tenant) => {
    if (!canManage || !detail.data?.gradeId) {
      return null;
    }
    const params = new URLSearchParams({
      employmentRole: "teacher",
      eligibleGradeId: detail.data.gradeId,
      limit: "200"
    });
    if (detail.data.classTeacherStaffId) {
      params.set("includeStaffId", detail.data.classTeacherStaffId);
    }
    return `/tenants/${tenant}/hr/staff?${params.toString()}`;
  });
  const eligibleSubjectTeachers = useApiQuery<{ data: StaffMember[] }>((tenant) => {
    if (!assigningSubject) {
      return null;
    }
    const include =
      assigningSubject.teacherStaffId != null
        ? `?includeStaffId=${assigningSubject.teacherStaffId}`
        : "";
    return `/tenants/${tenant}/classrooms/${classroomId}/subjects/${assigningSubject.subjectId}/eligible-teachers${include}`;
  });
  const facilityRooms = useReferenceApiQuery<FacilityRoomOption[]>((tenant) =>
    canManage ? `/tenants/${tenant}/facility-rooms/active` : null
  );

  const invalidatePaths = useMemo(() => {
    const yearId = detail.data?.academicYearId ?? currentYear.data?.id ?? "";
    const gradeId = detail.data?.gradeId ?? "";
    return (_: unknown, tenant: string) =>
      yearId && gradeId
        ? [
            `/tenants/${tenant}/classrooms/${classroomId}/room-detail`,
            `/tenants/${tenant}/classrooms/${classroomId}`,
            `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades/${gradeId}/classrooms`,
            `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`,
            `/tenants/${tenant}/academics/setup/academic-years`
          ]
        : [`/tenants/${tenant}/classrooms/${classroomId}/room-detail`];
  }, [classroomId, currentYear.data?.id, detail.data?.academicYearId, detail.data?.gradeId]);

  const updateRoom = useApiMutation<{ id: string } & Record<string, unknown>>(
    (body, tenant) => {
      const { id, ...payload } = body;
      return {
        path: `${CLASSROOMS_PATH(tenant)}/${id}`,
        init: { method: "PATCH", body: JSON.stringify(payload) }
      };
    },
    { invalidatePaths }
  );

  const archiveRoom = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${CLASSROOMS_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths }
  );

  const reactivateRoom = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${CLASSROOMS_PATH(tenant)}/${id}/reactivate`,
      init: { method: "POST" }
    }),
    { invalidatePaths }
  );

  const assignSubjectTeacher = useApiMutation<
    { subjectId: string; teacherStaffId: string | null },
    unknown
  >(
    (body, tenant) => ({
      path: `${CLASSROOMS_PATH(tenant)}/${classroomId}/subjects/${body.subjectId}/teacher`,
      init: {
        method: "PATCH",
        body: JSON.stringify({ teacherStaffId: body.teacherStaffId })
      }
    }),
    { invalidatePaths }
  );

  if (detail.isLoading || currentYear.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (detail.isError || !detail.data) {
    return <EmptyState icon="error" title={t("classroomNotFound")} />;
  }

  const data = detail.data;
  const isArchived = isArchivedRecord(data.status);
  const canEdit = canManage && !isArchived;

  if (currentYear.data && data.academicYearId !== currentYear.data.id) {
    return <EmptyState icon="event_busy" title={t("classroomWrongYear")} />;
  }

  const accent = roomAccentColor(data.name);
  const homeroom = data.homeroomTeacher;
  const structureBackHref = data.gradeId
    ? `/dashboard/structure?grade=${data.gradeId}`
    : "/dashboard/structure";

  const locationLabel = data.room ?? "—";
  const heroMeta = t("roomDetailMeta", {
    students: data.studentCount,
    room: locationLabel
  });

  const heroMoreActions = canEdit
    ? [
        {
          id: "edit",
          label: t("editClassroom"),
          icon: "edit",
          onSelect: () => setEditOpen(true)
        },
        {
          id: "archive",
          label: t("archiveClassroom"),
          icon: "inventory_2",
          destructive: true,
          onSelect: () => setArchiveOpen(true)
        }
      ]
    : [];

  return (
    <div className="structure-page structure-room-page">
      <PageHeader
        title={data.name}
        segment={{ label: data.name, href: `/dashboard/structure/rooms/${classroomId}` }}
        breadcrumbs={[
          { label: t("structureTitle"), href: structureBackHref },
          { label: data.gradeName ?? t("structureTitle"), href: structureBackHref },
          { label: data.name }
        ]}
        actionsPortal
      />

      <NavigationBackLink fallback={{ label: t("structureTitle"), href: structureBackHref }} />

      {isArchived ? (
        <div className="archived-record-banner">
          <StatusBadge status="archived" label={c("archivedBadge")} />
          <p className="pds-type-body-s-regular archived-record-banner__text">{c("archivedViewOnly")}</p>
          {canManage ? (
            <button
              type="button"
              className="pds-type-body-m-bold btn-primary"
              disabled={reactivateRoom.isPending}
              onClick={async () => {
                await reactivateRoom.mutateAsync({ id: classroomId });
                toastSuccess(t("classroomReactivated"));
              }}
            >
              {reactivateRoom.isPending ? c("reactivating") : c("reactivate")}
            </button>
          ) : null}
        </div>
      ) : null}

      <DetailHero
        variant="classroom"
        eyebrow={t("roomStudentCount", { count: data.studentCount })}
        title={data.name}
        meta={heroMeta}
        markText={roomLetter(data.name)}
        markColor={accent}
        actions={
          <>
            {heroMoreActions.length ? (
              <HeroMoreActionsMenu label={c("moreActions")} items={heroMoreActions} />
            ) : null}
          </>
        }
      />

      <div className="structure-room-layout structure-room-layout--padauk">
        <EntityListPanel
          title={t("subjectsAndAssignedTeachers")}
          variant="panel"
          className="structure-room-subjects-panel"
          empty={!data.subjects.length ? t("noSubjectsYet") : undefined}
        >
          {data.subjects.length ? (
            <EntityList className="pds-entity-list--compact">
              {data.subjects.map((row) => {
                const tint = subjectColor(row.subjectName, row.subjectColorKey);
                return (
                  <EntityListItem
                    key={row.subjectId}
                    icon={subjectIcon(row.subjectName)}
                    color={tint.bg}
                    nameForColor={row.subjectName}
                    title={row.subjectName}
                    meta={
                      row.teacherName
                        ? t("subjectTeacherMeta", {
                            teacher: row.teacherName,
                            periods: row.periodsPerWeek
                          })
                        : t("teacherUnassigned")
                    }
                    trailing={
                      canEdit ? (
                        <button
                          type="button"
                          className={cn(
                            "pds-entity-list-item__icon-btn",
                            assigningSubject?.subjectId === row.subjectId &&
                              "pds-entity-list-item__icon-btn--active"
                          )}
                          aria-label={t("assignSubjectTeacher")}
                          title={t("assignSubjectTeacher")}
                          onClick={() => setAssigningSubject(row)}
                        >
                          <Icon name="edit" size={18} />
                        </button>
                      ) : null
                    }
                  />
                );
              })}
            </EntityList>
          ) : null}
        </EntityListPanel>

        <aside className="structure-side-stack">
          <EntityListPanel
            title={t("homeroomTeacherLabel")}
            titlePlacement="inside-eyebrow"
            empty={!homeroom ? t("homeroomUnassigned") : undefined}
            emptyAction={
              !homeroom && canEdit ? (
                <button
                  type="button"
                  className="pds-type-body-s-semibold btn-ghost"
                  onClick={() => setEditOpen(true)}
                >
                  <Icon name="edit" size={16} />
                  {t("assignHomeroom")}
                </button>
              ) : undefined
            }
          >
            {homeroom ? (
              <EntityList>
                <EntityListItem
                  initials={staffInitials(homeroom.fullName)}
                  nameForColor={homeroom.fullName}
                  title={homeroom.fullName}
                  meta={t("homeroomCardMeta", {
                    department: homeroom.department ?? t("staffDepartmentFallback"),
                    staffId: homeroom.employeeNumber ?? homeroom.id.slice(0, 8)
                  })}
                  trailing={
                    canEdit ? (
                      <button
                        type="button"
                        className="pds-entity-list-item__icon-btn"
                        aria-label={t("editHomeroom")}
                        title={t("editHomeroom")}
                        onClick={() => setEditOpen(true)}
                      >
                        <Icon name="edit" size={18} />
                      </button>
                    ) : undefined
                  }
                />
              </EntityList>
            ) : null}
          </EntityListPanel>

          <section className="pds-type-body-m-medium structure-room-stats-card">
            <div>
              <strong>{data.studentCount}</strong>
              <span>{t("students")}</span>
            </div>
          </section>
        </aside>
      </div>

      <div className="structure-room-ops">
        <ClassroomOpsTabs classroomId={classroomId} classroomName={data.name} />
      </div>

      {canEdit ? (
        <>
          <ClassroomFormSheet
            open={editOpen}
            onOpenChange={setEditOpen}
            mode="edit"
            teachers={homeroomTeachers.data?.data ?? []}
            facilityRooms={facilityRooms.data ?? []}
            initialValues={{
              name: data.name,
              facilityRoomId: data.facilityRoomId ?? "",
              classTeacherStaffId: data.classTeacherStaffId ?? ""
            }}
            onSubmit={async (values) => {
              await updateRoom.mutateAsync({
                id: classroomId,
                name: values.name,
                facilityRoomId: values.facilityRoomId || null,
                classTeacherStaffId: values.classTeacherStaffId || null
              });
              setEditOpen(false);
            }}
          />

          <ConfirmDialog
            open={archiveOpen}
            onOpenChange={setArchiveOpen}
            title={t("archiveClassroomTitle")}
            description={t("archiveClassroomHelp")}
            confirmLabel={t("archiveClassroom")}
            destructive
            onConfirm={async () => {
              await archiveRoom.mutateAsync({ id: classroomId });
              router.push(structureBackHref);
            }}
          />

          <SubjectTeacherAssignmentSheet
            open={Boolean(assigningSubject)}
            onOpenChange={(open) => {
              if (!open) {
                setAssigningSubject(null);
              }
            }}
            subjectName={assigningSubject?.subjectName ?? ""}
            teachers={eligibleSubjectTeachers.data?.data ?? []}
            initialTeacherStaffId={assigningSubject?.teacherStaffId}
            submitting={assignSubjectTeacher.isPending}
            onSubmit={async (values) => {
              if (!assigningSubject) {
                return;
              }
              await assignSubjectTeacher.mutateAsync({
                subjectId: assigningSubject.subjectId,
                teacherStaffId: values.teacherStaffId.trim() ? values.teacherStaffId : null
              });
              toastSuccess(t("subjectTeacherSaved"));
              setAssigningSubject(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
