"use client";
import { FormInput } from "../../../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useApiQuery } from "../../../../lib/api";
import { DirectoryMemberCell } from "../../../../lib/data-table";
import { Icon } from "../../../../lib/material-icon";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { Badge, type BadgeTone } from "../../../../../components/shared/badge";
import { FinanceTableShell } from "../../finance-table-shell";
import { PadaukSortHeader, usePadaukSort } from "../../table-sort";
import { BillingInvoicePreviewModal } from "./invoice-preview-modal";
import { InvoicesBillingMonthFilter } from "./invoices-actions-provider";
import { RecordPaymentModal, type RosterRow } from "./record-payment-modal";

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

const STATUS_SORT_RANK: Record<RosterRow["status"], number> = {
  overdue: 0,
  due: 1,
  partial: 2,
  paid: 3
};

type CollectionSortKey = "student" | "status" | "balance";

function sortCollectionRows(
  rows: RosterRow[],
  sortKey: CollectionSortKey,
  sortDir: "asc" | "desc"
) {
  const direction = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "student") {
      cmp = a.studentFullName.localeCompare(b.studentFullName);
    } else if (sortKey === "status") {
      cmp = STATUS_SORT_RANK[a.status] - STATUS_SORT_RANK[b.status];
    } else {
      cmp = a.balance - b.balance;
    }
    return cmp * direction;
  });
}

