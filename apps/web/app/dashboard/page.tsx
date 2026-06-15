"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useApiQuery } from "../lib/api";
import { DataTable } from "../lib/data-table";
import { hasAnyPermission } from "../lib/permissions";
import { getSession } from "../lib/session";

type CountRecord = { id: string };
type AuditLog = {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  actorUserId: string | null;
  createdAt: string;
};

function useCount(resource: string, enabled: boolean) {
  return useApiQuery<CountRecord[]>((tenant) =>
    enabled ? `/tenants/${tenant}/${resource}` : null
  );
}

export default function OverviewPage() {
  const t = useTranslations("overview");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;

  const canViewAcademics = hasAnyPermission(permissions, ["academic_setup.manage"]);
  const canViewUsers = hasAnyPermission(permissions, ["identity.manage"]);
  const canViewAudit = hasAnyPermission(permissions, ["audit.view"]);
  const canViewClassrooms = hasAnyPermission(permissions, [
    "student.view",
    "student.manage",
    "classroom.manage",
    "academic_setup.manage"
  ]);
  const canViewStudents = hasAnyPermission(permissions, ["student.view", "student.manage"]);

  const years = useCount("academics/academic-years", canViewAcademics);
  const grades = useCount("academics/grades", canViewAcademics);
  const subjects = useCount("academics/subjects", canViewAcademics);
  const users = useCount("identity/users", canViewUsers);
  const classrooms = useCount("classrooms", canViewClassrooms);
  const students = useCount("students", canViewStudents);
  const audit = useApiQuery<AuditLog[]>((tenant) =>
    canViewAudit ? `/tenants/${tenant}/audit-logs` : null
  );

  const adminStats = [
    { label: t("academicYears"), state: years },
    { label: t("grades"), state: grades },
    { label: t("classrooms"), state: classrooms },
    { label: t("subjects"), state: subjects },
    { label: t("users"), state: users }
  ];

  const teacherStats = [
    { label: t("classrooms"), state: classrooms },
    { label: t("students"), state: students }
  ];

  const stats = canViewAcademics ? adminStats : teacherStats;
  const description = canViewAcademics ? t("description") : t("teacherDescription");

  const columns: ColumnDef<AuditLog, unknown>[] = [
    {
      id: "action",
      header: t("action"),
      accessorKey: "action",
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
        <p>{description}</p>
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

      {canViewAudit ? (
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
      ) : null}
    </div>
  );
}
