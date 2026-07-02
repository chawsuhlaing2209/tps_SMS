"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { type ColumnDef } from "@tanstack/react-table";
import { PdsSearchBar, PdsSearchFiltersRow, PdsSelectField } from "../../../components/pds";
import { StatusBadge } from "../../../components/shared/badge";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { ExportCsvButton } from "../../../components/shared/export-csv-button";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { BulkArchiveBar, buildRowSelection, useRowSelection } from "../../lib/bulk-selection";
import { toastSuccess } from "../../lib/toast";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { fetchAllPaginated } from "../../lib/export-csv";
import { DataTable, DirectoryMemberCell } from "../../lib/data-table";
import { PaginationControls } from "../../lib/pagination-controls";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { TablePanelBody, DataTableSection } from "../../lib/table-panel";
import { usePeopleDirectoryActions } from "./people-directory-actions";
import { StudentRegistrationWizard } from "./student-registration-wizard";

type Student = {
  id: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  dateOfBirth: string | null;
  gender: string | null;
  familyGroupId: string | null;
  householdName: string | null;
  archivedAt?: string | null;
  updatedAt?: string;
};

type StudentList = { data: Student[]; total: number };

const STUDENTS_PATH = (tenant: string) => `/tenants/${tenant}/students`;
const PAGE_SIZE = 50;

