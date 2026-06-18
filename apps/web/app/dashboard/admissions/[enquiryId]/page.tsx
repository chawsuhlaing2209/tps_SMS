"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ApiError, useApiMutation, useApiQuery } from "../../../lib/api";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/icon";
import { EnrollmentWizard } from "../../enrollments/enrollment-wizard";
import { PageHeader } from "../../page-header-context";

type Activity = {
  id: string;
  activityType: string;
  notes: string;
  createdAt: string;
};

type EnquiryDetail = {
  id: string;
  prospectiveStudentName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  targetGrade: string | null;
  status: string;
  source: string;
  notes: string | null;
  activities: Activity[];
};

type Grade = { id: string; name: string };
type Classroom = { id: string; name: string; gradeId: string; academicYearId: string };

type StartEnrollmentResult = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  academicYearId: string;
  gradeId: string;
  classroomId: string | null;
  enquiryId: string;
  status: string;
};

type EnquiryDraft = {
  id: string;
  studentId: string;
  classroomId: string | null;
  academicYearId: string;
  gradeId: string;
};

export default function EnquiryDetailPage() {
  const params = useParams<{ enquiryId: string }>();
  const enquiryId = params.enquiryId;
  const t = useTranslations("admissions");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const [activityType, setActivityType] = useState("call");
  const [activityNotes, setActivityNotes] = useState("");
  const [status, setStatus] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDraft, setWizardDraft] = useState<EnquiryDraft | null>(null);
  const [studentDisplayName, setStudentDisplayName] = useState("");
  const [startError, setStartError] = useState<string | null>(null);

  const currentYear = useCurrentAcademicYear();
  const grades = useApiQuery<Grade[]>((tenant) => `/tenants/${tenant}/academics/grades`);
  const classrooms = useApiQuery<Classroom[]>((tenant) => `/tenants/${tenant}/classrooms`);

  const enquiry = useApiQuery<EnquiryDetail>(
    (tenant) => `/tenants/${tenant}/admissions/enquiries/${enquiryId}`
  );

  const addActivity = useApiMutation<{ activityType: string; notes: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/admissions/enquiries/${enquiryId}/activities`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/admissions/enquiries/${enquiryId}`] }
  );

  const update = useApiMutation<{ status: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/admissions/enquiries/${enquiryId}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/admissions/enquiries/${enquiryId}`] }
  );

  const startEnrollment = useApiMutation<Record<string, never>, StartEnrollmentResult>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/admissions/enquiries/${enquiryId}/start-enrollment`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/admissions/enquiries/${enquiryId}`,
        `/tenants/${tenant}/enrollments`
      ]
    }
  );

  const activityColumns: ColumnDef<Activity, unknown>[] = [
    { id: "when", header: t("when"), accessorFn: (a) => new Date(a.createdAt).toLocaleString() },
    { id: "type", header: t("activityType"), accessorKey: "activityType" },
    { id: "notes", header: t("notes"), accessorKey: "notes" }
  ];

  const openEnrollmentWizard = async () => {
    setStartError(null);
    try {
      const result = await startEnrollment.mutateAsync({});
      setWizardDraft({
        id: result.enrollmentId,
        studentId: result.studentId,
        classroomId: result.classroomId,
        academicYearId: result.academicYearId,
        gradeId: result.gradeId
      });
      setStudentDisplayName(result.studentName);
      setWizardOpen(true);
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  if (enquiry.isLoading) {
    return <p className="muted">{c("loading")}</p>;
  }

  if (enquiry.isError || !enquiry.data) {
    return (
      <div className="page-stack">
        <p className="error-text">{t("notFound")}</p>
        <Link href="/dashboard/admissions">{t("backToList")}</Link>
      </div>
    );
  }

  const data = enquiry.data;
  const enrollmentBlocked = data.status === "enrolled" || data.status === "lost";

  return (
    <div className="page-stack">
      <PageHeader
        title={data.prospectiveStudentName}
        breadcrumbs={[
          { label: nav("group_business") },
          { label: nav("admissions"), href: "/dashboard/admissions" }
        ]}
        backHref="/dashboard/admissions"
        backLabel={t("backToList")}
      />
      <p className="muted">
        {t("grade")}: {data.targetGrade ?? "—"} · {c("status")}: {data.status}
      </p>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("updateStatus")}</h2>
        </div>
        <div className="entity-form">
          <Field label={c("status")}>
            <select value={status || data.status} onChange={(e) => setStatus(e.target.value)}>
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="visit_scheduled">visit_scheduled</option>
              <option value="offered">offered</option>
              <option value="enrolled">enrolled</option>
              <option value="lost">lost</option>
            </select>
          </Field>
          <div className="form-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={update.isPending}
              onClick={() => void update.mutateAsync({ status: status || data.status })}
            >
              <Icon name="check" />
              {update.isPending ? c("loading") : t("saveStatus")}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={startEnrollment.isPending || enrollmentBlocked}
              onClick={() => void openEnrollmentWizard()}
            >
              <Icon name="how_to_reg" />
              {startEnrollment.isPending ? c("loading") : t("startEnrollmentCeremony")}
            </button>
          </div>
          {startError ? (
            <p className="error-text" role="alert">
              {startError}
            </p>
          ) : null}
          {!enrollmentBlocked ? <p className="muted panel-help">{t("startEnrollmentHelp")}</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("addActivity")}</h2>
        </div>
        <div className="entity-form">
          <Field label={t("activityType")}>
            <select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
              <option value="call">call</option>
              <option value="visit">visit</option>
              <option value="email">email</option>
              <option value="note">note</option>
            </select>
          </Field>
          <Field label={t("notes")}>
            <textarea rows={2} value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} />
          </Field>
          <div className="form-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={!activityNotes || addActivity.isPending}
              onClick={() => {
                void addActivity.mutateAsync({ activityType, notes: activityNotes }).then(() => {
                  setActivityNotes("");
                });
              }}
            >
              <Icon name="add" />
              {addActivity.isPending ? c("loading") : t("addActivityButton")}
            </button>
          </div>
        </div>
        {data.activities.length ? (
          <DataTable columns={activityColumns} data={data.activities} />
        ) : (
          <p className="muted">{t("noActivities")}</p>
        )}
      </section>

      <EnrollmentWizard
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) {
            setWizardDraft(null);
            setStudentDisplayName("");
          }
        }}
        classrooms={classrooms.data}
        grades={grades.data}
        academicYears={currentYear.data ? [currentYear.data] : undefined}
        initialDraft={wizardDraft}
        initialStudentId={wizardDraft?.studentId ?? null}
        lockStudent
        studentDisplayName={studentDisplayName}
        extraInvalidatePaths={(tenant) => [
          `/tenants/${tenant}/admissions/enquiries/${enquiryId}`,
          `/tenants/${tenant}/students`
        ]}
        onSaved={() => void enquiry.refetch()}
      />
    </div>
  );
}
