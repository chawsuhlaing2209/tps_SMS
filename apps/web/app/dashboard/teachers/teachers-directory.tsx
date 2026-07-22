"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PdsSearchBar, PdsSearchFiltersRow, PdsSelectField } from "../../../components/pds";
import { StatusBadge } from "../../../components/shared/badge";
import { ArchiveVisibilityFilter } from "../../../components/shared/archive-visibility-filter";
import { Chip, ChipGroup } from "../../../components/shared/chip";
import { ExportCsvButton } from "../../../components/shared/export-csv-button";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { toastSuccess } from "../../lib/toast";
import { useDashPageTitleActionsTarget } from "../dashboard-page-title";
import { fetchAllPaginated } from "../../lib/export-csv";
import { DataTable, DirectoryMemberCell, deriveInitials } from "../../lib/data-table";
import { PaginationControls } from "../../lib/pagination-controls";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { TablePanelBody, DataTableSection } from "../../lib/table-panel";
import { TeacherCreateSheet } from "./teacher-create-sheet";
import { ConfirmDialog } from "../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../components/shared/row-more-actions";
import { useTeachersActions } from "./teachers-actions-provider";

type TeacherProfile = {
  eligibleGradeIds?: string[];
};

type TeacherOverview = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  status: string;
  archivedAt?: string | null;
  homeroomCount: number;
  classroomCount: number;
  subjectCount: number;
  teacherProfile?: TeacherProfile;
  updatedAt?: string;
  createdAt?: string;
};

type StaffOverviewPage = {
  data: TeacherOverview[];
  total: number;
  limit: number;
  offset: number;
};

type GradeOption = { id: string; name: string; sortOrder?: number; status?: string };

const PAGE_SIZE = 50;

const teachersPath = (
  tenant: string,
  page: number,
  search: string,
  status: string,
  gradeId: string,
  view: "active" | "archived" | "all"
) => {
  const params = new URLSearchParams({
    employmentRole: "teacher",
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
    view
  });
  if (search.trim()) params.set("search", search.trim());
  if (status) params.set("status", status);
  if (gradeId) params.set("eligibleGradeId", gradeId);
  return `/tenants/${tenant}/hr/staff/overview?${params.toString()}`;
};

function gradeShortLabel(name: string) {
  const match = name.match(/\bG?\d{1,2}\b/i);
  if (match) {
    const digits = match[0].replace(/^G/i, "");
    return `G${digits}`;
  }
  return name.length > 8 ? name.slice(0, 8) : name;
}

