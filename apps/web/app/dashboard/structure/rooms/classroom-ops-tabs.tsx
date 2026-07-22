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
import { useTenantFormats } from "../../../lib/use-tenant-formats";
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

type Grade = { id: string; name: string };
type Classroom = { id: string; name: string; gradeId: string; academicYearId: string };

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
  classroomName
}: {
  classroomId: string;
  classroomName?: string;
}) {
  const t = useTranslations("classrooms");
  const c = useTranslations("common");
  const { formatDate } = useTenantFormats();
  const permissions = getSession()?.permissions;
  const canEnroll = hasAnyPermission(permissions, ["student.manage"]);
  const currentYear = useCurrentAcademicYear();
  const roomTrailFrom = {
    label: classroomName ?? t("structureTitle"),
    href: `/dashboard/structure/rooms/${classroomId}`
  };

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEnrollmentId, setAssignEnrollmentId] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<ClassroomStudent | null>(null);
  const [moveClassroomId, setMoveClassroomId] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ClassroomStudent | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ClassroomStudent | null>(null);

  const roster = useApiQuery<ClassroomStudent[]>(
    (tenant) => `/tenants/${tenant}/classrooms/${classroomId}/students`
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

  const studentName = (id: string) => roster.data?.find((s) => s.id === id)?.fullName ?? id;


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

  return (
    <>
      <ClassroomOpsExportPortal
        classroomId={classroomId}
        rosterLoading={roster.isLoading}
      />
      {(
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
      )}

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
  rosterLoading
}: {
  classroomId: string;
  rosterLoading: boolean;
}) {
  const t = useTranslations("classrooms");
  const tStudents = useTranslations("students");
  const c = useTranslations("common");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <ExportCsvButton
      disabled={rosterLoading}
      onExport={async () => {
        const tenantId = getSession()?.tenantId;
        if (!tenantId) {
          throw new Error(c("notSignedIn"));
        }

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
      }}
    />,
    target
  );
}