"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";
import { Field } from "../../lib/form";
import { TablePanelBody, TablePanelHead } from "../../lib/table-panel";

type AuditLog = {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  actorUserId: string | null;
  reason: string | null;
  createdAt: string;
};

export default function AuditPage() {
  const t = useTranslations("audit");
  const c = useTranslations("common");
  const [recordType, setRecordType] = useState("");

  const audit = useApiQuery<AuditLog[]>((tenant) =>
    recordType
      ? `/tenants/${tenant}/audit-logs?recordType=${encodeURIComponent(recordType)}`
      : `/tenants/${tenant}/audit-logs`
  );

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
      cell: ({ row }) => <span className="muted">{row.original.recordId.slice(0, 8)}</span>
    },
    {
      id: "actor",
      header: t("actor"),
      accessorFn: (e) => e.actorUserId ?? c("system"),
      cell: ({ row }) => (
        <span className="muted">{row.original.actorUserId?.slice(0, 8) ?? c("system")}</span>
      )
    }
  ];

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </div>

      <section className="panel">
        <TablePanelHead
          title={t("events")}
          onRefresh={() => void audit.refetch()}
          extra={
            <div className="table-toolbar">
              <Field label={t("filterRecordType")}>
                <input
                  value={recordType}
                  onChange={(e) => setRecordType(e.target.value)}
                  placeholder={t("filterPlaceholder")}
                />
              </Field>
            </div>
          }
        />
        <TablePanelBody
          loading={audit.isLoading}
          error={audit.isError ? c("somethingWrong") : null}
          empty={!audit.data?.length}
        >
          <DataTable<AuditLog> columns={columns} data={audit.data ?? []} />
        </TablePanelBody>
      </section>
    </div>
  );
}
