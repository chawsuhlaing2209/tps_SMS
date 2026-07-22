"use client";

import dynamic from "next/dynamic";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, useApiQuery, useReferenceApiQuery } from "../../lib/api";
import { useCurrentAcademicYear } from "../../lib/use-current-academic-year";
import { getSession } from "../../lib/session";
import { DataTable, deriveInitials } from "../../lib/data-table";
import { Icon } from "../../lib/material-icon";
import { TablePanelBody } from "../../lib/table-panel";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { WorkspaceLoading } from "../../lib/workspace-loading";
import { PdsDatePickerField, PdsSearchFiltersRow, PdsSelectField } from "../../../components/pds";
import {
  currentMonthDayRangeValue,
  parseDayRangeValue,
  toDayValue
} from "../../../components/pds/date-picker-utils";
import { StatusBadge } from "../../../components/shared/badge";
import { StatCard, StatGrid } from "../../../components/shared/stat-card";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { ExportCsvButton } from "../../../components/shared/export-csv-button";
import { CancelEnrollmentDialog } from "../students/cancel-enrollment-dialog";

const EnrollmentWizard = dynamic(
  () => import("./enrollment-wizard").then((module) => module.EnrollmentWizard),
  { loading: () => <WorkspaceLoading /> }
);

type Grade = { id: string; name: string };
type Classroom = { id: string; name: string; gradeId: string; academicYearId: string };

