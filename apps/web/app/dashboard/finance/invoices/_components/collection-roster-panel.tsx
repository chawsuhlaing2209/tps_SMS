"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLiveApiQuery } from "../../../../lib/api";
import { useDashPageTitleActionsTarget } from "../../../dashboard-page-title";
import { fetchAllPaginated } from "../../../../lib/export-csv";
import { getSession } from "../../../../lib/session";
import { DirectoryMemberCell } from "../../../../lib/data-table";
import { Icon } from "../../../../lib/material-icon";
import { PaginationControls } from "../../../../lib/pagination-controls";
import { useCurrentAcademicYear } from "../../../../lib/use-current-academic-year";
import { Badge, type BadgeTone } from "../../../../../components/shared/badge";
import { PdsSearchBar, PdsSearchFiltersRow, PdsSelectField } from "../../../../../components/pds";
import { FinanceTableShell } from "../../finance-table-shell";
import { ExportCsvButton } from "../../../../../components/shared/export-csv-button";
import { PadaukSortHeader, usePadaukSort } from "../../table-sort";
import { BillingInvoicePreviewModal } from "./invoice-preview-modal";
import { InvoicesIssueDateRangeFilter, useInvoicesActionsContext } from "./invoices-actions-provider";
import { RecordPaymentModal } from "./record-payment-modal";
import { appendIssueDateRangeParams } from "../../format-finance";

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
  rows: import("./record-payment-modal").RosterRow[];
  total: number;
  limit: number;
  offset: number;
};

type StatusFilter = "all" | "paid" | "partial" | "due" | "overdue";

const PAGE_SIZE = 50;
const STATUS_FILTER_OPTIONS: StatusFilter[] = ["all", "paid", "partial", "due", "overdue"];
const STATUS_TONES: Record<import("./record-payment-modal").RosterRow["status"], BadgeTone> = {
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

type CollectionSortKey = "student" | "status" | "balance";

type RosterRow = import("./record-payment-modal").RosterRow;

function CollectionRosterExportPortal({
  academicYearId,
  gradeId,
  status,
  search,
  sortKey,
  sortDir,
  issueDateRange,
  loading
}: {
  academicYearId: string;
  gradeId: string;
  status: StatusFilter;
  search: string;
  sortKey: CollectionSortKey;
  sortDir: string;
  issueDateRange: string;
  loading: boolean;
}) {
  const tFees = useTranslations("finance.feesBilling");
  const target = useDashPageTitleActionsTarget();

  if (!target) {
    return null;
  }

  return createPortal(
    <ExportCsvButton
      disabled={loading || !academicYearId}
      onExport={async () => {
        const tenantId = getSession()?.tenantId;
        if (!tenantId) {
          throw new Error("Not signed in.");
        }
        const rows = await fetchAllPaginated<RosterRow>(
          (limit, offset) => {
            const params = new URLSearchParams({
              academicYearId,
              limit: String(limit),
              offset: String(offset),
              sortBy: sortKey,
              sortDir
            });
            if (gradeId) params.set("gradeId", gradeId);
            if (status !== "all") params.set("status", status);
            if (search.trim()) params.set("search", search.trim());
            appendIssueDateRangeParams(params, issueDateRange);
            return `/tenants/${tenantId}/finance/billing/roster?${params.toString()}`;
          },
          (json) => {
            const payload = json as Roster;
            return { rows: payload.rows, total: payload.total };
          },
          500
        );
        return {
          filename: "collection-roster.csv",
          columns: [
            { key: "student", header: tFees("student") },
            { key: "gradeRoom", header: tFees("gradeRoom") },
            { key: "billed", header: tFees("billed") },
            { key: "collected", header: tFees("collected") },
            { key: "balance", header: tFees("outstanding") },
            { key: "status", header: tFees("status") }
          ],
          rows: rows.map((row) => ({
            student: row.studentFullName ?? "",
            gradeRoom: [row.gradeName, row.classroomName].filter(Boolean).join(" · "),
            billed: row.billed,
            collected: row.paid,
            balance: row.balance,
            status: row.status
          }))
        };
      }}
    />,
    target
  );
}

export function CollectionRosterPanel() {
  const tFees = useTranslations("finance.feesBilling");

  const currentYear = useCurrentAcademicYear();
  const academicYearId = currentYear.data?.id ?? "";

  const [gradeId, setGradeId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [collectStudentId, setCollectStudentId] = useState<string | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const { issueDateRange } = useInvoicesActionsContext();
  const { sortKey, sortDir, toggleSort } = usePadaukSort<CollectionSortKey>({
    defaultKey: "student",
    defaultDir: "asc",
    initialDir: { balance: "desc" }
  });

  useEffect(() => {
    setPage(0);
  }, [gradeId, status, search, sortKey, sortDir, issueDateRange]);

  const rosterQuery = useMemo(() => {
    const params = new URLSearchParams({
      academicYearId,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      sortBy: sortKey,
      sortDir
    });
    if (gradeId) params.set("gradeId", gradeId);
    if (status !== "all") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    appendIssueDateRangeParams(params, issueDateRange);
    return params.toString();
  }, [academicYearId, issueDateRange, gradeId, page, search, sortDir, sortKey, status]);

  const roster = useLiveApiQuery<Roster>(
    (tenant) =>
      academicYearId ? `/tenants/${tenant}/finance/billing/roster?${rosterQuery}` : null
  );

  const data = roster.data;
  const rows = data?.rows ?? [];
  const metrics = data?.metrics;
  const grades = data?.grades ?? [];
  const termName = data?.term?.name ?? null;

  const openCollect = (studentId: string | null) => {
    setCollectStudentId(studentId);
    setModalOpen(true);
  };

  return (
    <>
      <CollectionRosterExportPortal
        academicYearId={academicYearId}
        gradeId={gradeId}
        status={status}
        search={search}
        sortKey={sortKey}
        sortDir={sortDir}
        issueDateRange={issueDateRange}
        loading={currentYear.isLoading || roster.isLoading}
      />
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

      <PdsSearchFiltersRow
        filters={
          <>
            <PdsSearchBar
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tFees("searchPlaceholder")}
              aria-label={tFees("searchPlaceholder")}
            />
            <div className="pds-search-filters-row__filter--160">
              <PdsSelectField
                variant="filter"
                value={status}
                onValueChange={(value) => {
                  setStatus((typeof value === "string" ? value : "all") as StatusFilter);
                }}
                placeholder={tFees("statusFilters.all")}
                options={STATUS_FILTER_OPTIONS.map((value) => ({
                  value,
                  label: tFees(`statusFilters.${value}`),
                }))}
              />
            </div>
            <div className="pds-search-filters-row__filter--range">
              <InvoicesIssueDateRangeFilter />
            </div>
          </>
        }
        statusControl={
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary fees-record-btn"
            disabled={!metrics?.owingStudents}
            onClick={() => openCollect(null)}
          >
            <Icon name="point_of_sale" size={18} />
            {tFees("recordPayment")}
          </button>
        }
      />

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

      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={data?.total ?? 0}
        onPageChange={setPage}
      />

      <RecordPaymentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        variant="roster"
        initialStudentId={collectStudentId}
        academicYearId={academicYearId}
        gradeId={gradeId || undefined}
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
