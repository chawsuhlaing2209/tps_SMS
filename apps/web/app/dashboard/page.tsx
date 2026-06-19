"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useApiQuery } from "../lib/api";
import { DataTable } from "../lib/data-table";
import { Icon } from "../lib/material-icon";
import { hasAnyPermission } from "../lib/permissions";
import { getSession } from "../lib/session";
import { PageHeader } from "./page-header-context";
import { StatCard, StatGrid } from "../../components/shared/stat-card";
import { EmptyState } from "../../components/shared/empty-state";

type DashboardSummary = {
  activeAcademicYear: boolean;
  gradesWithSubjects: number;
  classrooms: number;
  teachersWithAssignments: number;
  timetablePeriods: number;
  feeItems: number;
  enrollmentPlans: number;
};

type AuditLog = {
  id: string;
  action: string;
  recordType: string;
  recordId: string;
  actorUserId: string | null;
  createdAt: string;
};

type AuditList = { data: AuditLog[]; total: number };

export default function OverviewPage() {
  const t = useTranslations("overview");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;

  const canViewSetup = hasAnyPermission(permissions, [
    "academic_setup.manage",
    "hr.manage",
    "finance.manage"
  ]);
  const canViewAudit = hasAnyPermission(permissions, ["audit.view"]);
  const canViewStudents = hasAnyPermission(permissions, ["student.view", "student.manage"]);
  const canViewClassrooms = hasAnyPermission(permissions, [
    "student.view",
    "student.manage",
    "classroom.manage"
  ]);

  const summary = useApiQuery<DashboardSummary>((tenant) =>
    canViewSetup ? `/tenants/${tenant}/dashboard/summary` : null
  );
  const students = useApiQuery<{ total: number }>((tenant) =>
    canViewStudents ? `/tenants/${tenant}/students?limit=1` : null
  );
  const classrooms = useApiQuery<{ id: string }[]>((tenant) =>
    canViewClassrooms ? `/tenants/${tenant}/classrooms` : null
  );
  const audit = useApiQuery<AuditList>((tenant) =>
    canViewAudit ? `/tenants/${tenant}/audit-logs?limit=8` : null
  );

  const checklist = summary.data
    ? [
        {
          key: "year",
          done: summary.data.activeAcademicYear,
          href: "/dashboard/academic-setup/years",
          label: t("checklistYear")
        },
        {
          key: "grades",
          done: summary.data.gradesWithSubjects > 0,
          href: "/dashboard/structure",
          label: t("checklistGrades")
        },
        {
          key: "classrooms",
          done: summary.data.classrooms > 0,
          href: "/dashboard/structure",
          label: t("checklistClassrooms")
        },
        {
          key: "team",
          done: summary.data.teachersWithAssignments > 0,
          href: "/dashboard/people",
          label: t("checklistTeam")
        },
        {
          key: "timetable",
          done: summary.data.timetablePeriods > 0,
          href: "/dashboard/timetable",
          label: t("checklistTimetable")
        },
        {
          key: "finance",
          done: summary.data.feeItems > 0 && summary.data.enrollmentPlans > 0,
          href: "/dashboard/finance/fee-items",
          label: t("checklistFinance")
        }
      ]
    : [];

  const teacherStats = [
    { label: t("classrooms"), value: classrooms.data?.length ?? 0 },
    { label: t("students"), value: students.data?.total ?? 0 }
  ];

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
          <span className="pds-type-body-s-regular muted"> · {row.original.recordId.slice(0, 8)}</span>
        </>
      )
    }
  ];

  return (
    <div className="page-stack">
      <PageHeader title={t("title")} description={t("description")} />

      {canViewSetup ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="pds-type-title-xs-bold">{t("setupChecklist")}</h2>
          </div>
          <p className="pds-type-body-s-regular muted panel-help">{t("setupChecklistHelp")}</p>
          {summary.isLoading ? (
            <p className="pds-type-body-s-regular muted">{c("loading")}</p>
          ) : (
            <ul className="checklist">
              {checklist.map((item) => (
                <li key={item.key} className={item.done ? "checklist-item checklist-item--done" : "checklist-item"}>
                  <span>{item.done ? "✓" : "○"}</span>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <StatGrid>
          {teacherStats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={classrooms.isLoading || students.isLoading ? "…" : stat.value}
            />
          ))}
        </StatGrid>
      )}

      {canViewAudit ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="pds-type-title-xs-bold">{t("recentActivity")}</h2>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => void audit.refetch()}>
              <Icon name="refresh" />
              {c("refresh")}
            </button>
          </div>
          {audit.isLoading ? (
            <p className="pds-type-body-s-regular muted">{t("loadingActivity")}</p>
          ) : audit.isError ? (
            <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
          ) : !audit.data?.data.length ? (
            <EmptyState compact embedded icon="history" title={t("noActivity")} />
          ) : (
            <DataTable<AuditLog> columns={columns} data={audit.data.data} />
          )}
        </section>
      ) : null}
    </div>
  );
}
