"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Icon } from "../../../lib/material-icon";
import { TablePanelBody, TablePanelHead } from "../../../lib/table-panel";
import { StatusBadge } from "../../../../components/shared/badge";

type SalaryRecord = {
  id: string;
  staffFullName: string | null;
  salaryMonth: string;
  netAmount: string;
  status: string;
  updatedAt?: string;
};

export default function SalaryRecordsPage() {
  const t = useTranslations("salary");
  const c = useTranslations("common");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const records = useApiQuery<SalaryRecord[]>(
    (tenant) => `/tenants/${tenant}/salary/records?month=${encodeURIComponent(month)}`
  );

  const generate = useApiMutation<{ month: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/salary/records/generate`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/salary/records`] }
  );

  const columns: ColumnDef<SalaryRecord, unknown>[] = [
    {
      id: "staff",
      header: t("staff"),
      accessorFn: (r) => r.staffFullName ?? r.id,
      cell: ({ row }) => (
        <Link href={`/dashboard/salary/records/${row.original.id}`}>
          {row.original.staffFullName ?? row.original.id.slice(0, 8)}
        </Link>
      )
    },
    { id: "month", header: t("month"), accessorKey: "salaryMonth" },
    { id: "net", header: t("netAmount"), accessorKey: "netAmount" },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} />
      )
    }
  ];

  return (
    <section className="panel">
      <TablePanelHead
        title={t("records")}
        onRefresh={() => void records.refetch()}
        extra={
          <>
            <input
              type="month"
              className="table-toolbar-select"
              aria-label={t("month")}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={generate.isPending}
              onClick={() => void generate.mutateAsync({ month })}
            >
              <Icon name="bolt" />
              {generate.isPending ? c("loading") : t("generateRecords")}
            </button>
          </>
        }
      />
      <TablePanelBody
        loading={records.isLoading}
        error={records.isError ? c("somethingWrong") : null}
        empty={!records.data?.length}
      >
        <DataTable
          columns={columns}
          data={records.data ?? []}
          getRowHref={(record) => `/dashboard/salary/records/${record.id}`}
        />
      </TablePanelBody>
    </section>
  );
}