function formatDateOfBirth(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function StudentsDirectory() {
  const t = useTranslations("students");
  const p = useTranslations("people");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const { studentsRegisterOpen, setStudentsRegisterOpen } = usePeopleDirectoryActions();
  const [statusFilter, setStatusFilter] = useState("");
  const [viewFilter, setViewFilter] = useState<"active" | "archived" | "all">("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const queryPath = (tenant: string) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      view: viewFilter
    });
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    if (search.trim()) {
      params.set("search", search.trim());
    }
    return `${STUDENTS_PATH(tenant)}?${params.toString()}`;
  };

  const students = useApiQuery<StudentList>(queryPath);
  const selection = useRowSelection();

  const bulkArchive = useApiMutation<{ ids: string[] }, { archived: number }>(
    (body, tenant) => ({
      path: `${STUDENTS_PATH(tenant)}/bulk-archive`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [STUDENTS_PATH(tenant)] }
  );
  const bulkRestore = useApiMutation<{ ids: string[] }, { restored: number }>(
    (body, tenant) => ({
      path: `${STUDENTS_PATH(tenant)}/bulk-restore`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [STUDENTS_PATH(tenant)] }
  );

  async function runBulkArchive() {
    const res = await bulkArchive.mutateAsync({ ids: [...selection.selected] });
    toastSuccess(c("bulkArchived", { count: res.archived }));
    selection.clear();
    void students.refetch();
  }
  async function runBulkRestore() {
    const res = await bulkRestore.mutateAsync({ ids: [...selection.selected] });
    toastSuccess(c("bulkRestored", { count: res.restored }));
    selection.clear();
    void students.refetch();
  }

  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  const archiveOne = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${STUDENTS_PATH(tenant)}/${id}/archive`, init: { method: "POST" } }),
    { invalidatePaths: (_b, tenant) => [STUDENTS_PATH(tenant)] }
  );
  const restoreOne = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${STUDENTS_PATH(tenant)}/${id}/restore`, init: { method: "POST" } }),
    { invalidatePaths: (_b, tenant) => [STUDENTS_PATH(tenant)] }
  );
  const deleteOne = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${STUDENTS_PATH(tenant)}/${id}`, init: { method: "DELETE" } }),
    { invalidatePaths: (_b, tenant) => [STUDENTS_PATH(tenant)] }
  );

  const columns: ColumnDef<Student, unknown>[] = [
    {
      id: "name",
      header: c("name"),
      accessorKey: "fullName",
      cell: ({ row }) => (
        <DirectoryMemberCell
          name={row.original.fullName}
          subtitle={row.original.admissionNumber}
        />
      )
    },
    { id: "admissionNumber", header: t("admissionNumber"), accessorKey: "admissionNumber" },
    {
      id: "household",
      header: t("household"),
      accessorFn: (row) => row.householdName ?? "",
      cell: ({ row }) =>
        row.original.familyGroupId && row.original.householdName ? (
          <Link
            href={`/dashboard/people/households/${row.original.familyGroupId}`}
            className="directory-tag"
            data-row-stop
          >
            {row.original.householdName}
          </Link>
        ) : (
          <span className="pds-type-body-s-regular muted">{t("noHousehold")}</span>
        )
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) =>
        row.original.archivedAt ? (
          <StatusBadge status="archived" label={t("status_archived")} />
        ) : (
          <StatusBadge
            status={row.original.status}
            label={t(`status_${row.original.status}` as "status_draft")}
          />
        )
    },
    {
      id: "dateOfBirth",
      header: t("dateOfBirth"),
      accessorFn: (row) => row.dateOfBirth ?? "",
      cell: ({ row }) => formatDateOfBirth(row.original.dateOfBirth)
    },
    ...(canManage
      ? ([
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
              <RowMoreActionsMenu
                ariaLabel={c("moreActions")}
                items={[
                  {
                    id: "view",
                    label: c("view"),
                    icon: "visibility",
                    onSelect: () => {
                      window.location.href = `/dashboard/students/${row.original.id}`;
                    }
                  },
                  ...(row.original.archivedAt
                    ? [
                        {
                          id: "restore",
                          label: c("restore"),
                          icon: "restore",
                          onSelect: () =>
                            void restoreOne.mutateAsync({ id: row.original.id }).then(() => {
                              toastSuccess(c("restore"));
                              void students.refetch();
                            })
                        },
                        {
                          id: "delete",
                          label: c("deletePermanently"),
                          icon: "delete_forever",
                          destructive: true,
                          onSelect: () => setDeletingStudent(row.original)
                        }
                      ]
                    : [
                        {
                          id: "archive",
                          label: c("archive"),
                          icon: "archive",
                          destructive: true,
                          onSelect: () =>
                            void archiveOne.mutateAsync({ id: row.original.id }).then(() => {
                              toastSuccess(c("archive"));
                              void students.refetch();
                            })
                        }
                      ])
                ]}
              />
            )
          }
        ] satisfies ColumnDef<Student, unknown>[])
      : [])
  ];

  return (
    <DataTableSection>
      <StudentsExportPortal
        statusFilter={statusFilter}
        search={search}
        loading={students.isLoading}
        formatDateOfBirth={formatDateOfBirth}
      />
      <PdsSearchFiltersRow
        filters={
          <>
            <PdsSearchBar
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder={p("searchStudents")}
              aria-label={p("searchStudents")}
            />
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(typeof value === "string" ? value : "");
                  setPage(0);
                }}
                placeholder={t("allStatuses")}
                options={[
                  { value: "draft", label: t("status_draft") },
                  { value: "enrolled", label: t("status_enrolled") },
                  { value: "transferred", label: t("status_transferred") },
                  { value: "withdrawn", label: t("status_withdrawn") }
                ]}
              />
            </div>
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={viewFilter}
                onValueChange={(value) => {
                  setViewFilter(
                    value === "archived" || value === "all" ? value : "active"
                  );
                  setPage(0);
                }}
                options={[
                  { value: "active", label: c("viewActive") },
                  { value: "archived", label: c("viewArchived") },
                  { value: "all", label: c("viewAll") }
                ]}
              />
            </div>
          </>
        }
      />

      {canManage ? (
        <BulkArchiveBar
          count={selection.selected.size}
          onArchive={viewFilter === "archived" ? undefined : () => void runBulkArchive()}
          onRestore={viewFilter === "active" ? undefined : () => void runBulkRestore()}
          onClear={selection.clear}
          busy={bulkArchive.isPending || bulkRestore.isPending}
        />
      ) : null}

      <TablePanelBody
        variant="card-plain"
        loading={students.isLoading}
        error={students.isError ? c("somethingWrong") : null}
        empty={!students.data?.data.length}
      >
        <DataTable
          columns={columns}
          data={students.data?.data ?? []}
          getRowHref={(student) => `/dashboard/students/${student.id}`}
          navigationFrom={{ label: nav("students"), href: "/dashboard/people?tab=students" }}
          rowSelection={
            canManage
              ? buildRowSelection(students.data?.data ?? [], (s) => s.id, selection)
              : undefined
          }
        />
      </TablePanelBody>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={students.data?.total ?? 0}
        onPageChange={setPage}
      />

      {canManage ? (
        <StudentRegistrationWizard
          open={studentsRegisterOpen}
          onOpenChange={setStudentsRegisterOpen}
          onSaved={() => void students.refetch()}
        />
      ) : null}

      <ConfirmDialog
        open={deletingStudent !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingStudent(null);
        }}
        title={t("deleteStudentTitle")}
        description={t("deleteStudentHelp")}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteOne.isPending}
        onConfirm={async () => {
          if (!deletingStudent) return;
          await deleteOne.mutateAsync({ id: deletingStudent.id });
          setDeletingStudent(null);
          void students.refetch();
        }}
      />
    </DataTableSection>
  );
}

function StudentsExportPortal({
  statusFilter,
  search,
  loading,
  formatDateOfBirth
}: {
  statusFilter: string;
  search: string;
  loading: boolean;
  formatDateOfBirth: (value: string | null) => string;
}) {
  const t = useTranslations("students");
  const c = useTranslations("common");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <ExportCsvButton
      disabled={loading}
      onExport={async () => {
        const tenantId = getSession()?.tenantId;
        if (!tenantId) {
          throw new Error(c("notSignedIn"));
        }
        const rows = await fetchAllPaginated<Student>(
          (limit, offset) => {
            const params = new URLSearchParams({
              limit: String(limit),
              offset: String(offset)
            });
            if (statusFilter) params.set("status", statusFilter);
            if (search.trim()) params.set("search", search.trim());
            return `/tenants/${tenantId}/students?${params.toString()}`;
          },
          (json) => {
            const payload = json as StudentList;
            return { rows: payload.data, total: payload.total };
          }
        );
        return {
          filename: "students.csv",
          columns: [
            { key: "fullName", header: c("name") },
            { key: "admissionNumber", header: t("admissionNumber") },
            { key: "household", header: t("household") },
            { key: "status", header: c("status") },
            { key: "dateOfBirth", header: t("dateOfBirth") }
          ],
          rows: rows.map((row) => ({
            fullName: row.fullName,
            admissionNumber: row.admissionNumber,
            household: row.householdName ?? "",
            status: row.status,
            dateOfBirth: formatDateOfBirth(row.dateOfBirth)
          }))
        };
      }}
    />,
    target
  );
}
