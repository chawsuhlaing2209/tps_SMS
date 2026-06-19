"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { PaginationControls } from "../../lib/pagination-controls";
import { TablePanelBody, TablePanelHead, DataTableSection } from "../../lib/table-panel";
import { TableSearchInput } from "../../lib/table-search";
import { ModulePageHeader } from "../module-page-header";

type AuditLog = {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  actorUserId: string | null;
  reason: string | null;
  createdAt: string;
};

type AuditList = { data: AuditLog[]; total: number; limit: number; offset: number };

const PAGE_SIZE = 50;

export default function AuditPage() {
  const t = useTranslations("audit");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const [recordType, setRecordType] = useState("");
  const [page, setPage] = useState(0);

  const audit = useApiQuery<AuditList>((tenant) => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE)
    });
    if (recordType.trim()) {
      params.set("recordType", recordType.trim());
    }
    return `/tenants/${tenant}/audit-logs?${params.toString()}`;
  });

  const columns: ColumnDef<AuditLog, unknown>[] = [
    {
      id: "action",
      header: t("action"),
      accessorKey: "action",
      cell: ({ row }) => <code>{row.original.action}</code>
    },
    { id: "recordType", header: t("recordType"), accessorFn: (e) => e.recordType },
    {
      id: "record",
      header: t("record"),
      accessorFn: (e) => e.recordId,
      cell: ({ row }) => <span className="pds-type-body-s-regular muted">{row.original.recordId.slice(0, 8)}</span>
    },
    {
      id: "actor",
      header: t("actor"),
      accessorFn: (e) => e.actorUserId ?? c("system"),
      cell: ({ row }) => (
        <span className="pds-type-body-s-regular muted">{row.original.actorUserId?.slice(0, 8) ?? c("system")}</span>
      )
    }
  ];

  return (
    <div className="page-stack">
      <ModulePageHeader navKey="audit" title={nav("audit")} />
    <DataTableSection>
      <TablePanelHead
          title={t("events")}
          onRefresh={() => void audit.refetch()}
          extra={
            <TableSearchInput
              value={recordType}
              placeholder={t("filterPlaceholder")}
              aria-label={t("filterRecordType")}
              onChange={(e) => {
                setRecordType(e.target.value);
                setPage(0);
              }}
            />
          }
        />
        <TablePanelBody
          loading={audit.isLoading}
          error={audit.isError ? c("somethingWrong") : null}
          empty={!audit.data?.data.length}
        >
          <DataTable<AuditLog> columns={columns} data={audit.data?.data ?? []} />
        </TablePanelBody>
        <PaginationControls
          page={page}
          pageSize={PAGE_SIZE}
          total={audit.data?.total ?? 0}
          onPageChange={setPage}
        />
    </DataTableSection>
    </div>
  );
}