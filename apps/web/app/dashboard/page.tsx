"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useApiQuery } from "../lib/api";
import { DataTable } from "../lib/data-table";

type CountRecord = { id: string };
type AuditLog = {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  actorUserId: string | null;
  createdAt: string;
};

function useCount(resource: string) {
  return useApiQuery<CountRecord[]>((tenant) => `/tenants/${tenant}/${resource}`);
}

export default function OverviewPage() {
  const t = useTranslations("overview");
  const c = useTranslations("common");

  const years = useCount("academics/academic-years");
  const grades = useCount("academics/grades");
  const sections = useCount("academics/sections");
  const subjects = useCount("academics/subjects");
  const users = useCount("identity/users");
  const audit = useApiQuery<AuditLog[]>((tenant) => `/tenants/${tenant}/audit-logs`);

  const stats = [
    { label: t("academicYears"), state: years },
    { label: t("grades"), state: grades },
    { label: t("sections"), state: sections },
    { label: t("subjects"), state: subjects },
    { label: t("users"), state: users }
  ];

  const columns: ColumnDef<AuditLog, unknown>[] = [
    { id: "when", header: t("when"), accessorFn: (e) => new Date(e.createdAt).toLocaleString() },
    {
      id: "action",
      header: t("action"),
      cell: ({ row }) => <code>{row.original.action}</code>
    },
    {
      id: "record",
      header: t("record"),
      cell: ({ row }) => (
        <>
          {row.original.recordType}
          <span className="muted"> · {row.original.recordId.slice(0, 8)}</span>
        </>
      )
    }
  ];

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </div>

      <div className="stat-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <span className="stat-label">{stat.label}</span>
            <span className="stat-value">
              {stat.state.isLoading ? "…" : stat.state.isError ? "—" : stat.state.data?.length ?? 0}
            </span>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("recentActivity")}</h2>
          <button type="button" className="btn-ghost" onClick={() => void audit.refetch()}>
            {c("refresh")}
          </button>
        </div>
        {audit.isLoading ? (
          <p className="muted">{t("loadingActivity")}</p>
        ) : audit.isError ? (
          <p className="error-text">{c("somethingWrong")}</p>
        ) : !audit.data?.length ? (
          <p className="muted">{t("noActivity")}</p>
        ) : (
          <DataTable<AuditLog> columns={columns} data={audit.data.slice(0, 8)} />
        )}
      </section>
    </div>
  );
}
