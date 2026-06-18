"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApiQuery } from "../../lib/api";
import { DataTable, DirectoryMemberCell } from "../../lib/data-table";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { TablePanelBody, TablePanelHead, DataTableSection } from "../../lib/table-panel";
import { TableSearchInput } from "../../lib/table-search";
import { TeacherCreateSheet } from "./teacher-create-sheet";
import { StatusBadge, Badge } from "../../../components/shared/badge";

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
  const nav = useTranslations("nav");
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
      header: c("staffMember"),
      cell: ({ row }) => (
        <DirectoryMemberCell name={row.original.fullName} email={row.original.email} />
      )
    },
    {
      id: "role",
      header: t("role"),
      cell: () => <Badge tone="neutral">{t("teacherRole")}</Badge>
    },
    {
      id: "assignments",
      header: c("subjectGrade"),
      accessorFn: (row) =>
        [
          row.department,
          [
            row.homeroomCount > 0 ? t("homeroomCount", { count: row.homeroomCount }) : null,
            row.subjectCount > 0 ? t("subjectCount", { count: row.subjectCount }) : null
          ]
            .filter(Boolean)
            .join(" · ")
        ]
          .filter(Boolean)
          .join(" · ") || "—"
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    }
  ];

  if (!canView) {
    return null;
  }

  return (
    <>
      <DataTableSection>
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
          <DataTable
            columns={columns}
            data={teachers.data ?? []}
            getRowHref={(teacher) => `/dashboard/teachers/${teacher.id}`}
            navigationFrom={{ label: nav("teachers"), href: "/dashboard/teachers" }}
          />
        </TablePanelBody>
      </DataTableSection>

      <TeacherCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void teachers.refetch()}
      />
    </>
  );
}