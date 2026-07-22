"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, use } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../../lib/api";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { useTenantFormats } from "../../../lib/use-tenant-formats";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { FormInput, TextAreaInput } from "../../../../components/shared/form-input";
import { PdsSelectField } from "../../../../components/pds";
import { EnrollmentWizard } from "../../enrollments/enrollment-wizard";
import { EmptyState } from "../../../../components/shared/empty-state";
import { PageHeader } from "../../page-header-context";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { AddActivityModal } from "./_components/add-activity-modal";
import "./admission-detail-page.css";

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

type EditValues = {
  prospectName: string;
  guardianName: string;
  guardianPhone: string;
  interestedGrade: string;
  source: string;
  notes: string;
};

const LEAD_STATUSES = [
  "new",
  "contacted",
  "visit_scheduled",
  "offered",
  "enrolled",
  "lost",
] as const;

function formatSourceLabel(source: string) {
  return source
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

export default function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ enquiryId: string }>;
}) {
  const { enquiryId } = use(params);
  const t = useTranslations("admissions");
  const c = useTranslations("common");
  const nav = useTranslations("nav");
  const { formatDateTime } = useTenantFormats();
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDraft, setWizardDraft] = useState<EnquiryDraft | null>(null);
  const [studentDisplayName, setStudentDisplayName] = useState("");
  const [startError, setStartError] = useState<string | null>(null);

  const currentYear = useCurrentAcademicYear();
  const grades = useApiQuery<Grade[]>((tenant) => `/tenants/${tenant}/academics/grades`);
  const classrooms = useApiQuery<Classroom[]>((tenant) => `/tenants/${tenant}/classrooms`);

  const enquiry = useApiQuery<EnquiryDetail>(
    (tenant) => `/tenants/${tenant}/admissions/enquiries/${enquiryId}`,
  );

  const addActivity = useApiMutation<{ activityType: string; notes: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/admissions/enquiries/${enquiryId}/activities`,
      init: { method: "POST", body: JSON.stringify(body) },
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/admissions/enquiries/${enquiryId}`] },
  );

  const update = useApiMutation<Partial<EditValues> & { status?: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/admissions/enquiries/${enquiryId}`,
      init: { method: "PATCH", body: JSON.stringify(body) },
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/admissions/enquiries/${enquiryId}`] },
  );

  const startEnrollment = useApiMutation<Record<string, never>, StartEnrollmentResult>(
    (_body, tenant) => ({
      path: `/tenants/${tenant}/admissions/enquiries/${enquiryId}/start-enrollment`,
      init: { method: "POST", body: JSON.stringify({}) },
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/admissions/enquiries/${enquiryId}`,
        `/tenants/${tenant}/enrollments`,
      ],
    },
  );

  const editSchema = z.object({
    prospectName: z.string().trim().min(1, c("required")),
    guardianName: z.string(),
    guardianPhone: z.string(),
    interestedGrade: z.string(),
    source: z.string().trim().min(1, c("required")),
    notes: z.string(),
  });

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      prospectName: "",
      guardianName: "",
      guardianPhone: "",
      interestedGrade: "",
      source: "",
      notes: "",
    },
  });

  const statusOptions = useMemo(
    () =>
      LEAD_STATUSES.map((value) => ({
        value,
        label: t(`status_${value}` as "status_new"),
      })),
    [t],
  );

  const openEnrollmentWizard = async () => {
    setStartError(null);
    try {
      const result = await startEnrollment.mutateAsync({});
      setWizardDraft({
        id: result.enrollmentId,
        studentId: result.studentId,
        classroomId: result.classroomId,
        academicYearId: result.academicYearId,
        gradeId: result.gradeId,
      });
      setStudentDisplayName(result.studentName);
      setWizardOpen(true);
    } catch (error) {
      setStartError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  };

  const openEditSheet = () => {
    if (!enquiry.data) return;
    editForm.reset({
      prospectName: enquiry.data.prospectiveStudentName,
      guardianName: enquiry.data.guardianName ?? "",
      guardianPhone: enquiry.data.guardianPhone ?? "",
      interestedGrade: enquiry.data.targetGrade ?? "",
      source: enquiry.data.source,
      notes: enquiry.data.notes ?? "",
    });
    setEditSheetOpen(true);
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
  const statusLabel = t(`status_${data.status}` as "status_new");

  return (
    <div className="admission-detail-page">
      <PageHeader
        title={data.prospectiveStudentName}
        showTitle={false}
        segment={{ label: data.prospectiveStudentName, href: enquiryHref }}
        breadcrumbs={[
          { label: nav("group_enrollment") },
          { label: nav("admissions"), href: "/dashboard/admissions" },
          { label: data.prospectiveStudentName },
        ]}
      />

      <section className="detail-hero admission-detail-hero">
        <div className="detail-hero__main">
          <div className="detail-hero__text">
            <div className="admission-detail-hero__title-row">
              <h1 className="pds-type-title-xl-extrabold detail-hero__title">
                {data.prospectiveStudentName}
              </h1>
              <span className="admission-detail-hero__status-chip pds-type-body-s-bold">
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="detail-hero__actions admission-detail-hero__actions">
          <PdsSelectField
            className="admission-detail-hero__status-select"
            variant="filter"
            value={data.status}
            disabled={update.isPending}
            onValueChange={(value) => {
              if (typeof value !== "string" || !value || value === data.status) return;
              void update.mutateAsync({ status: value });
            }}
            options={statusOptions}
            placeholder={statusLabel}
          />
          <button
            type="button"
            className="pds-type-body-m-bold btn-hero-outline"
            onClick={openEditSheet}
          >
            <Icon name="edit" />
            {c("edit")}
          </button>
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            disabled={startEnrollment.isPending || enrollmentBlocked}
            onClick={() => void openEnrollmentWizard()}
          >
            <Icon name="class" />
            {startEnrollment.isPending ? c("loading") : t("startEnrollmentShort")}
          </button>
        </div>
      </section>

      {startError ? (
        <p className="pds-type-body-m-medium error-text" role="alert">
          {startError}
        </p>
      ) : null}

      <div className="admission-detail-stats">
        <article className="admission-detail-stat">
          <p className="pds-type-body-s-semibold admission-detail-stat__label">{c("status")}</p>
          <p className="pds-type-title-xs-bold admission-detail-stat__value">{statusLabel}</p>
        </article>
        <article className="admission-detail-stat">
          <p className="pds-type-body-s-semibold admission-detail-stat__label">{t("grade")}</p>
          <p className="pds-type-title-xs-bold admission-detail-stat__value">
            {data.targetGrade ?? "—"}
          </p>
        </article>
        <article className="admission-detail-stat">
          <p className="pds-type-body-s-semibold admission-detail-stat__label">{t("source")}</p>
          <p className="pds-type-title-xs-bold admission-detail-stat__value">
            {formatSourceLabel(data.source)}
          </p>
        </article>
        <article className="admission-detail-stat">
          <p className="pds-type-body-s-semibold admission-detail-stat__label">{t("guardian")}</p>
          <p className="pds-type-body-m-bold admission-detail-stat__value">
            {data.guardianName ?? "—"}
          </p>
          {data.guardianPhone ? (
            <p className="pds-type-body-s-regular admission-detail-stat__hint">{data.guardianPhone}</p>
          ) : null}
        </article>
      </div>

      <div className="admission-activities-header">
        <div className="admission-activities-header__copy">
          <h2 className="pds-type-title-xs-bold admission-activities-header__title">
            {t("activitiesTitle")}
          </h2>
          <p className="pds-type-body-s-regular muted admission-activities-header__description">
            {t("activitiesHelp")}
          </p>
        </div>
        <button
          type="button"
          className="pds-type-body-m-bold pds-btn pds-btn--filled pds-btn--secondary"
          onClick={() => setActivityModalOpen(true)}
        >
          <Icon name="add" />
          {t("addNew")}
        </button>
      </div>

      {data.activities.length ? (
        <div className="admission-activities-table-wrap">
          <table className="admission-activities-table">
            <thead>
              <tr>
                <th scope="col">{t("when")}</th>
                <th scope="col">{t("activityType")}</th>
                <th scope="col">{t("notes")}</th>
                <th scope="col" className="admission-activities-table__actions">
                  {t("action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.activities.map((activity) => (
                <tr key={activity.id}>
                  <td className="pds-type-body-m-medium admission-activities-table__date">
                    {formatDateTime(activity.createdAt)}
                  </td>
                  <td className="pds-type-body-s-regular admission-activities-table__type">
                    {t(`activity_${activity.activityType}` as "activity_call")}
                  </td>
                  <td className="pds-type-body-m-medium admission-activities-table__notes">
                    {activity.notes}
                  </td>
                  <td className="admission-activities-table__actions">
                    <button type="button" className="admission-activities-table__edit" disabled>
                      <Icon name="edit" />
                      {c("edit")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState compact embedded icon="history" title={t("noActivities")} />
      )}

      <AddActivityModal
        open={activityModalOpen}
        onOpenChange={setActivityModalOpen}
        isSaving={addActivity.isPending}
        onSave={async (payload) => {
          await addActivity.mutateAsync(payload);
        }}
      />

      <RecordFormSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        title={t("editEnquiryTitle")}
        onSubmit={editForm.handleSubmit(async (values) => {
          await update.mutateAsync({
            prospectName: values.prospectName,
            guardianName: values.guardianName || undefined,
            guardianPhone: values.guardianPhone || undefined,
            interestedGrade: values.interestedGrade || undefined,
            source: values.source,
            notes: values.notes || undefined,
          });
          setEditSheetOpen(false);
        })}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setEditSheetOpen(false)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={editForm.formState.isSubmitting || update.isPending}
            >
              {update.isPending ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <Field label={t("prospect")} error={editForm.formState.errors.prospectName?.message}>
          <FormInput {...editForm.register("prospectName")} />
        </Field>
        <Field label={t("guardianName")}>
          <FormInput {...editForm.register("guardianName")} />
        </Field>
        <Field label={t("guardianPhone")}>
          <FormInput {...editForm.register("guardianPhone")} />
        </Field>
        <Field label={t("grade")}>
          <FormInput {...editForm.register("interestedGrade")} />
        </Field>
        <Field label={t("source")} error={editForm.formState.errors.source?.message}>
          <FormInput {...editForm.register("source")} />
        </Field>
        <Field label={t("notes")}>
          <TextAreaInput maxLength={300} {...editForm.register("notes")} />
        </Field>
      </RecordFormSheet>

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
          `/tenants/${tenant}/students`,
        ]}
        onSaved={() => void enquiry.refetch()}
      />
    </div>
  );
}
