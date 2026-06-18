"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "../../../../../components/shared/confirm-dialog";
import { useApiMutation, useApiQuery } from "../../../../lib/api";
import { DetailHero } from "../../../../lib/detail-hero";
import { Icon } from "../../../../lib/icon";
import { RecordList, RecordListItem, RecordListPanel } from "../../../../lib/record-list";
import { hasAnyPermission } from "../../../../lib/permissions";
import { getSession } from "../../../../lib/session";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { ClassroomFormSheet } from "../../classroom-form-sheet";
import { roomAccentColor, roomLetter } from "../../subject-colors";
import { PageHeader } from "../../../page-header-context";
import { ClassroomOpsTabs } from "../classroom-ops-tabs";

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

  if (detail.isLoading || currentYear.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="structure-empty">
        <p className="error-text">{t("classroomNotFound")}</p>
        <Link href="/dashboard/structure">{t("backToStructure")}</Link>
      </div>
    );
  }

  const data = detail.data;

  if (currentYear.data && data.academicYearId !== currentYear.data.id) {
    return (
      <div className="structure-empty">
        <p className="muted">{t("classroomWrongYear")}</p>
        <Link href="/dashboard/structure">{t("backToStructure")}</Link>
      </div>
    );
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
        breadcrumbs={[
          { label: nav("group_academics") },
          { label: t("structureTitle"), href: structureBackHref }
        ]}
        backHref={structureBackHref}
        backLabel={t("backToGrade", { grade: data.gradeName ?? t("structureTitle") })}
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
                <Icon name="edit" size={18} />
              </button>
              <button
                type="button"
                className="detail-hero__icon-btn detail-hero__icon-btn--danger"
                aria-label={t("deleteClassroom")}
                title={t("deleteClassroom")}
                onClick={() => setDeleteOpen(true)}
              >
                <Icon name="delete" size={18} />
              </button>
            </>
          ) : null
        }
        actions={
          <>
            <Link
              href={`/dashboard/structure/rooms/${classroomId}?tab=attendance`}
              className="detail-hero__pill"
            >
              <Icon name="fact_check" size={18} />
              {t("takeAttendance")}
            </Link>
            <Link
              href="/dashboard/communication"
              className="detail-hero__pill detail-hero__pill--ghost"
            >
              <Icon name="send" size={18} />
              {t("messageGuardians")}
            </Link>
          </>
        }
      />

      <div className="structure-room-layout structure-room-layout--padauk">
        <RecordListPanel
          title={t("subjectsAndTeachers")}
          empty={!data.subjects.length ? t("noSubjectsYet") : undefined}
        >
          {data.subjects.length ? (
            <RecordList>
              {data.subjects.map((row) => (
                <RecordListItem
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
                  href={`/dashboard/structure/rooms/${classroomId}/subjects/${row.subjectId}`}
                  actionLabel={t("openSubjectShort")}
                />
              ))}
            </RecordList>
          ) : null}
        </RecordListPanel>

        <aside className="structure-side-stack">
          <RecordListPanel
            title={t("homeroomTeacherLabel")}
            empty={!homeroom ? t("homeroomUnassigned") : undefined}
          >
            {homeroom ? (
              <RecordList>
                <RecordListItem
                  initials={staffInitials(homeroom.fullName)}
                  nameForColor={homeroom.fullName}
                  title={homeroom.fullName}
                  meta={t("homeroomCardMeta", {
                    department: homeroom.department ?? t("staffDepartmentFallback"),
                    staffId: homeroom.employeeNumber ?? homeroom.id.slice(0, 8)
                  })}
                />
              </RecordList>
            ) : null}
          </RecordListPanel>

          <section className="structure-room-stats-card">
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
        </>
      ) : null}
    </div>
  );
}
