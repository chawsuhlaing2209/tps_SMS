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
import { DataTable } from "../../lib/data-table";
import { Icon } from "../../lib/material-icon";
import { TablePanelBody } from "../../lib/table-panel";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { WorkspaceLoading } from "../../lib/workspace-loading";
import { PdsSearchFiltersRow, PdsSelectField } from "../../../components/pds";
import { StatusBadge } from "../../../components/shared/badge";
import { ExportCsvButton } from "../../../components/shared/export-csv-button";

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

  const studentName = (row: { studentId: string; studentFullName?: string | null }) =>
    row.studentFullName ?? row.studentId;
  const classroomName = (id: string | null) =>
    id ? (classrooms.data?.find((cl) => cl.id === id)?.name ?? id) : "—";
  const yearName = (id: string) =>
    id === workingYearId ? (currentYear.data?.name ?? id) : id;
  const gradeName = (id: string) => grades.data?.find((g) => g.id === id)?.name ?? id;

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
      id: "invoice",
      header: t("invoice"),
      cell: ({ row }) =>
        row.original.invoiceId ? (
          <Link className="pds-type-body-s-regular row-action" href={`/dashboard/finance/invoices/${row.original.invoiceId}`}>
            {t("viewInvoice")}
          </Link>
        ) : (
          "—"
        )
    },
    {
      id: "actions",
      header: t("actions"),
      enableSorting: false,
      cell: ({ row }) => {
        if (row.original.status === "draft" && !row.original.invoiceId) {
          return (
            <button type="button" className="pds-type-body-s-regular row-action" onClick={() => openWizard(row.original)}>
              {t("continueEnrollment")}
            </button>
          );
        }
        if (row.original.status === "approved" && !row.original.invoiceId) {
          return (
            <button type="button" className="pds-type-body-s-regular row-action" onClick={() => openWizard(row.original)}>
              {t("continueEnrollment")}
            </button>
          );
        }
        return null;
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
      <p className="pds-type-body-s-regular muted">{t("help")}</p>
      {showStatusFilter ? (
        <PdsSearchFiltersRow
          filters={
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(typeof value === "string" ? value : "")}
                placeholder={t("allStatuses")}
                options={[
                  { value: "draft", label: t("status_draft") },
                  { value: "approved", label: t("status_approved") },
                  { value: "archived", label: t("status_archived") }
                ]}
              />
            </div>
          }
        />
      ) : null}
      <TablePanelBody
          loading={enrollments.isLoading}
          error={enrollments.isError ? c("somethingWrong") : null}
          empty={!enrollments.data?.length}
        >
          <DataTable columns={enrollmentColumns} data={enrollments.data ?? []} />
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