export type EnrollmentRow = {
  id: string;
  studentId: string;
  studentFullName: string | null;
  classroomId: string | null;
  academicYearId: string;
  gradeId: string;
  invoiceId: string | null;
  status: string;
  billingSnapshot?: { optionalFeeItemIds?: string[] } | null;
  cancelledAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const ENROLLMENTS_PATH = (tenant: string) => `/tenants/${tenant}/enrollments`;

export function EnrollmentsWorkspace({
  showStatusFilter = true,
  compactTitle
}: {
  showStatusFilter?: boolean;
  compactTitle?: boolean;
}) {
  const t = useTranslations("enrollments");
  const c = useTranslations("common");
  const searchParams = useSearchParams();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<EnrollmentRow | null>(null);
  const [resumeEnrollmentId, setResumeEnrollmentId] = useState<string | null>(null);
  const [prefillStudentId, setPrefillStudentId] = useState<string | null>(null);
  const [prefillClassroomId, setPrefillClassroomId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(() => currentMonthDayRangeValue());
  const [cancelTarget, setCancelTarget] = useState<EnrollmentRow | null>(null);

  const currentYear = useCurrentAcademicYear();
  const workingYearId = currentYear.data?.id ?? "";

  useEffect(() => {
    const studentId = searchParams.get("studentId");
    const classroomId = searchParams.get("classroomId");
    const enrollmentId = searchParams.get("enrollmentId");
    if (studentId || classroomId) {
      setPrefillStudentId(studentId);
      setPrefillClassroomId(classroomId);
      setResumeDraft(null);
      setWizardOpen(true);
    } else if (enrollmentId) {
      setPrefillStudentId(null);
      setPrefillClassroomId(null);
      setResumeDraft(null);
      setResumeEnrollmentId(enrollmentId);
      setWizardOpen(true);
    }
  }, [searchParams]);

  const resumeEnrollment = useApiQuery<EnrollmentRow>((tenant) =>
    resumeEnrollmentId ? `/tenants/${tenant}/enrollments/${resumeEnrollmentId}` : null
  );

  useEffect(() => {
    if (!resumeEnrollmentId || !resumeEnrollment.data) return;
    setResumeDraft(resumeEnrollment.data);
  }, [resumeEnrollmentId, resumeEnrollment.data]);

  const grades = useReferenceApiQuery<Grade[]>((tn) => `/tenants/${tn}/academics/grades`);
  const classrooms = useReferenceApiQuery<Classroom[]>((tn) => `/tenants/${tn}/classrooms`);

  const enrollmentsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (workingYearId) params.set("academicYearId", workingYearId);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [workingYearId, statusFilter]);

  const enrollments = useApiQuery<EnrollmentRow[]>(
    (tn) => `${ENROLLMENTS_PATH(tn)}${enrollmentsQuery}`
  );

  type EnrollmentStats = {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    byGrade: Array<{ gradeId: string; count: number }>;
    byMonth: Array<{ month: string; count: number }>;
  };
  const stats = useApiQuery<EnrollmentStats>((tn) =>
    workingYearId
      ? `${ENROLLMENTS_PATH(tn)}/stats?academicYearId=${workingYearId}`
      : `${ENROLLMENTS_PATH(tn)}/stats`
  );

  // Grade + date-range filters are applied client-side over the fetched rows.
  const filteredEnrollments = useMemo(() => {
    let rows = enrollments.data ?? [];
    if (gradeFilter) rows = rows.filter((row) => row.gradeId === gradeFilter);
    const range = parseDayRangeValue(dateFilter);
    if (range) {
      const from = new Date(
        toDayValue(range.start.year, range.start.month, range.start.day)
      ).getTime();
      // Include the whole end day.
      const to =
        new Date(toDayValue(range.end.year, range.end.month, range.end.day)).getTime() +
        24 * 60 * 60 * 1000;
      rows = rows.filter((row) => {
        const when = row.createdAt ?? row.updatedAt;
        if (!when) return false;
        const ts = new Date(when).getTime();
        return ts >= from && ts < to;
      });
    }
    return rows;
  }, [enrollments.data, gradeFilter, dateFilter]);

  const studentName = (row: { studentId: string; studentFullName?: string | null }) =>
    row.studentFullName ?? row.studentId;
  const classroomName = (id: string | null) =>
    id ? (classrooms.data?.find((cl) => cl.id === id)?.name ?? id) : "—";
  const yearName = (id: string) =>
    id === workingYearId ? (currentYear.data?.name ?? id) : id;
  const gradeName = (id: string) => grades.data?.find((g) => g.id === id)?.name ?? id;

  const statusCount = (status: string) =>
    stats.data?.byStatus.find((row) => row.status === status)?.count ?? 0;
  const gradeBreakdown = (stats.data?.byGrade ?? [])
    .map((row) => ({ ...row, name: gradeName(row.gradeId) }))
    .sort((a, b) => b.count - a.count);
  const maxGradeCount = Math.max(1, ...gradeBreakdown.map((row) => row.count));

  const openWizard = (draft: EnrollmentRow | null = null) => {
    setResumeDraft(draft);
    setWizardOpen(true);
  };

  const enrollmentColumns: ColumnDef<EnrollmentRow, unknown>[] = [
    { id: "student", header: t("student"), accessorFn: (row) => studentName(row) },
    { id: "classroom", header: t("classroom"), accessorFn: (row) => classroomName(row.classroomId) },
    { id: "grade", header: t("grade"), accessorFn: (row) => gradeName(row.gradeId) },
    { id: "year", header: t("academicYear"), accessorFn: (row) => yearName(row.academicYearId) },
    {
      id: "status",
      header: t("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      )
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => {
        const enrollment = row.original;
        const canContinue = !enrollment.invoiceId && (enrollment.status === "draft" || enrollment.status === "approved");
        const canCancel =
          !enrollment.cancelledAt && enrollment.status !== "cancelled" && enrollment.status !== "draft";
        const items = [
          ...(canContinue
            ? [{ id: "continue", label: t("continueEnrollment"), icon: "edit", onSelect: () => openWizard(enrollment) }]
            : []),
          ...(enrollment.invoiceId
            ? [{ id: "invoice", label: t("viewInvoice"), icon: "receipt_long", onSelect: () => { window.location.href = `/dashboard/finance/invoices/${enrollment.invoiceId}`; } }]
            : []),
          ...(canCancel
            ? [{ id: "cancel", label: t("cancelEnrollment"), icon: "cancel", destructive: true, onSelect: () => setCancelTarget(enrollment) }]
            : [])
        ];
        if (!items.length) return <span className="muted">—</span>;
        return <RowMoreActionsMenu ariaLabel={c("moreActions")} items={items} />;
      }
    }
  ];

  return (
    <>
      <EnrollmentsHeaderActionsPortal
        onAdd={() => openWizard(null)}
        statusFilter={statusFilter}
        workingYearId={workingYearId}
        gradeName={gradeName}
        classroomName={classroomName}
        yearName={yearName}
        loading={enrollments.isLoading}
      />
      {showStatusFilter ? (
        <StatGrid className="enrollments-stat-grid">
          <StatCard
            accent
            icon={<Icon name="school" size={18} />}
            label={t("statTotal")}
            value={stats.data?.total ?? 0}
            hint={t("statTotalHint")}
          />
          <StatCard
            icon={<Icon name="task_alt" size={18} />}
            label={t("status_approved")}
            value={statusCount("approved") + statusCount("published")}
            hint={t("statConfirmedHint")}
          />
          <StatCard
            icon={<Icon name="edit_note" size={18} />}
            label={t("status_draft")}
            value={statusCount("draft")}
            hint={t("statDraftHint")}
          />
          <StatCard
            icon={<Icon name="cancel" size={18} />}
            label={t("status_cancelled")}
            value={statusCount("cancelled") + statusCount("rejected")}
            hint={t("statCancelledHint")}
          />
        </StatGrid>
      ) : null}

      {showStatusFilter && gradeBreakdown.length ? (
        <section className="panel enrollments-breakdown-panel">
          <p className="pds-type-title-xxs-extrabold enrollments-breakdown-panel__title">
            {t("breakdownByGrade")}
          </p>
          <div className="enrollments-breakdown">
            {gradeBreakdown.map((row) => (
              <div key={row.gradeId} className="enrollments-breakdown__row">
                <span className="pds-type-body-s-medium enrollments-breakdown__label">
                  {row.name}
                </span>
                <span className="enrollments-breakdown__track" aria-hidden>
                  <span
                    className="enrollments-breakdown__bar"
                    style={{ width: `${Math.round((row.count / maxGradeCount) * 100)}%` }}
                  />
                </span>
                <span className="pds-type-body-s-semibold enrollments-breakdown__count">
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showStatusFilter ? (
        <PdsSearchFiltersRow
          filters={
            <>
              <div className="pds-search-filters-row__filter--160">
                <PdsSelectField
                  variant="filter"
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(typeof value === "string" ? value : "")}
                  placeholder={t("allStatuses")}
                  options={[
                    { value: "draft", label: t("status_draft") },
                    { value: "approved", label: t("status_approved") },
                    { value: "cancelled", label: t("status_cancelled") },
                    { value: "archived", label: t("status_archived") }
                  ]}
                />
              </div>
              <div className="pds-search-filters-row__filter--160">
                <PdsSelectField
                  variant="filter"
                  value={gradeFilter}
                  onValueChange={(value) => setGradeFilter(typeof value === "string" ? value : "")}
                  placeholder={t("allGrades")}
                  options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
                />
              </div>
              <div className="pds-search-filters-row__filter--range">
                <PdsDatePickerField
                  type="day"
                  variant="filter"
                  selectionMode="range"
                  value={dateFilter}
                  onValueChange={setDateFilter}
                  ariaLabel={t("enrolledBetween")}
                  placeholder={t("enrolledBetween")}
                />
              </div>
            </>
          }
        />
      ) : null}
      <TablePanelBody
          loading={enrollments.isLoading}
          error={enrollments.isError ? c("somethingWrong") : null}
          empty={!filteredEnrollments.length}
        >
          <DataTable
            columns={enrollmentColumns}
            data={filteredEnrollments}
            mobileItem={{
              title: (enrollment) => studentName(enrollment),
              initials: (enrollment) => deriveInitials(studentName(enrollment)),
              nameForColor: (enrollment) => studentName(enrollment),
              meta: (enrollment) =>
                `${gradeName(enrollment.gradeId)} · ${classroomName(enrollment.classroomId)}`,
              trailing: (enrollment) => <StatusBadge status={enrollment.status} />
            }}
            onRowClick={(enrollment) => {
              // Smart row click: drafts resume the wizard; confirmed rows open
              // the student's profile.
              const canContinue =
                !enrollment.invoiceId &&
                (enrollment.status === "draft" || enrollment.status === "approved");
              if (canContinue) {
                openWizard(enrollment);
              } else {
                window.location.href = `/dashboard/students/${enrollment.studentId}`;
              }
            }}
          />
        </TablePanelBody>

      <EnrollmentWizard
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) {
            setResumeDraft(null);
            setResumeEnrollmentId(null);
            setPrefillStudentId(null);
            setPrefillClassroomId(null);
          }
        }}
        classrooms={classrooms.data}
        grades={grades.data}
        academicYears={currentYear.data ? [currentYear.data] : undefined}
        initialDraft={resumeDraft}
        initialStudentId={prefillStudentId}
        initialClassroomId={prefillClassroomId}
        onSaved={() => void enrollments.refetch()}
      />

      {cancelTarget ? (
        <CancelEnrollmentDialog
          open={cancelTarget !== null}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
          enrollmentId={cancelTarget.id}
          invoiceId={cancelTarget.invoiceId}
          studentName={studentName(cancelTarget)}
          onCancelled={() => {
            setCancelTarget(null);
            void enrollments.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function EnrollmentsHeaderActionsPortal({
  onAdd,
  statusFilter,
  workingYearId,
  gradeName,
  classroomName,
  yearName,
  loading
}: {
  onAdd: () => void;
  statusFilter: string;
  workingYearId: string;
  gradeName: (id: string) => string;
  classroomName: (id: string | null) => string;
  yearName: (id: string) => string;
  loading: boolean;
}) {
  const t = useTranslations("enrollments");
  const c = useTranslations("common");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <>
      <ExportCsvButton
        disabled={loading}
        onExport={async () => {
          const params = new URLSearchParams();
          if (workingYearId) params.set("academicYearId", workingYearId);
          if (statusFilter) params.set("status", statusFilter);
          const qs = params.toString();
          const rows = await apiFetch<EnrollmentRow[]>(
            `/tenants/${getSession()?.tenantId}/enrollments${qs ? `?${qs}` : ""}`
          );
          return {
            filename: "enrollments.csv",
            columns: [
              { key: "student", header: t("student") },
              { key: "classroom", header: t("classroom") },
              { key: "grade", header: t("grade") },
              { key: "year", header: t("academicYear") },
              { key: "status", header: t("status") },
              { key: "invoiceId", header: t("invoice") }
            ],
            rows: rows.map((row) => ({
              student: row.studentFullName ?? row.studentId,
              classroom: classroomName(row.classroomId),
              grade: gradeName(row.gradeId),
              year: yearName(row.academicYearId),
              status: row.status,
              invoiceId: row.invoiceId ?? ""
            }))
          };
        }}
      />
      <button type="button" className="pds-type-body-m-bold btn-primary" onClick={onAdd}>
        <Icon name="add" />
        {t("addEnrollment")}
      </button>
    </>,
    target
  );
}