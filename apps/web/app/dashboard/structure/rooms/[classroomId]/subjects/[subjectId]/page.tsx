"use client";

import { useTranslations } from "next-intl";
import { use } from "react";
import { useApiQuery } from "../../../../../../lib/api";
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

  const subjectRow = subjects.data?.find((row) => row.subjectId === subjectId);
  const grade = grades.data?.find((row) => row.id === classroom.data?.gradeId);
  const teacherName = subjectRow?.teacherStaffId
    ? (staff.data?.data?.find((member) => member.id === subjectRow.teacherStaffId)?.fullName ?? "—")
    : "—";

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
    </div>
  );
}
