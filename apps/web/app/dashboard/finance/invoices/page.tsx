"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useApiQuery } from "../../../lib/api";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { DataTable } from "../../../lib/data-table";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { InvoicesToolbar } from "./_components/invoices-workspace";

type GradeOverview = {
  id: string;
  name: string;
  status: string;
  updatedAt?: string;
  studentCount: number;
  classroomCount: number;
};

const gradesPath = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/academics/setup/academic-years/${yearId}/grades`;

export default function InvoicesGradesPage() {
  const t = useTranslations("finance");
  const c = useTranslations("common");
  const currentYear = useCurrentAcademicYear();
  const yearId = currentYear.data?.id ?? "";

  const grades = useApiQuery<GradeOverview[]>((tenant) =>
    yearId ? gradesPath(tenant, yearId) : null
  );

  const columns: ColumnDef<GradeOverview, unknown>[] = [
    {
      id: "name",
      header: t("grade"),
      accessorKey: "name",
      cell: ({ row }) => (
        <Link href={`/dashboard/finance/invoices/grade/${row.original.id}`}>{row.original.name}</Link>
      )
    },
    { id: "students", header: t("studentCount"), accessorKey: "studentCount" },
    { id: "classrooms", header: t("classroomCount"), accessorKey: "classroomCount" },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <span className={`badge badge--${row.original.status}`}>{row.original.status}</span>
      )
    }
  ];

  return (
    <section className="panel">
      <TablePanelHead
        title={t("invoices")}
        help={t("invoicesGradesHelp")}
        onRefresh={() => void grades.refetch()}
        extra={<InvoicesToolbar />}
      />
      <TablePanelBody
        loading={currentYear.isLoading || grades.isLoading}
        error={grades.isError ? c("somethingWrong") : null}
        empty={!grades.data?.length}
      >
        <DataTable
          columns={columns}
          data={grades.data ?? []}
          getRowHref={(grade) => `/dashboard/finance/invoices/grade/${grade.id}`}
        />
      </TablePanelBody>
    </section>
  );
}
