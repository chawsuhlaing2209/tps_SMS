"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "../../../../../components/shared/confirm-dialog";
import { EmptyState } from "../../../../../components/shared/empty-state";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { DetailHero } from "../../../../lib/detail-hero";
import { Icon } from "../../../../lib/material-icon";
import { appendNavigationTrail } from "../../../../lib/navigation-trail";
import { Button, EntityList, EntityListItem, EntityListPanel } from "../../../../../components/pds";
import { hasAnyPermission } from "../../../../lib/permissions";
import { getSession } from "../../../../lib/session";
import { toastSuccess } from "../../../../lib/toast";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { ClassroomFormSheet } from "../../classroom-form-sheet";
import { roomAccentColor, roomLetter } from "../../subject-colors";
import { PageHeader } from "../../../page-header-context";
import { ClassroomOpsTabs } from "../classroom-ops-tabs";
import { SubjectTeacherAssignmentSheet } from "../subject-teacher-assignment-sheet";
import { cn } from "../../../../../lib/utils";

type RoomDetail = {
  id: string;
  name: string;
  room: string | null;
  capacity: number | null;
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
  avgAttendanceRate: number | null;
  subjects: {
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
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

export default function StructureRoomPage() {
  const params = useParams<{ classroomId: string }>();
  const classroomId = params.classroomId;
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["classroom.manage", "academic_setup.manage"]);
  const currentYear = useCurrentAcademicYear();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assigningSubject, setAssigningSubject] = useState<SubjectRow | null>(null);

  const initialTab = searchParams.get("tab") === "attendance" ? "attendance" : "roster";

  const detail = useApiQuery<RoomDetail>(
    (tenant) => `/tenants/${tenant}/classrooms/${classroomId}/room-detail`
  );
  const teachers = useApiQuery<StaffMember[]>(
    (tenant) => `/tenants/${tenant}/hr/staff?employmentRole=teacher`
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

  if (currentYear.data && data.academicYearId !== currentYear.data.id) {
    return <EmptyState icon="event_busy" title={t("classroomWrongYear")} />;
  }

  const accent = roomAccentColor(data.name);
  const homeroom = data.homeroomTeacher;
  const structureBackHref = data.gradeId
    ? `/dashboard/structure?grade=${data.gradeId}`
    : "/dashboard/structure";

  const heroSubtitle = t("roomHeroSubtitle", {
    homeroom: homeroom?.fullName ?? t("homeroomUnassigned"),
    students: data.studentCount,
    room: data.room ?? "—"
  });

  return (
    <div className="structure-page">
      <PageHeader
        title={data.name}
        segment={{ label: data.name, href: `/dashboard/structure/rooms/${classroomId}` }}
        breadcrumbs={[
          { label: t("structureTitle"), href: structureBackHref },
          { label: data.gradeName ?? t("structureTitle"), href: structureBackHref },
          { label: data.name }
        ]}
      />

      <DetailHero
        title={data.name}
        meta={heroSubtitle}
        markText={roomLetter(data.name)}
        markColor={accent}
        utility={
          canManage ? (
            <>
              <button
                type="button"
                className="detail-hero__icon-btn"
                aria-label={t("editClassroom")}
                title={t("editClassroom")}
                onClick={() => setEditOpen(true)}
              >
                <Icon name="edit" size={20} />
              </button>
              <button
                type="button"
                className="detail-hero__icon-btn detail-hero__icon-btn--danger"
                aria-label={t("deleteClassroom")}
                title={t("deleteClassroom")}
                onClick={() => setDeleteOpen(true)}
              >
                <Icon name="delete" size={20} />
              </button>
            </>
          ) : null
        }
        actions={
          <>
            <Button buttonType="filled" buttonColor="primary" prefixIcon="fact_check" asChild>
              <Link href={`/dashboard/structure/rooms/${classroomId}?tab=attendance`}>
                {t("takeAttendance")}
              </Link>
            </Button>
            <Button buttonType="outlined" buttonColor="primary" prefixIcon="send" asChild>
              <Link href="/dashboard/communication">{t("messageGuardians")}</Link>
            </Button>
          </>
        }
      />

      <div className="structure-room-layout structure-room-layout--padauk">
        <EntityListPanel
          title={t("subjectsAndAssignments")}
          empty={!data.subjects.length ? t("noSubjectsYet") : undefined}
        >
          {data.subjects.length ? (
            <EntityList>
              {data.subjects.map((row) => (
                <EntityListItem
                  key={row.subjectId}
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
                    <div className="pds-entity-list-item__actions">
                      {canManage ? (
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
                      ) : null}
                      <Link
                        href={`/dashboard/structure/rooms/${classroomId}/subjects/${row.subjectId}`}
                        className="pds-type-body-s-semibold pds-entity-list-item__open-link"
                        onClick={() =>
                          appendNavigationTrail({
                            label: data.name,
                            href: `/dashboard/structure/rooms/${classroomId}`
                          })
                        }
                      >
                        {t("openSubjectShort")}
                      </Link>
                    </div>
                  }
                />
              ))}
            </EntityList>
          ) : null}
        </EntityListPanel>

        <aside className="structure-side-stack">
          <EntityListPanel
            title={t("homeroomTeacherLabel")}
            empty={!homeroom ? t("homeroomUnassigned") : undefined}
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
                />
              </EntityList>
            ) : null}
          </EntityListPanel>

          <section className="pds-type-body-m-medium structure-room-stats-card">
            <div>
              <strong>{data.studentCount}</strong>
              <span>{t("students")}</span>
            </div>
            <div>
              <strong>{data.avgAttendanceRate != null ? `${data.avgAttendanceRate}%` : "—"}</strong>
              <span>{t("avgAttendance")}</span>
            </div>
          </section>
        </aside>
      </div>

      <ClassroomOpsTabs
        classroomId={classroomId}
        classroomName={data.name}
        initialTab={initialTab}
      />

      {canManage ? (
        <>
          <ClassroomFormSheet
            open={editOpen}
            onOpenChange={setEditOpen}
            mode="edit"
            teachers={teachers.data ?? []}
            initialValues={{
              name: data.name,
              room: data.room ?? "",
              capacity: data.capacity ? String(data.capacity) : "",
              classTeacherStaffId: data.classTeacherStaffId ?? ""
            }}
            onSubmit={async (values) => {
              await updateRoom.mutateAsync({
                id: classroomId,
                name: values.name,
                room: values.room || null,
                capacity: values.capacity ? Number(values.capacity) : null,
                classTeacherStaffId: values.classTeacherStaffId || null
              });
              setEditOpen(false);
            }}
          />

          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={t("deleteClassroomTitle")}
            description={t("deleteClassroomHelp")}
            confirmLabel={t("deleteClassroom")}
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
            teachers={teachers.data ?? []}
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
