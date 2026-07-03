"use client";
import { FormDatePicker, FormInput } from "../../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, useApiMutation, useApiQuery, useLiveApiQuery, useReferenceApiQuery, apiFetch } from "../../../lib/api";
import { RecordFormModal } from "../../../lib/record-modal";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { CancelEnrollmentDialog } from "../../students/cancel-enrollment-dialog";
import { useDashPageTitleActionsTarget } from "../../dashboard-page-title";
import { getSession } from "../../../lib/session";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { EntityList, EntityListItem, PdsSelectField, SegmentedControl } from "../../../../components/pds";
import { Button } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/shared/empty-state";
import { ExportCsvButton } from "../../../../components/shared/export-csv-button";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { TablePanelBody } from "../../../lib/table-panel";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { WorkspaceLoading } from "../../../lib/workspace-loading";
import { formatCreatedAt } from "../../finance/format-finance";

const EnrollmentWizard = dynamic(
  () => import("../../enrollments/enrollment-wizard").then((module) => module.EnrollmentWizard),
  { loading: () => <WorkspaceLoading /> }
);

type ClassroomSubject = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
};

type ClassroomStudent = {
  id: string;
  fullName: string;
  admissionNumber?: string | null;
  status?: string;
  /** Active enrollment that placed the student here (null for legacy placements). */
  enrollmentId?: string | null;
  invoiceId?: string | null;
};

type AttendanceSession = {
  id: string;
  classroomId: string;
  subjectId: string | null;
  sessionDate: string;
  submittedAt: string | null;
};

type AttendanceRecord = {
  id: string;
  studentId: string;
  status: string;
};

type AttendanceSessionDetail = {
  session: AttendanceSession;
  records: AttendanceRecord[];
};

type LearningMaterial = {
  id: string;
  title: string;
  description: string | null;
};

type Assignment = {
  id: string;
  title: string;
  subjectId: string;
  dueAt: string | null;
};

type Grade = { id: string; name: string };
type Classroom = { id: string; name: string; gradeId: string; academicYearId: string };

const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "excused",
  "sick",
  "leave",
  "half_day"
] as const;

function personInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function ClassroomOpsTabs({
  classroomId,
  classroomName,
  initialTab = "roster"
}: {
  classroomId: string;
  classroomName?: string;
  initialTab?: "roster" | "attendance" | "lms";
}) {
  const t = useTranslations("classrooms");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canMark = hasAnyPermission(permissions, ["attendance.mark"]);
  const canLms = hasAnyPermission(permissions, ["lms.manage"]);
  const canEnroll = hasAnyPermission(permissions, ["student.manage"]);
  const currentYear = useCurrentAcademicYear();
  const roomTrailFrom = {
    label: classroomName ?? t("structureTitle"),
    href: `/dashboard/structure/rooms/${classroomId}`
  };

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"roster" | "attendance" | "lms">(initialTab);
  const [takeOpen, setTakeOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEnrollmentId, setAssignEnrollmentId] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<ClassroomStudent | null>(null);
  const [moveClassroomId, setMoveClassroomId] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ClassroomStudent | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ClassroomStudent | null>(null);
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [markSubjectId, setMarkSubjectId] = useState("");
  const [markingSession, setMarkingSession] = useState<AttendanceSession | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});

  const subjects = useApiQuery<ClassroomSubject[]>((tenant) =>
    activeTab === "attendance" || takeOpen || activeTab === "lms"
      ? `/tenants/${tenant}/classrooms/${classroomId}/subjects`
      : null
  );
  const roster = useApiQuery<ClassroomStudent[]>((tenant) =>
    activeTab === "roster" || enrollOpen
      ? `/tenants/${tenant}/classrooms/${classroomId}/students`
      : null
  );
  const grades = useReferenceApiQuery<Grade[]>((tenant) =>
    enrollOpen ? `/tenants/${tenant}/academics/grades` : null
  );
  const classrooms = useReferenceApiQuery<Classroom[]>((tenant) =>
    enrollOpen || assignOpen || moveTarget !== null ? `/tenants/${tenant}/classrooms` : null
  );
  const thisClassroom = classrooms.data?.find((room) => room.id === classroomId);
  const unassignedEnrollments = useApiQuery<
    Array<{
      id: string;
      studentFullName: string | null;
      studentId: string;
      gradeId: string;
      classroomId: string | null;
      status: string;
      cancelledAt: string | null;
    }>
  >((tenant) =>
    assignOpen && thisClassroom
      ? `/tenants/${tenant}/enrollments?academicYearId=${thisClassroom.academicYearId}`
      : null
  );
  const assignCandidates = (unassignedEnrollments.data ?? []).filter(
    (row) =>
      row.gradeId === thisClassroom?.gradeId &&
      !row.classroomId &&
      !row.cancelledAt &&
      row.status !== "cancelled"
  );
  const sessions = useLiveApiQuery<AttendanceSession[]>((tenant) =>
    activeTab === "attendance" || takeOpen
      ? `/tenants/${tenant}/classrooms/${classroomId}/attendance-sessions`
      : null
  );
  const sessionDetail = useLiveApiQuery<AttendanceSessionDetail>((tenant) =>
    selectedSessionId ? `/tenants/${tenant}/attendance-sessions/${selectedSessionId}` : null
  );
  const materials = useApiQuery<LearningMaterial[]>((tenant) =>
    canLms && activeTab === "lms"
      ? `/tenants/${tenant}/lms/classrooms/${classroomId}/materials`
      : null
  );
  const assignments = useApiQuery<Assignment[]>((tenant) =>
    canLms && activeTab === "lms"
      ? `/tenants/${tenant}/lms/classrooms/${classroomId}/assignments`
      : null
  );

  const subjectName = (id: string | null) =>
    id ? (subjects.data?.find((s) => s.subjectId === id)?.subjectName ?? id) : t("selectSubject");
  const studentName = (id: string) => roster.data?.find((s) => s.id === id)?.fullName ?? id;

  const sessionsPath = (tenant: string) =>
    `/tenants/${tenant}/classrooms/${classroomId}/attendance-sessions`;

  const assignStudent = useApiMutation<{ enrollmentId: string }, unknown>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/enrollments/${body.enrollmentId}/assign-classroom`,
      init: { method: "POST", body: JSON.stringify({ classroomId }) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/classrooms/${classroomId}/students`,
        `/tenants/${tenant}/classrooms/${classroomId}/room-detail`
      ]
    }
  );

  const moveStudent = useApiMutation<{ enrollmentId: string; targetClassroomId: string }, unknown>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/enrollments/${body.enrollmentId}/assign-classroom`,
      init: { method: "POST", body: JSON.stringify({ classroomId: body.targetClassroomId }) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/classrooms/${classroomId}/students`,
        `/tenants/${tenant}/classrooms/${classroomId}/room-detail`
      ]
    }
  );

  const unassignStudent = useApiMutation<{ enrollmentId: string }, unknown>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/enrollments/${body.enrollmentId}/unassign-classroom`,
      init: { method: "POST" }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/classrooms/${classroomId}/students`,
        `/tenants/${tenant}/classrooms/${classroomId}/room-detail`
      ]
    }
  );

  const enrollmentInvalidatePaths = useMemo(
    () => (tenant: string) => [
      `/tenants/${tenant}/classrooms/${classroomId}/students`,
      `/tenants/${tenant}/classrooms/${classroomId}/room-detail`
    ],
    [classroomId]
  );

  const openSession = useApiMutation<Record<string, unknown>, AttendanceSession>(
    (body, tenant) => ({
      path: sessionsPath(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [sessionsPath(tenant)] }
  );

  const markRecords = useApiMutation<{ sessionId: string; body: Record<string, unknown> }>(
    ({ sessionId, body }, tenant) => ({
      path: `${sessionsPath(tenant)}/${sessionId}/records`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [sessionsPath(tenant)] }
  );

  const closeSession = useApiMutation<{ sessionId: string }>(
    ({ sessionId }, tenant) => ({
      path: `${sessionsPath(tenant)}/${sessionId}/close`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    { invalidatePaths: (_b, tenant) => [sessionsPath(tenant)] }
  );

  const beginMarking = async () => {
    const session = await openSession.mutateAsync({
      sessionDate,
      subjectId: markSubjectId || undefined
    });
    const initial: Record<string, string> = {};
    for (const student of roster.data ?? []) {
      initial[student.id] = "present";
    }
    setMarks(initial);
    setMarkingSession(session);
    setTakeOpen(false);
  };

  const saveMarking = async () => {
    if (!markingSession) return;
    const records = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }));
    if (records.length > 0) {
      await markRecords.mutateAsync({ sessionId: markingSession.id, body: { records } });
    }
    await closeSession.mutateAsync({ sessionId: markingSession.id });
    setMarkingSession(null);
    setMarks({});
  };

  const sessionColumns: ColumnDef<AttendanceSession, unknown>[] = [
    { id: "date", header: t("sessionDate"), accessorKey: "sessionDate" },
    { id: "subject", header: t("subject"), accessorFn: (row) => subjectName(row.subjectId) },
    {
      id: "submitted",
      header: t("submitted"),
      accessorFn: (row) =>
        row.submittedAt ? formatCreatedAt(row.submittedAt) : t("notSubmitted")
    },
    {
      id: "actions",
      header: t("records"),
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          className="pds-type-body-s-regular row-action"
          onClick={() =>
            setSelectedSessionId((current) =>
              current === row.original.id ? null : row.original.id
            )
          }
        >
          {selectedSessionId === row.original.id ? t("hideRecords") : t("viewRecords")}
        </button>
      )
    }
  ];

  const recordColumns: ColumnDef<AttendanceRecord, unknown>[] = [
    { id: "student", header: t("student"), accessorFn: (row) => studentName(row.studentId) },
    { id: "status", header: c("status"), accessorKey: "status" }
  ];

  const materialColumns: ColumnDef<LearningMaterial, unknown>[] = [
    { id: "title", header: t("materialTitle"), accessorKey: "title" },
    { id: "topic", header: t("topicTag"), accessorFn: (row) => row.description ?? "—" }
  ];

  const assignmentColumns: ColumnDef<Assignment, unknown>[] = [
    { id: "title", header: t("assignmentTitle"), accessorKey: "title" },
    { id: "subject", header: t("subject"), accessorFn: (row) => subjectName(row.subjectId) },
    {
      id: "due",
      header: t("dueDate"),
      accessorFn: (row) => (row.dueAt ? new Date(row.dueAt).toLocaleDateString() : "—")
    }
  ];

  return (
    <>
      <ClassroomOpsExportPortal
        classroomId={classroomId}
        activeTab={activeTab}
        rosterLoading={roster.isLoading}
        sessionsLoading={sessions.isLoading}
        subjectName={subjectName}
      />
      <SegmentedControl
        ariaLabel={t("classroomOpsTabs")}
        value={activeTab}
        onChange={(next) => setActiveTab(next as "roster" | "attendance" | "lms")}
        options={[
          { id: "roster", label: t("studentsTab") },
          { id: "attendance", label: t("attendanceTab") },
          ...(canLms ? [{ id: "lms", label: t("lmsTitle") }] : [])
        ]}
      />

      {activeTab === "roster" ? (
        <section className="panel classroom-ops-panel">
          <div className="classroom-ops-panel__head">
            <div className="classroom-ops-panel__head-main">
              <h3 className="pds-type-title-s-extrabold classroom-ops-panel__title">{t("classStudentsTitle")}</h3>
              <p className="pds-type-body-s-regular classroom-ops-panel__help">{t("rosterHelp")}</p>
            </div>
            {canEnroll ? (
              <div className="classroom-ops-panel__head-actions">
                <Button
                  buttonType="ghost"
                  buttonColor="primary"
                  prefixIcon="door_open"
                  onClick={() => {
                    setAssignEnrollmentId("");
                    setAssignError(null);
                    setAssignOpen(true);
                  }}
                >
                  {t("assignStudent")}
                </Button>
                <Button buttonType="filled" buttonColor="primary" prefixIcon="add" onClick={() => setEnrollOpen(true)}>
                  {t("enrollStudent")}
                </Button>
              </div>
            ) : null}
          </div>
          <TablePanelBody
            variant="plain"
            loading={roster.isLoading}
            error={roster.isError ? c("somethingWrong") : null}
            empty={!roster.data?.length}
          >
            <EntityList className="pds-entity-list--compact">
              {(roster.data ?? []).map((student) => (
                <EntityListItem
                  key={student.id}
                  title={student.fullName}
                  meta={student.admissionNumber ?? undefined}
                  initials={personInitials(student.fullName)}
                  nameForColor={student.fullName}
                  href={`/dashboard/students/${student.id}`}
                  navigationFrom={roomTrailFrom}
                  trailing={
                    canEnroll && student.enrollmentId ? (
                      <RowMoreActionsMenu
                        ariaLabel={c("moreActions")}
                        items={[
                          {
                            id: "move",
                            label: t("moveStudent"),
                            icon: "sync_alt",
                            onSelect: () => {
                              setMoveClassroomId("");
                              setMoveError(null);
                              setMoveTarget(student);
                            }
                          },
                          {
                            id: "remove",
                            label: t("removeFromClass"),
                            icon: "person_remove",
                            onSelect: () => setRemoveTarget(student)
                          },
                          {
                            id: "cancel",
                            label: t("cancelEnrollmentAction"),
                            icon: "cancel",
                            destructive: true,
                            onSelect: () => setCancelTarget(student)
                          }
                        ]}
                      />
                    ) : undefined
                  }
                />
              ))}
            </EntityList>
          </TablePanelBody>
        </section>
      ) : null}

      {activeTab === "attendance" ? (
        <section className="panel classroom-ops-panel">
          <div className="classroom-ops-panel__head">
            <div className="classroom-ops-panel__head-main">
              <h3 className="pds-type-title-s-extrabold classroom-ops-panel__title">{t("attendanceTitle")}</h3>
            </div>
            {canMark ? (
              <Button
                buttonType="filled"
                buttonColor="primary"
                prefixIcon="add"
                onClick={() => {
                  setSessionDate(new Date().toISOString().slice(0, 10));
                  setMarkSubjectId("");
                  setTakeOpen(true);
                }}
              >
                {t("takeAttendance")}
              </Button>
            ) : null}
          </div>
          <TablePanelBody
            loading={sessions.isLoading}
            error={sessions.isError ? c("somethingWrong") : null}
            empty={!sessions.data?.length}
            unwrapEmpty
          >
            <DataTable columns={sessionColumns} data={sessions.data ?? []} />
          </TablePanelBody>

          {selectedSessionId ? (
            <div className="panel-body">
              <h3 className="pds-type-title-xxs-extrabold">{t("recordsTitle")}</h3>
              <TablePanelBody
                loading={sessionDetail.isLoading}
                error={sessionDetail.isError ? c("somethingWrong") : null}
                empty={!sessionDetail.data?.records.length}
              >
                <DataTable
                  columns={recordColumns}
                  data={sessionDetail.data?.records ?? []}
                  getRowHref={(record) => `/dashboard/students/${record.studentId}`}
                  navigationFrom={roomTrailFrom}
                />
              </TablePanelBody>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "lms" && canLms ? (
        <>
          <section className="panel">
            <div className="dash-page-title">
              <h3 className="pds-type-title-xs-bold dash-page-title__heading">{t("materialsTitle")}</h3>
            </div>
            <TablePanelBody
              loading={materials.isLoading}
              error={materials.isError ? c("somethingWrong") : null}
              empty={!materials.data?.length}
              unwrapEmpty
            >
              <DataTable columns={materialColumns} data={materials.data ?? []} />
            </TablePanelBody>
          </section>

          <section className="panel">
            <div className="dash-page-title">
              <h3 className="pds-type-title-xs-bold dash-page-title__heading">{t("assignmentsTitle")}</h3>
            </div>
            <TablePanelBody
              loading={assignments.isLoading}
              error={assignments.isError ? c("somethingWrong") : null}
              empty={!assignments.data?.length}
              unwrapEmpty
            >
              <DataTable columns={assignmentColumns} data={assignments.data ?? []} />
            </TablePanelBody>
          </section>
        </>
      ) : null}

      <RecordFormSheet
        open={takeOpen}
        onOpenChange={setTakeOpen}
        title={t("takeAttendance")}
        onSubmit={(e) => {
          e.preventDefault();
          void beginMarking();
        }}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setTakeOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={openSession.isPending}>
              <Icon name="fact_check" />
              {openSession.isPending ? t("openingSession") : t("openSession")}
            </button>
          </>
        }
      >
        <Field label={t("sessionDate")}>
          <FormDatePicker
            type="day"
            variant="form"
            value={sessionDate}
            onValueChange={setSessionDate}
            placeholder={t("sessionDate")}
            ariaLabel={t("sessionDate")}
          />
        </Field>
        <Field label={t("subject")}>
          <PdsSelectField
            variant="form"
            value={markSubjectId}
            onValueChange={(value) => setMarkSubjectId(typeof value === "string" ? value : "")}
            placeholder={t("selectSubject")}
            options={(subjects.data ?? []).map((subject) => ({
              value: subject.subjectId,
              label: subject.subjectName
            }))}
          />
        </Field>
      </RecordFormSheet>

      <RecordFormSheet
        open={markingSession !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMarkingSession(null);
            setMarks({});
          }
        }}
        title={t("recordsTitle")}
        onSubmit={(e) => {
          e.preventDefault();
          void saveMarking();
        }}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => {
                setMarkingSession(null);
                setMarks({});
              }}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={markRecords.isPending || closeSession.isPending}
            >
              <Icon name="check" />
              {markRecords.isPending || closeSession.isPending
                ? t("savingRecords")
                : t("saveRecords")}
            </button>
          </>
        }
      >
        <button
          type="button"
          className="pds-type-body-m-bold btn-ghost"
          onClick={() =>
            setMarks(() => {
              const next: Record<string, string> = {};
              for (const student of roster.data ?? []) next[student.id] = "present";
              return next;
            })
          }
        >
          <Icon name="done_all" />
          {t("markAll")}
        </button>
        {roster.isLoading ? (
          <p className="pds-type-body-s-regular muted">{c("loading")}</p>
        ) : !roster.data?.length ? (
          <EmptyState compact embedded icon="inbox" title={t("noRecords")} />
        ) : (
          <div className="form-stack">
            {roster.data.map((student) => (
              <Field key={student.id} label={student.fullName}>
                <PdsSelectField
                  variant="form"
                  value={marks[student.id] ?? "present"}
                  onValueChange={(value) =>
                    setMarks((prev) => ({
                      ...prev,
                      [student.id]: typeof value === "string" ? value : "present"
                    }))
                  }
                  options={ATTENDANCE_STATUSES.map((status) => ({
                    value: status,
                    label: status
                  }))}
                />
              </Field>
            ))}
          </div>
        )}
      </RecordFormSheet>

      {canEnroll ? (
        <EnrollmentWizard
          open={enrollOpen}
          onOpenChange={setEnrollOpen}
          classrooms={classrooms.data}
          grades={grades.data}
          academicYears={currentYear.data ? [currentYear.data] : undefined}
          initialClassroomId={classroomId}
          lockClassroom
          classroomDisplayName={classroomName}
          extraInvalidatePaths={enrollmentInvalidatePaths}
          onSaved={() => void roster.refetch()}
        />
      ) : null}

      <RecordFormModal
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) {
            setAssignError(null);
          }
        }}
        title={t("assignStudentTitle")}
        help={t("assignStudentHelp")}
        headerIcon="door_open"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!assignEnrollmentId) {
            setAssignError(c("required"));
            return;
          }
          setAssignError(null);
          try {
            await assignStudent.mutateAsync({ enrollmentId: assignEnrollmentId });
            setAssignOpen(false);
            void roster.refetch();
          } catch (error) {
            setAssignError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        }}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setAssignOpen(false)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={assignStudent.isPending || !assignEnrollmentId}
            >
              <Icon name="door_open" />
              {assignStudent.isPending ? c("loading") : t("assignStudentConfirm")}
            </button>
          </>
        }
      >
        {unassignedEnrollments.isLoading ? (
          <p className="pds-type-body-s-regular muted">{c("loading")}</p>
        ) : assignCandidates.length ? (
          <Field label={t("studentsTab")}>
            <PdsSelectField
              value={assignEnrollmentId}
              onValueChange={(value) =>
                setAssignEnrollmentId(typeof value === "string" ? value : "")
              }
              placeholder={t("assignStudentPlaceholder")}
              options={assignCandidates.map((row) => ({
                value: row.id,
                label: row.studentFullName ?? row.studentId
              }))}
            />
          </Field>
        ) : (
          <p className="pds-type-body-s-regular muted">{t("assignStudentEmpty")}</p>
        )}
        {assignError ? (
          <p className="pds-type-body-m-medium error-text" role="alert">
            {assignError}
          </p>
        ) : null}
      </RecordFormModal>

      <RecordFormModal
        open={moveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMoveTarget(null);
            setMoveError(null);
          }
        }}
        title={t("moveStudentTitle", { name: moveTarget?.fullName ?? "" })}
        help={t("moveStudentHelp")}
        headerIcon="sync_alt"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!moveTarget?.enrollmentId) return;
          if (!moveClassroomId) {
            setMoveError(c("required"));
            return;
          }
          setMoveError(null);
          try {
            await moveStudent.mutateAsync({
              enrollmentId: moveTarget.enrollmentId,
              targetClassroomId: moveClassroomId
            });
            setMoveTarget(null);
            void roster.refetch();
          } catch (error) {
            setMoveError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        }}
        footer={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => setMoveTarget(null)}
            >
              {c("cancel")}
            </button>
            <button
              type="submit"
              className="pds-type-body-m-bold btn-primary"
              disabled={moveStudent.isPending || !moveClassroomId}
            >
              <Icon name="sync_alt" />
              {moveStudent.isPending ? c("loading") : t("moveStudentConfirm")}
            </button>
          </>
        }
      >
        <Field label={t("moveStudentTarget")}>
          <PdsSelectField
            value={moveClassroomId}
            onValueChange={(value) =>
              setMoveClassroomId(typeof value === "string" ? value : "")
            }
            placeholder={t("moveStudentPlaceholder")}
            options={(classrooms.data ?? [])
              .filter(
                (room) =>
                  room.id !== classroomId &&
                  room.gradeId === thisClassroom?.gradeId &&
                  room.academicYearId === thisClassroom?.academicYearId
              )
              .map((room) => ({ value: room.id, label: room.name }))}
          />
        </Field>
        {moveError ? (
          <p className="pds-type-body-m-medium error-text" role="alert">
            {moveError}
          </p>
        ) : null}
      </RecordFormModal>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={t("removeFromClassTitle")}
        description={t("removeFromClassBody", { name: removeTarget?.fullName ?? "" })}
        confirmLabel={t("removeFromClass")}
        cancelLabel={c("cancel")}
        destructive
        loading={unassignStudent.isPending}
        onConfirm={async () => {
          if (!removeTarget?.enrollmentId) return;
          await unassignStudent.mutateAsync({ enrollmentId: removeTarget.enrollmentId });
          setRemoveTarget(null);
          void roster.refetch();
        }}
      />

      {cancelTarget?.enrollmentId ? (
        <CancelEnrollmentDialog
          open={Boolean(cancelTarget)}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
          enrollmentId={cancelTarget.enrollmentId}
          invoiceId={cancelTarget.invoiceId ?? null}
          studentName={cancelTarget.fullName}
          onCancelled={() => {
            setCancelTarget(null);
            void roster.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function ClassroomOpsExportPortal({
  classroomId,
  activeTab,
  rosterLoading,
  sessionsLoading,
  subjectName
}: {
  classroomId: string;
  activeTab: "roster" | "attendance" | "lms";
  rosterLoading: boolean;
  sessionsLoading: boolean;
  subjectName: (id: string | null) => string;
}) {
  const t = useTranslations("classrooms");
  const tStudents = useTranslations("students");
  const c = useTranslations("common");
  const target = useDashPageTitleActionsTarget();

  if (!target || activeTab === "lms") {
    return null;
  }

  const loading = activeTab === "roster" ? rosterLoading : sessionsLoading;

  return createPortal(
    <ExportCsvButton
      disabled={loading}
      onExport={async () => {
        const tenantId = getSession()?.tenantId;
        if (!tenantId) {
          throw new Error(c("notSignedIn"));
        }

        if (activeTab === "roster") {
          const rows = await apiFetch<ClassroomStudent[]>(
            `/tenants/${tenantId}/classrooms/${classroomId}/students`
          );
          return {
            filename: `classroom-roster-${classroomId.slice(0, 8)}.csv`,
            columns: [
              { key: "name", header: t("student") },
              { key: "admissionNumber", header: tStudents("admissionNumber") },
              { key: "status", header: c("status") }
            ],
            rows: rows.map((row) => ({
              name: row.fullName,
              admissionNumber: row.admissionNumber ?? "",
              status: row.status ?? ""
            }))
          };
        }

        const sessions = await apiFetch<AttendanceSession[]>(
          `/tenants/${tenantId}/classrooms/${classroomId}/attendance-sessions`
        );
        return {
          filename: `attendance-sessions-${classroomId.slice(0, 8)}.csv`,
          columns: [
            { key: "date", header: t("sessionDate") },
            { key: "subject", header: t("subject") },
            { key: "submitted", header: t("submitted") }
          ],
          rows: sessions.map((session) => ({
            date: session.sessionDate,
            subject: subjectName(session.subjectId),
            submitted: session.submittedAt
              ? formatCreatedAt(session.submittedAt)
              : t("notSubmitted")
          }))
        };
      }}
    />,
    target
  );
}