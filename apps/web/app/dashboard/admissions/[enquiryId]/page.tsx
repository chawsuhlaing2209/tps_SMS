"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState, use } from "react";
import { ApiError, useApiMutation, useApiQuery } from "../../../lib/api";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { PdsSelectField } from "../../../../components/pds";
import { EnrollmentWizard } from "../../enrollments/enrollment-wizard";
import { EmptyState } from "../../../../components/shared/empty-state";
import { StatusBadge } from "../../../../components/shared/badge";
import { PageHeader } from "../../page-header-context";
import { DataTableSection, TablePanelBody, TablePanelHead } from "../../../lib/table-panel";

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

const LEAD_STATUSES = [
  "new",
  "contacted",
  "visit_scheduled",
  "offered",
  "enrolled",
  "lost"
] as const;

const ACTIVITY_TYPES = ["call", "visit", "email", "note"] as const;

export default function EnquiryDetailPage({
  params
}: {
  params: Promise<{ enquiryId: string }>;
}) {
  const { enquiryId } = use(params);
  const t = useTranslations("admissions");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const [activityType, setActivityType] = useState<(typeof ACTIVITY_TYPES)[number]>("call");
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

  const statusOptions = useMemo(
    () =>
      LEAD_STATUSES.map((value) => ({
        value,
        label: t(`status_${value}` as "status_new")
      })),
    [t]
  );

  const activityOptions = useMemo(
    () =>
      ACTIVITY_TYPES.map((value) => ({
        value,
        label: t(`activity_${value}` as "activity_call")
      })),
    [t]
  );

  const activityColumns: ColumnDef<Activity, unknown>[] = [
    { id: "when", header: t("when"), accessorFn: (a) => new Date(a.createdAt).toLocaleString() },
    {
      id: "type",
      header: t("activityType"),
      accessorKey: "activityType",
      cell: ({ row }) => t(`activity_${row.original.activityType}` as "activity_call")
    },
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
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (enquiry.isError || !enquiry.data) {
    return (
      <div className="page-stack">
        <p className="pds-type-body-m-medium error-text">{t("notFound")}</p>
      </div>
    );
  }

  const data = enquiry.data;
  const enrollmentBlocked = data.status === "enrolled" || data.status === "lost";
  const enquiryHref = `/dashboard/admissions/${enquiryId}`;

  return (
    <div className="admission-detail-page">
      <PageHeader
        title={data.prospectiveStudentName}
        segment={{ label: data.prospectiveStudentName, href: enquiryHref }}
        breadcrumbs={[
          { label: nav("group_business") },
          { label: nav("admissions"), href: "/dashboard/admissions" },
          { label: data.prospectiveStudentName }
        ]}
      />

      <section className="admission-detail-summary">
        <dl className="detail-grid">
          <div>
            <dt className="pds-type-body-s-regular">{t("grade")}</dt>
            <dd>{data.targetGrade ?? "—"}</dd>
          </div>
          <div>
            <dt className="pds-type-body-s-regular">{c("status")}</dt>
            <dd>
              <StatusBadge status={data.status} label={t(`status_${data.status}` as "status_new")} />
            </dd>
          </div>
          <div>
            <dt className="pds-type-body-s-regular">{t("source")}</dt>
            <dd>{data.source}</dd>
          </div>
          <div>
            <dt className="pds-type-body-s-regular">{t("guardianName")}</dt>
            <dd>{data.guardianName ?? "—"}</dd>
          </div>
          <div>
            <dt className="pds-type-body-s-regular">{t("guardianPhone")}</dt>
            <dd>{data.guardianPhone ?? "—"}</dd>
          </div>
        </dl>
        {data.notes ? (
          <p className="pds-type-body-s-regular muted admission-detail-summary__notes">{data.notes}</p>
        ) : null}
      </section>

      <DataTableSection>
        <TablePanelHead help={!enrollmentBlocked ? t("startEnrollmentHelp") : undefined} />
        <TablePanelBody>
          <div className="entity-form">
            <Field label={c("status")}>
              <PdsSelectField
                variant="form"
                value={status || data.status}
                onValueChange={(value) => setStatus(typeof value === "string" ? value : "")}
                options={statusOptions}
              />
            </Field>
            <div className="form-actions form-actions--inline">
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                disabled={update.isPending}
                onClick={() => void update.mutateAsync({ status: status || data.status })}
              >
                <Icon name="check" />
                {update.isPending ? c("loading") : t("saveStatus")}
              </button>
              <button
                type="button"
                className="pds-type-body-m-bold btn-ghost"
                disabled={startEnrollment.isPending || enrollmentBlocked}
                onClick={() => void openEnrollmentWizard()}
              >
                <Icon name="how_to_reg" />
                {startEnrollment.isPending ? c("loading") : t("startEnrollmentCeremony")}
              </button>
            </div>
            {startError ? (
              <p className="pds-type-body-m-medium error-text" role="alert">
                {startError}
              </p>
            ) : null}
          </div>
        </TablePanelBody>
      </DataTableSection>

      <DataTableSection>
        <div className="dash-page-title">
          <h2 className="pds-type-title-xs-bold dash-page-title__heading">{t("activitiesTitle")}</h2>
        </div>
        <p className="pds-type-body-s-regular muted">{t("activitiesHelp")}</p>
        <TablePanelBody>
          <div className="entity-form">
            <Field label={t("activityType")}>
              <PdsSelectField
                variant="form"
                value={activityType}
                onValueChange={(value) =>
                  setActivityType(
                    typeof value === "string" && ACTIVITY_TYPES.includes(value as (typeof ACTIVITY_TYPES)[number])
                      ? (value as (typeof ACTIVITY_TYPES)[number])
                      : "call"
                  )
                }
                options={activityOptions}
              />
            </Field>
            <Field label={t("notes")}>
              <textarea rows={2} value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} />
            </Field>
            <div className="form-actions form-actions--inline">
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                disabled={!activityNotes.trim() || addActivity.isPending}
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
            <EmptyState compact embedded icon="history" title={t("noActivities")} />
          )}
        </TablePanelBody>
      </DataTableSection>

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
