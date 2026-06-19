"use client";
import { FormInput } from "../../../../components/shared/form-input";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { EntityList, EntityListItem, PdsSelectField } from "../../../../components/pds";
import { EmptyState } from "../../../../components/shared/empty-state";
import { hasAnyPermission } from "../../../lib/permissions";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { getSession } from "../../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { EnrollmentWizard } from "../../enrollments/enrollment-wizard";

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

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"roster" | "attendance" | "lms">(initialTab);
  const [takeOpen, setTakeOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [markSubjectId, setMarkSubjectId] = useState("");
  const [markingSession, setMarkingSession] = useState<AttendanceSession | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});

  const subjects = useApiQuery<ClassroomSubject[]>(
    (tenant) => `/tenants/${tenant}/classrooms/${classroomId}/subjects`
  );
  const roster = useApiQuery<ClassroomStudent[]>(
    (tenant) => `/tenants/${tenant}/classrooms/${classroomId}/students`
  );
  const grades = useApiQuery<Grade[]>((tenant) => `/tenants/${tenant}/academics/grades`);
  const classrooms = useApiQuery<Classroom[]>((tenant) => `/tenants/${tenant}/classrooms`);
  const sessions = useApiQuery<AttendanceSession[]>(
    (tenant) => `/tenants/${tenant}/classrooms/${classroomId}/attendance-sessions`
  );
  const sessionDetail = useApiQuery<AttendanceSessionDetail>((tenant) =>
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
        row.submittedAt ? new Date(row.submittedAt).toLocaleString() : t("notSubmitted")
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
      <div className="form-tabs" id="classroom-ops">
        <button
          type="button"
          className={activeTab === "roster" ? "form-tab form-tab--active" : "form-tab"}
          onClick={() => setActiveTab("roster")}
        >
          {t("rosterTitle")}
        </button>
        <button
          type="button"
          className={activeTab === "attendance" ? "form-tab form-tab--active" : "form-tab"}
          onClick={() => setActiveTab("attendance")}
        >
          {t("attendanceTitle")}
        </button>
        {canLms ? (
          <button
            type="button"
            className={activeTab === "lms" ? "form-tab form-tab--active" : "form-tab"}
            onClick={() => setActiveTab("lms")}
          >
            {t("lmsTitle")}
          </button>
        ) : null}
      </div>

      {activeTab === "roster" ? (
        <section className="panel">
          <TablePanelHead
            title={t("rosterTitle")}
            onRefresh={() => void roster.refetch()}
            onAdd={canEnroll ? () => setEnrollOpen(true) : undefined}
            addLabel={t("enrollStudent")}
          />
          <p className="pds-type-body-s-regular muted panel-help">{t("rosterHelp")}</p>
          <TablePanelBody
            loading={roster.isLoading}
            error={roster.isError ? c("somethingWrong") : null}
            empty={!roster.data?.length}
          >
            <EntityList>
              {(roster.data ?? []).map((student) => (
                <EntityListItem
                  key={student.id}
                  title={student.fullName}
                  meta={student.admissionNumber ?? undefined}
                  initials={personInitials(student.fullName)}
                  nameForColor={student.fullName}
                  href={`/dashboard/students/${student.id}`}
                />
              ))}
            </EntityList>
          </TablePanelBody>
        </section>
      ) : null}

      {activeTab === "attendance" ? (
        <section className="panel">
          <TablePanelHead
            title={t("attendanceTitle")}
            onRefresh={() => void sessions.refetch()}
            onAdd={
              canMark
                ? () => {
                    setSessionDate(new Date().toISOString().slice(0, 10));
                    setMarkSubjectId("");
                    setTakeOpen(true);
                  }
                : undefined
            }
            addLabel={t("takeAttendance")}
          />
          <TablePanelBody
            loading={sessions.isLoading}
            error={sessions.isError ? c("somethingWrong") : null}
            empty={!sessions.data?.length}
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
                />
              </TablePanelBody>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "lms" && canLms ? (
        <>
          <section className="panel">
            <TablePanelHead title={t("materialsTitle")} onRefresh={() => void materials.refetch()} />
            <TablePanelBody
              loading={materials.isLoading}
              error={materials.isError ? c("somethingWrong") : null}
              empty={!materials.data?.length}
            >
              <DataTable columns={materialColumns} data={materials.data ?? []} />
            </TablePanelBody>
          </section>

          <section className="panel">
            <TablePanelHead
              title={t("assignmentsTitle")}
              onRefresh={() => void assignments.refetch()}
            />
            <TablePanelBody
              loading={assignments.isLoading}
              error={assignments.isError ? c("somethingWrong") : null}
              empty={!assignments.data?.length}
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
          <FormInput type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
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
    </>
  );
}