export function CollectionRosterPanel() {
  const tFees = useTranslations("finance.feesBilling");

  const currentYear = useCurrentAcademicYear();
  const academicYearId = currentYear.data?.id ?? "";

  const [gradeId, setGradeId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [collectStudentId, setCollectStudentId] = useState<string | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const { sortKey, sortDir, toggleSort } = usePadaukSort<CollectionSortKey>({
    defaultKey: "student",
    defaultDir: "asc",
    initialDir: { balance: "desc" }
  });

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
    const filtered = allRows.filter((row) => {
      if (status && row.status !== status) return false;
      if (!needle) return true;
      return (
        row.studentFullName.toLowerCase().includes(needle) ||
        (row.guardianName?.toLowerCase().includes(needle) ?? false) ||
        row.admissionNumber.toLowerCase().includes(needle)
      );
    });
    return sortCollectionRows(filtered, sortKey, sortDir);
  }, [allRows, search, sortDir, sortKey, status]);

  const metrics = data?.metrics;
  const grades = data?.grades ?? [];
  const termName = data?.term?.name ?? null;

  const openCollect = (studentId: string | null) => {
    setCollectStudentId(studentId);
    setModalOpen(true);
  };

  const refetchAll = () => {
    void roster.refetch();
  };

  return (
    <>
      <p className="pds-type-body-s-regular muted panel-help">{tFees("collectionViewHelp")}</p>

      <section className="fees-metrics" aria-label={tFees("collectionRate")}>
        <article className="fees-metric fees-metric--accent">
          <span className="pds-type-body-s-semibold fees-metric__label">
            <Icon name="account_balance_wallet" size={16} />
            {tFees("collected")}
            {termName ? <span className="pds-type-caption-s fees-metric__chip">{termName}</span> : null}
          </span>
          <strong className="pds-type-title-m-extrabold fees-metric__value">{compactMMK(metrics?.collected ?? 0)}</strong>
          <span className="pds-type-body-s-regular fees-metric__sub">
            {tFees("billedOf", {
              rate: metrics?.collectionRate ?? 0,
              billed: compactMMK(metrics?.billed ?? 0)
            })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="pds-type-body-s-semibold fees-metric__label">
            <Icon name="hourglass_empty" size={16} />
            {tFees("outstanding")}
          </span>
          <strong className="pds-type-title-m-extrabold fees-metric__value">{compactMMK(metrics?.outstanding ?? 0)}</strong>
          <span className="pds-type-body-s-regular fees-metric__sub">
            {tFees("studentsOwing", { count: metrics?.owingStudents ?? 0 })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="pds-type-body-s-semibold fees-metric__label">
            <Icon name="warning" size={16} />
            {tFees("overdue")}
          </span>
          <strong className="pds-type-title-m-extrabold fees-metric__value fees-metric__value--danger">
            {compactMMK(metrics?.overdue ?? 0)}
          </strong>
          <span className="pds-type-body-s-regular fees-metric__sub">
            {tFees("studentsPastDue", { count: metrics?.overdueStudents ?? 0 })}
          </span>
        </article>

        <article className="fees-metric">
          <span className="pds-type-body-s-semibold fees-metric__label">
            <Icon name="donut_large" size={16} />
            {tFees("collectionRate")}
          </span>
          <strong className="pds-type-title-m-extrabold fees-metric__value">{metrics?.collectionRate ?? 0}%</strong>
          <span className="fees-progress" aria-hidden>
            <span
              className="fees-progress__fill"
              style={{ width: `${Math.min(100, metrics?.collectionRate ?? 0)}%` }}
            />
          </span>
        </article>
      </section>

      <section className="fees-grades">
        <span className="pds-type-caption-s fees-grades__label" id="fees-grade-filter-label">
          {tFees("grade")}
        </span>
        <div
          className="fees-grades__chips"
          role="tablist"
          aria-labelledby="fees-grade-filter-label"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!gradeId}
            className={!gradeId ? "fees-grade-chip fees-grade-chip--active" : "fees-grade-chip"}
            onClick={() => setGradeId("")}
          >
            {tFees("allGrades")}
          </button>
          {grades.map((grade) => (
            <button
              key={grade.id}
              type="button"
              role="tab"
              aria-selected={gradeId === grade.id}
              className={
                gradeId === grade.id ? "fees-grade-chip fees-grade-chip--active" : "fees-grade-chip"
              }
              onClick={() => setGradeId(grade.id)}
            >
              {grade.name}
            </button>
          ))}
        </div>
      </section>

      <section className="fees-toolbar">
        <div className="pds-type-body-m-medium fees-search">
          <Icon name="search" size={18} className="fees-search__icon" />
          <FormInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tFees("searchPlaceholder")}
            aria-label={tFees("searchPlaceholder")}
          />
        </div>
        <div className="fees-segmented" role="tablist" aria-label={tFees("status")}>
          {STATUS_FILTERS.map((value) => (
            <button
              key={value || "all"}
              type="button"
              role="tab"
              aria-selected={status === value}
              className={status === value ? "fees-segment fees-segment--active" : "fees-segment"}
              onClick={() => setStatus(value)}
            >
              {value ? tFees(`statusFilters.${value}`) : tFees("statusFilters.all")}
            </button>
          ))}
        </div>
        <div className="fees-toolbar__actions">
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary fees-record-btn"
            disabled={!metrics?.owingStudents}
            onClick={() => openCollect(null)}
          >
            <Icon name="point_of_sale" size={18} />
            {tFees("recordPayment")}
          </button>
          <InvoicesBillingMonthFilter />
        </div>
      </section>

      <FinanceTableShell
        loading={currentYear.isLoading || roster.isLoading}
        error={roster.isError}
        empty={!rows.length}
        emptyMessage={tFees("empty")}
      >
        <div className="padauk-table-wrap">
          <table className="pds-type-body-m-medium padauk-table">
            <thead>
              <tr>
                <th className="pds-type-caption-s">
                  <PadaukSortHeader
                    label={tFees("student")}
                    active={sortKey === "student"}
                    direction={sortDir}
                    onClick={() => toggleSort("student")}
                  />
                </th>
                <th className="pds-type-caption-s">{tFees("gradeRoom")}</th>
                <th className="pds-type-caption-s">{tFees("guardian")}</th>
                <th className="pds-type-caption-s padauk-table__num">{tFees("billed")}</th>
                <th className="pds-type-caption-s padauk-table__num">{tFees("paid")}</th>
                <th className="pds-type-caption-s padauk-table__num">
                  <PadaukSortHeader
                    label={tFees("balance")}
                    active={sortKey === "balance"}
                    direction={sortDir}
                    onClick={() => toggleSort("balance")}
                  />
                </th>
                <th className="pds-type-caption-s">
                  <PadaukSortHeader
                    label={tFees("status")}
                    active={sortKey === "status"}
                    direction={sortDir}
                    onClick={() => toggleSort("status")}
                  />
                </th>
                <th className="pds-type-caption-s padauk-table__actions">{tFees("actions")}</th>
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
                      <Badge tone={STATUS_TONES[row.status]}>
                        {tFees(`statusLabels.${row.status}`)}
                      </Badge>
                    </td>
                    <td className="padauk-table__actions">
                      <div className="table-row-actions">
                        {row.primaryInvoiceId ? (
                          <button
                            type="button"
                            className="pds-type-body-s-semibold table-row-action"
                            onClick={() => setPreviewInvoiceId(row.primaryInvoiceId)}
                          >
                            <Icon name="receipt_long" size={16} />
                            {tFees("invoice")}
                          </button>
                        ) : (
                          <span className="pds-type-body-s-semibold table-row-action table-row-action--disabled">
                            <Icon name="receipt_long" size={16} />
                            {tFees("invoice")}
                          </span>
                        )}
                        {row.status === "paid" ? (
                          <span className="pds-type-body-s-semibold table-row-settled">
                            <Icon name="check_circle" size={16} filled />
                            {tFees("settled")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="pds-type-body-s-semibold table-row-action table-row-action--primary"
                            onClick={() => openCollect(row.studentId)}
                          >
                            <Icon name="point_of_sale" size={16} />
                            {tFees("collect")}
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
        variant="roster"
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
    </>
  );
}
