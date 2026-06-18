"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useApiQuery } from "../../../lib/api";
import { DirectoryMemberCell } from "../../../lib/data-table";
import { Icon } from "../../../lib/material-icon";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { Badge, type BadgeTone } from "../../../../components/shared/badge";
import { BillingInvoicePreviewModal } from "./invoice-preview-modal";
import { RecordPaymentModal, type RosterRow } from "./record-payment-modal";
import { FinanceTableShell } from "../finance-table-shell";

type Roster = {
  academicYear: { id: string; name: string };
  term: { id: string; name: string } | null;
  grades: Array<{ id: string; name: string }>;
  metrics: {
    billed: number;
    collected: number;
    outstanding: number;
    overdue: number;
    owingStudents: number;
    overdueStudents: number;
    collectionRate: number;
    totalStudents: number;
  };
  rows: RosterRow[];
};

type StatusFilter = "" | "paid" | "partial" | "due" | "overdue";

const STATUS_FILTERS: StatusFilter[] = ["", "paid", "partial", "due", "overdue"];
const STATUS_TONES: Record<RosterRow["status"], BadgeTone> = {
  paid: "success",
  partial: "warning",
  due: "info",
  overdue: "danger"
};

function compactMMK(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function fullNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export default function FeesBillingPage() {
  const t = useTranslations("finance.feesBilling");
  const tFinance = useTranslations("finance");
  const nav = useTranslations("nav");

  const currentYear = useCurrentAcademicYear();
  const academicYearId = currentYear.data?.id ?? "";

  const [gradeId, setGradeId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [collectStudentId, setCollectStudentId] = useState<string | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const rosterQuery = useMemo(() => {
    const params = new URLSearchParams({ academicYearId });
    if (gradeId) params.set("gradeId", gradeId);
    return params.toString();
  }, [academicYearId, gradeId]);

  const roster = useApiQuery<Roster>((tenant) =>
    academicYearId ? `/tenants/${tenant}/finance/billing/roster?${rosterQuery}` : null
  );

  const data = roster.data;
  const allRows = data?.rows ?? [];

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (status && row.status !== status) return false;
      if (!needle) return true;
      return (
        row.studentFullName.toLowerCase().includes(needle) ||
        (row.guardianName?.toLowerCase().includes(needle) ?? false) ||
        row.admissionNumber.toLowerCase().includes(needle)
      );
    });
  }, [allRows, status, search]);

  const metrics = data?.metrics;
  const grades = data?.grades ?? [];
  const termName = data?.term?.name ?? null;

  const openCollect = (studentId: string | null) => {
    setCollectStudentId(studentId);
    setModalOpen(true);
  };

  return (
    <div className="fees-page">
      <PageHeader
        title={tFinance("title")}
        breadcrumbs={[{ label: nav("financeCrumb") }]}
      />

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <section className="fees-metrics" aria-label={t("collectionRate")}>
        <article className="fees-metric fees-metric--accent">
          <span className="fees-metric__label">
            <Icon name="account_balance_wallet" size={16} />
            {t("collected")}
            {termName ? <span className="fees-metric__chip">{termName}</span> : null}
          </span>
          <strong className="fees-metric__value">{compactMMK(metrics?.collected ?? 0)}</strong>
          <span className="fees-metric__sub">
            {t("billedOf", {
              rate: metrics?.collectionRate ?? 0,
              billed: compactMMK(metrics?.billed ?? 0)
            })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="hourglass_empty" size={16} />
            {t("outstanding")}
          </span>
          <strong className="fees-metric__value">{compactMMK(metrics?.outstanding ?? 0)}</strong>
          <span className="fees-metric__sub">
            {t("studentsOwing", { count: metrics?.owingStudents ?? 0 })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="warning" size={16} />
            {t("overdue")}
          </span>
          <strong className="fees-metric__value fees-metric__value--danger">
            {compactMMK(metrics?.overdue ?? 0)}
          </strong>
          <span className="fees-metric__sub">
            {t("studentsPastDue", { count: metrics?.overdueStudents ?? 0 })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="fees-metric__label">
            <Icon name="donut_large" size={16} />
            {t("collectionRate")}
          </span>
          <strong className="fees-metric__value">{metrics?.collectionRate ?? 0}%</strong>
          <span className="fees-progress" aria-hidden>
            <span
              className="fees-progress__fill"
              style={{ width: `${Math.min(100, metrics?.collectionRate ?? 0)}%` }}
            />
          </span>
        </article>
      </section>

      {/* ── Grade filter ─────────────────────────────────────────────── */}
      <section className="fees-grades">
        <span className="fees-grades__label">{t("grade")}</span>
        <div className="fees-grades__chips">
          <button
            type="button"
            className={!gradeId ? "fees-grade-chip fees-grade-chip--active" : "fees-grade-chip"}
            onClick={() => setGradeId("")}
          >
            {t("allGrades")}
          </button>
          {grades.map((grade) => (
            <button
              key={grade.id}
              type="button"
              className={
                gradeId === grade.id
                  ? "fees-grade-chip fees-grade-chip--active"
                  : "fees-grade-chip"
              }
              onClick={() => setGradeId(grade.id)}
            >
              {grade.name}
            </button>
          ))}
        </div>
      </section>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <section className="fees-toolbar">
        <div className="fees-search">
          <Icon name="search" size={18} className="fees-search__icon" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <div className="fees-segmented" role="tablist" aria-label={t("status")}>
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || "all"}
              type="button"
              role="tab"
              aria-selected={status === value}
              className={
                status === value ? "fees-segment fees-segment--active" : "fees-segment"
              }
              onClick={() => setStatus(value)}
            >
              {value ? t(`statusFilters.${value}`) : t("statusFilters.all")}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary fees-record-btn"
          disabled={!metrics?.owingStudents}
          onClick={() => openCollect(null)}
        >
          <Icon name="point_of_sale" size={18} />
          {t("recordPayment")}
        </button>
      </section>

      <FinanceTableShell
        loading={roster.isLoading}
        error={roster.isError}
        empty={!rows.length}
        emptyMessage={t("empty")}
      >
        <div className="padauk-table-wrap">
          <table className="padauk-table">
            <thead>
              <tr>
                <th>{t("student")}</th>
                <th>{t("gradeRoom")}</th>
                <th>{t("guardian")}</th>
                <th className="padauk-table__num">{t("billed")}</th>
                <th className="padauk-table__num">{t("paid")}</th>
                <th className="padauk-table__num">{t("balance")}</th>
                <th>{t("status")}</th>
                <th className="padauk-table__actions">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const gradeRoom = [row.gradeName, row.classroomName].filter(Boolean).join(" · ");
                return (
                  <tr key={row.studentId}>
                    <td>
                      <DirectoryMemberCell
                        name={row.studentFullName}
                        subtitle={row.admissionNumber}
                        colorKey={row.studentId}
                      />
                    </td>
                    <td>{gradeRoom || "—"}</td>
                    <td className="padauk-table__muted">{row.guardianName ?? "—"}</td>
                    <td className="padauk-table__num">{fullNumber(row.billed)}</td>
                    <td className="padauk-table__num">{fullNumber(row.paid)}</td>
                    <td className="padauk-table__num">
                      <strong>{fullNumber(row.balance)}</strong>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONES[row.status]}>{t(`statusLabels.${row.status}`)}</Badge>
                    </td>
                    <td className="padauk-table__actions">
                      <div className="table-row-actions">
                        {row.primaryInvoiceId ? (
                          <button
                            type="button"
                            className="table-row-action"
                            onClick={() => setPreviewInvoiceId(row.primaryInvoiceId)}
                          >
                            <Icon name="receipt_long" size={16} />
                            {t("invoice")}
                          </button>
                        ) : (
                          <span className="table-row-action table-row-action--disabled">
                            <Icon name="receipt_long" size={16} />
                            {t("invoice")}
                          </span>
                        )}
                        {row.status === "paid" ? (
                          <span className="table-row-settled">
                            <Icon name="check_circle" size={16} filled />
                            {t("settled")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="table-row-action table-row-action--primary"
                            onClick={() => openCollect(row.studentId)}
                          >
                            <Icon name="point_of_sale" size={16} />
                            {t("collect")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FinanceTableShell>

      <RecordPaymentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        rows={allRows}
        initialStudentId={collectStudentId}
        academicYearId={academicYearId}
        onCollected={() => void roster.refetch()}
      />

      <BillingInvoicePreviewModal
        invoiceId={previewInvoiceId}
        open={Boolean(previewInvoiceId)}
        onOpenChange={(open) => {
          if (!open) setPreviewInvoiceId(null);
        }}
      />
    </div>
  );
}
