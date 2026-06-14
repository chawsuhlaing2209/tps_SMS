"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useApiQuery } from "../../lib/api";
import { DataTable } from "../../lib/data-table";

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
  const audit = useApiQuery<AuditLog[]>((tenant) => `/tenants/${tenant}/audit-logs`);

  const columns: ColumnDef<AuditLog, unknown>[] = [
    { id: "when", header: t("when"), accessorFn: (e) => new Date(e.createdAt).toLocaleString() },
    {
      id: "action",
      header: t("action"),
      cell: ({ row }) => <code>{row.original.action}</code>
    },
    { id: "recordType", header: t("recordType"), accessorFn: (e) => e.recordType },
    {
      id: "record",
      header: t("record"),
      cell: ({ row }) => <span className="muted">{row.original.recordId.slice(0, 8)}</span>
    },
    {
      id: "actor",
      header: t("actor"),
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
        <div className="panel-head">
          <h2>{t("events")}</h2>
          <button type="button" className="btn-ghost" onClick={() => void audit.refetch()}>
            {c("refresh")}
          </button>
        </div>
        {audit.isLoading ? (
          <p className="muted">{c("loading")}</p>
        ) : audit.isError ? (
          <p className="error-text">{c("somethingWrong")}</p>
        ) : !audit.data?.length ? (
          <p className="muted">{t("noEvents")}</p>
        ) : (
          <DataTable<AuditLog> columns={columns} data={audit.data} />
        )}
      </section>
    </div>
  );
}
