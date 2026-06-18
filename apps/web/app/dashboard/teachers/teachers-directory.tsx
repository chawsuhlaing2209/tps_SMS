"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";
import { TableSearchInput } from "../../lib/table-search";
import { TeacherCreateSheet } from "./teacher-create-sheet";

type TeacherOverview = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  status: string;
  homeroomCount: number;
  subjectCount: number;
};

const TEACHERS_PATH = (tenant: string) =>
  `/tenants/${tenant}/hr/staff/overview?employmentRole=teacher`;

export function TeachersDirectory() {
  const t = useTranslations("teachers");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManageHr = hasAnyPermission(permissions, ["hr.manage"]);
  const canView = canManageHr || hasAnyPermission(permissions, ["classroom.manage"]);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const queryPath = search.trim()
    ? (tenant: string) =>
        `${TEACHERS_PATH(tenant)}&search=${encodeURIComponent(search.trim())}`
    : TEACHERS_PATH;

  const teachers = useApiQuery<TeacherOverview[]>(canView ? queryPath : () => null);

  const columns: ColumnDef<TeacherOverview, unknown>[] = [
    {
      id: "name",
      header: c("name"),
      cell: ({ row }) => (
        <Link href={`/dashboard/teachers/${row.original.id}`} className="table-link">
          {row.original.fullName}
        </Link>
      )
    },
    { id: "department", header: t("department"), accessorFn: (row) => row.department ?? "—" },
    { id: "email", header: t("email"), accessorFn: (row) => row.email ?? "—" },
    { id: "phone", header: t("phone"), accessorFn: (row) => row.phone ?? "—" },
    {
      id: "assignments",
      header: t("assignments"),
      accessorFn: (row) =>
        [
          row.homeroomCount > 0 ? t("homeroomCount", { count: row.homeroomCount }) : null,
          row.subjectCount > 0 ? t("subjectCount", { count: row.subjectCount }) : null
        ]
          .filter(Boolean)
          .join(" · ") || "—"
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    }
  ];

  if (!canView) {
    return null;
  }

  return (
    <>
      <section className="panel">
        <TablePanelHead
          title={t("listTitle")}
          help={t("listHelp")}
          onRefresh={() => void teachers.refetch()}
          onAdd={canManageHr ? () => setCreateOpen(true) : undefined}
          addLabel={t("addTeacher")}
          extra={
            <TableSearchInput
              placeholder={t("search")}
              value={search}
              aria-label={t("search")}
              onChange={(event) => setSearch(event.target.value)}
            />
          }
        />
        <TablePanelBody
          loading={teachers.isLoading}
          error={teachers.isError ? c("somethingWrong") : null}
          empty={!teachers.data?.length}
        >
          <DataTable columns={columns} data={teachers.data ?? []} />
        </TablePanelBody>
      </section>

      <TeacherCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void teachers.refetch()}
      />
    </>
  );
}
