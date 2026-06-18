"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useApiQuery } from "../../lib/api";
import { DataTable, DirectoryMemberCell } from "../../lib/data-table";
import { Icon } from "../../lib/material-icon";
import { PaginationControls } from "../../lib/pagination-controls";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead, DataTableSection } from "../../lib/table-panel";
import { TableSearchInput } from "../../lib/table-search";
import { StudentRegistrationWizard } from "./student-registration-wizard";
import { StatusBadge } from "../../../components/shared/badge";

type Student = {
  id: string;
  fullName: string;
  admissionNumber: string;
  status: string;
  dateOfBirth: string | null;
  gender: string | null;
  familyGroupId: string | null;
  householdName: string | null;
  updatedAt?: string;
};

type StudentList = { data: Student[]; total: number };

const STUDENTS_PATH = (tenant: string) => `/tenants/${tenant}/students`;
const PAGE_SIZE = 50;

export function StudentsDirectory() {
  const t = useTranslations("students");
  const p = useTranslations("people");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["student.manage"]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  const queryPath = (tenant: string) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE)
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
            className="row-action"
            data-row-stop
          >
            {row.original.householdName}
          </Link>
        ) : (
          <span className="muted">{t("noHousehold")}</span>
        )
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          label={t(`status_${row.original.status}` as "status_draft")}
        />
      )
    },
    { id: "dateOfBirth", header: t("dateOfBirth"), accessorFn: (row) => row.dateOfBirth ?? "—" }
  ];

  return (
    <DataTableSection>
      <TablePanelHead
        title={p("studentsTab")}
        help={p("studentsTabHelp")}
        extra={
          <>
            <TableSearchInput
              placeholder={p("searchStudents")}
              aria-label={p("searchStudents")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
            <select
              className="table-toolbar-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="">{t("allStatuses")}</option>
              <option value="draft">{t("status_draft")}</option>
              <option value="enrolled">{t("status_enrolled")}</option>
              <option value="transferred">{t("status_transferred")}</option>
              <option value="withdrawn">{t("status_withdrawn")}</option>
            </select>
            {canManage ? (
              <button type="button" className="btn-primary" onClick={() => setSheetOpen(true)}>
                <Icon name="add" />
                {t("registerTitle")}
              </button>
            ) : null}
          </>
        }
      />
      <TablePanelBody
        loading={students.isLoading}
        error={students.isError ? c("somethingWrong") : null}
        empty={!students.data?.data.length}
      >
        <DataTable
          columns={columns}
          data={students.data?.data ?? []}
          getRowHref={(student) => `/dashboard/students/${student.id}`}
          navigationFrom={{ label: nav("students"), href: "/dashboard/people?tab=students" }}
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
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onSaved={() => void students.refetch()}
        />
      ) : null}
    </DataTableSection>
  );
}