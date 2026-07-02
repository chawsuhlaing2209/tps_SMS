"use client";

import { useTranslations } from "next-intl";
import { useMemo, use } from "react";
import { useApiQuery } from "../../../../../../lib/api";
import { RecordList, RecordListItem, RecordListPanel } from "../../../../../../lib/record-list";
import { useCurrentAcademicYear } from "../../../../../../lib/use-current-academic-year";
import { PageHeader } from "../../../../../page-header-context";
import { EmptyState } from "../../../../../../../components/shared/empty-state";
import { NavigationBackLink } from "../../../../../../../components/shared/navigation-back-link";
import { subjectColor } from "../../../../subject-colors";

type Classroom = {
  id: string;
  name: string;
  gradeId: string;
  academicYearId: string;
};

type Grade = { id: string; name: string };

type ClassroomSubject = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherStaffId: string | null;
};

type LearningMaterial = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
};

type Assignment = {
  id: string;
  title: string;
  subjectId: string;
  instructions: string | null;
  dueAt: string | null;
};

type StaffMember = { id: string; fullName: string };

export default function StructureSubjectClassroomPage({
  params
}: {
  params: Promise<{ classroomId: string; subjectId: string }>;
}) {
  const { classroomId, subjectId } = use(params);
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const currentYear = useCurrentAcademicYear();

  const classroom = useApiQuery<Classroom>((tenant) => `/tenants/${tenant}/classrooms/${classroomId}`);
  const grades = useApiQuery<Grade[]>((tenant) => `/tenants/${tenant}/academics/grades`);
  const subjects = useApiQuery<ClassroomSubject[]>((tenant) =>
    `/tenants/${tenant}/classrooms/${classroomId}/subjects`
  );
  const staff = useApiQuery<{ data: StaffMember[] }>((tenant) =>
    `/tenants/${tenant}/hr/staff?employmentRole=teacher&limit=200`
  );
  const materials = useApiQuery<LearningMaterial[]>((tenant) =>
    `/tenants/${tenant}/lms/classrooms/${classroomId}/materials`
  );
  const assignments = useApiQuery<Assignment[]>((tenant) =>
    `/tenants/${tenant}/lms/classrooms/${classroomId}/assignments`
  );

  const subjectRow = subjects.data?.find((row) => row.subjectId === subjectId);
  const grade = grades.data?.find((row) => row.id === classroom.data?.gradeId);
  const teacherName = subjectRow?.teacherStaffId
    ? (staff.data?.data?.find((member) => member.id === subjectRow.teacherStaffId)?.fullName ?? "—")
    : "—";

  const subjectMaterials = useMemo(
    () => (materials.data ?? []).filter((row) => row.subjectId === subjectId),
    [materials.data, subjectId]
  );

  const subjectAssignments = useMemo(
    () => (assignments.data ?? []).filter((row) => row.subjectId === subjectId),
    [assignments.data, subjectId]
  );

  if (classroom.isLoading || subjects.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (classroom.isError || !classroom.data || !subjectRow) {
    return <EmptyState icon="error" title={t("subjectNotFound")} />;
  }

  const colors = subjectColor(subjectRow.subjectName);

  return (
    <div className="structure-page">
      <PageHeader
        title={subjectRow.subjectName}
        segment={{
          label: subjectRow.subjectName,
          href: `/dashboard/structure/rooms/${classroomId}/subjects/${subjectId}`
        }}
        breadcrumbs={[
          { label: t("structureTitle"), href: "/dashboard/structure" },
          {
            label: classroom.data.name,
            href: `/dashboard/structure/rooms/${classroomId}`
          },
          { label: subjectRow.subjectName }
        ]}
      />

      <NavigationBackLink
        fallback={{
          label: classroom.data.name,
          href: `/dashboard/structure/rooms/${classroomId}`
        }}
      />

      <section className="structure-room-hero">
        <span
          className="pds-type-body-m-medium structure-subject-tag structure-subject-tag--icon structure-room-card__mark--lg"
          style={{ background: colors.bg, color: colors.text }}
        >
          {subjectRow.subjectName.charAt(0)}
        </span>
        <div>
          <p className="pds-type-caption-m structure-eyebrow">
            {currentYear.data?.name ?? "—"} · {grade?.name ?? "—"} · {classroom.data.name}
          </p>
          <h2 className="pds-type-title-m-extrabold structure-page-title">{subjectRow.subjectName}</h2>
          <p className="pds-type-body-s-regular muted">
            {t("subjectClassroomMeta", {
              teacher: teacherName,
              code: subjectRow.subjectCode ?? "—"
            })}
          </p>
        </div>
      </section>

      <div className="structure-room-layout">
        <RecordListPanel
          title={t("materialsTitle")}
          empty={!subjectMaterials.length ? t("noMaterialsYet") : undefined}
        >
          {subjectMaterials.length ? (
            <RecordList>
              {subjectMaterials.map((material) => (
                <RecordListItem
                  key={material.id}
                  icon="description"
                  nameForColor={subjectRow.subjectName}
                  title={material.title}
                  meta={material.description ?? undefined}
                />
              ))}
            </RecordList>
          ) : null}
        </RecordListPanel>

        <aside className="structure-side-stack">
          <section className="panel structure-panel--accent">
            <p className="pds-type-caption-s structure-stat-card__label">{t("assignmentsTitle")}</p>
            <strong className="pds-type-title-l-extrabold structure-stat-card__value">{subjectAssignments.length}</strong>
            <span className="pds-type-body-s-regular muted">{t("assignmentsHelp")}</span>
          </section>
        </aside>
      </div>

      {subjectAssignments.length ? (
        <RecordListPanel title={t("assignmentsTitle")}>
          <RecordList>
            {subjectAssignments.map((assignment) => (
              <RecordListItem
                key={assignment.id}
                icon="assignment"
                nameForColor={subjectRow.subjectName}
                title={assignment.title}
                meta={
                  assignment.dueAt
                    ? t("dueOn", { date: new Date(assignment.dueAt).toLocaleDateString() })
                    : t("noDueDate")
                }
              />
            ))}
          </RecordList>
        </RecordListPanel>
      ) : null}
    </div>
  );
}