export function TeachersDirectory() {
  const t = useTranslations("teachers");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManageHr = hasAnyPermission(permissions, ["hr.manage"]);
  const canView = canManageHr || hasAnyPermission(permissions, ["classroom.manage"]);
  const { createOpen, setCreateOpen } = useTeachersActions();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [viewFilter, setViewFilter] = useState<"active" | "archived" | "all">("active");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, gradeFilter, viewFilter]);

  const queryPath = useMemo(
    () => (tenant: string) =>
      teachersPath(tenant, page, search, statusFilter, gradeFilter, viewFilter),
    [page, search, statusFilter, gradeFilter, viewFilter]
  );

  const teachers = useApiQuery<StaffOverviewPage>(canView ? queryPath : () => null);
  const STAFF_PATH = (tenant: string) => `/tenants/${tenant}/hr/staff`;

  const [deletingTeacher, setDeletingTeacher] = useState<TeacherOverview | null>(null);

  const archiveOne = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${STAFF_PATH(tenant)}/${id}/archive`, init: { method: "POST" } })
  );
  const restoreOne = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${STAFF_PATH(tenant)}/${id}/restore`, init: { method: "POST" } })
  );
  const deleteOne = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${STAFF_PATH(tenant)}/${id}`, init: { method: "DELETE" } })
  );
  const grades = useApiQuery<GradeOption[]>((tenant) =>
    canView ? `/tenants/${tenant}/academics/grades` : null
  );

  const gradeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const grade of grades.data ?? []) {
      map.set(grade.id, grade.name);
    }
    return map;
  }, [grades.data]);

  const gradeSortById = useMemo(() => {
    const map = new Map<string, number>();
    for (const grade of grades.data ?? []) {
      map.set(grade.id, grade.sortOrder ?? Number.MAX_SAFE_INTEGER);
    }
    return map;
  }, [grades.data]);

  // Grade chips reflect only grades that still exist in the current year;
  // archived grades from a prior (rolled-over) year are hidden so a teacher's
  // eligibility doesn't list classes the school no longer runs.
  const activeGradeIds = useMemo(() => {
    const set = new Set<string>();
    for (const grade of grades.data ?? []) {
      if (grade.status !== "archived") set.add(grade.id);
    }
    return set;
  }, [grades.data]);

  const sortGradeIds = (ids: string[]) =>
    [...ids].sort(
      (a, b) =>
        (gradeSortById.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (gradeSortById.get(b) ?? Number.MAX_SAFE_INTEGER)
    );

  const columns: ColumnDef<TeacherOverview, unknown>[] = [
    {
      id: "name",
      header: c("staffMember"),
      cell: ({ row }) => (
        <DirectoryMemberCell name={row.original.fullName} email={row.original.email} />
      )
    },
    {
      id: "grades",
      header: t("gradesColumn"),
      accessorFn: (row) => row.teacherProfile?.eligibleGradeIds?.join(",") ?? "",
      enableSorting: false,
      cell: ({ row }) => {
        const gradeIds = (row.original.teacherProfile?.eligibleGradeIds ?? []).filter((id) =>
          activeGradeIds.has(id)
        );
        if (gradeIds.length === 0) {
          return <span className="pds-type-body-s-regular muted">—</span>;
        }

        return (
          <ChipGroup>
            {sortGradeIds(gradeIds).map((gradeId) => (
              <Chip key={gradeId}>{gradeShortLabel(gradeNameById.get(gradeId) ?? gradeId)}</Chip>
            ))}
          </ChipGroup>
        );
      }
    },
    {
      id: "classrooms",
      header: t("teachingClassrooms"),
      accessorKey: "classroomCount",
      cell: ({ row }) =>
        row.original.classroomCount > 0 ? String(row.original.classroomCount) : "—"
    },
    {
      id: "subjects",
      header: t("teachingSubjects"),
      accessorKey: "subjectCount",
      cell: ({ row }) => (row.original.subjectCount > 0 ? String(row.original.subjectCount) : "—")
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) =>
        row.original.archivedAt ? (
          <StatusBadge status="archived" label={t("statusArchived")} />
        ) : (
          <StatusBadge status={row.original.status} />
        )
    },
    ...(canManageHr
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
                      window.location.href = `/dashboard/teachers/${row.original.id}`;
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
                              void teachers.refetch();
                            })
                        },
                        {
                          id: "delete",
                          label: c("deletePermanently"),
                          icon: "delete_forever",
                          destructive: true,
                          onSelect: () => setDeletingTeacher(row.original)
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
                              void teachers.refetch();
                            })
                        }
                      ])
                ]}
              />
            )
          }
        ] satisfies ColumnDef<TeacherOverview, unknown>[])
      : [])
  ];

  if (!canView) {
    return null;
  }

  return (
    <>
      <TeachersExportPortal
        search={search}
        statusFilter={statusFilter}
        gradeFilter={gradeFilter}
        gradeNameById={gradeNameById}
        loading={teachers.isLoading}
        canView={canView}
      />
      <DataTableSection>
        <PdsSearchFiltersRow
          filters={
            <>
              <PdsSearchBar
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
              />
              <div className="pds-search-filters-row__filter--160">
                <PdsSelectField
                  variant="filter"
                  value={gradeFilter}
                  onValueChange={(value) => setGradeFilter(typeof value === "string" ? value : "")}
                  placeholder={t("allGrades")}
                  options={(grades.data ?? [])
                    .filter((grade) => grade.status !== "archived")
                    .map((grade) => ({
                      value: grade.id,
                      label: grade.name
                    }))}
                />
              </div>
              <div className="pds-search-filters-row__filter--160">
                <PdsSelectField
                  variant="filter"
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(typeof value === "string" ? value : "")}
                  placeholder={t("allStatuses")}
                  options={[
                    { value: "active", label: t("statusActive") },
                    { value: "probation", label: t("statusProbation") },
                    { value: "resigned", label: t("statusResigned") },
                    { value: "terminated", label: t("statusTerminated") }
                  ]}
                />
              </div>
            </>
          }
          statusControl={
            <ArchiveVisibilityFilter value={viewFilter} onChange={setViewFilter} />
          }
        />

        <TablePanelBody
          loading={teachers.isLoading}
          error={teachers.isError ? c("somethingWrong") : null}
          empty={!teachers.data?.data.length}
        >
          <DataTable
            columns={columns}
            data={teachers.data?.data ?? []}
            getRowHref={(teacher) => `/dashboard/teachers/${teacher.id}`}
            navigationFrom={{ label: nav("teachers"), href: "/dashboard/teachers" }}
            mobileItem={{
              title: (teacher) => teacher.fullName,
              initials: (teacher) => deriveInitials(teacher.fullName),
              nameForColor: (teacher) => teacher.fullName,
              meta: (teacher) => teacher.email ?? teacher.department ?? undefined,
              trailing: (teacher) =>
                teacher.archivedAt ? (
                  <StatusBadge status="archived" label={t("statusArchived")} />
                ) : (
                  <StatusBadge status={teacher.status} />
                )
            }}
          />
        </TablePanelBody>
      </DataTableSection>

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={teachers.data?.total ?? 0}
        onPageChange={setPage}
      />

      <TeacherCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void teachers.refetch()}
      />

      <ConfirmDialog
        open={deletingTeacher !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingTeacher(null);
        }}
        title={t("deleteTeacherTitle")}
        description={t("deleteTeacherHelp")}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteOne.isPending}
        onConfirm={async () => {
          if (!deletingTeacher) return;
          await deleteOne.mutateAsync({ id: deletingTeacher.id });
          setDeletingTeacher(null);
          void teachers.refetch();
        }}
      />
    </>
  );
}

function TeachersExportPortal({
  search,
  statusFilter,
  gradeFilter,
  gradeNameById,
  loading,
  canView
}: {
  search: string;
  statusFilter: string;
  gradeFilter: string;
  gradeNameById: Map<string, string>;
  loading: boolean;
  canView: boolean;
}) {
  const t = useTranslations("teachers");
  const c = useTranslations("common");
  const target = useDashPageTitleActionsTarget();

  if (!target || !canView) {
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
        const rows = await fetchAllPaginated<TeacherOverview>(
          (limit, offset) => {
            const params = new URLSearchParams({
              employmentRole: "teacher",
              limit: String(limit),
              offset: String(offset)
            });
            if (search.trim()) params.set("search", search.trim());
            if (statusFilter) params.set("status", statusFilter);
            if (gradeFilter) params.set("eligibleGradeId", gradeFilter);
            return `/tenants/${tenantId}/hr/staff/overview?${params.toString()}`;
          },
          (json) => {
            const payload = json as StaffOverviewPage;
            return { rows: payload.data, total: payload.total };
          }
        );
        return {
          filename: "teachers.csv",
          columns: [
            { key: "name", header: c("staffMember") },
            { key: "email", header: t("email") },
            { key: "grades", header: t("gradesColumn") },
            { key: "classrooms", header: t("teachingClassrooms") },
            { key: "subjects", header: t("teachingSubjects") },
            { key: "status", header: c("status") }
          ],
          rows: rows.map((row) => ({
            name: row.fullName,
            email: row.email ?? "",
            grades: (row.teacherProfile?.eligibleGradeIds ?? [])
              .map((id) => gradeNameById.get(id) ?? id)
              .join(", "),
            classrooms: row.classroomCount > 0 ? row.classroomCount : "",
            subjects: row.subjectCount > 0 ? row.subjectCount : "",
            status: row.status
          }))
        };
      }}
    />,
    target
  );
}
