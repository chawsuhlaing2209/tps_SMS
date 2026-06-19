"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useApiQuery } from "../../../../lib/api";
import { DataTable } from "../../../../lib/data-table";
import { PaginationControls } from "../../../../lib/pagination-controls";
import { TablePanelBody } from "../../../../lib/table-panel";
import { StatusBadge } from "../../../../../components/shared/badge";
import { PdsSelectField } from "../../../../../components/pds";
import { InvoicesBillingMonthFilter, InvoicesHeaderActions } from "./invoices-actions-provider";

export type InvoiceSource = "enrollment" | "recurring" | "ad_hoc";

type Invoice = {
  id: string;
  invoiceNumber: string;
  studentFullName: string | null;
  total: string;
  status: string;
  dueDate: string | null;
  source: InvoiceSource;
  enrollmentId: string | null;
  updatedAt?: string;
};

type InvoiceList = { data: Invoice[]; total: number };

const INVOICES_PATH = (tenant: string) => `/tenants/${tenant}/finance/invoices`;
const PAGE_SIZE = 50;

type InvoicesToolbarProps = {
  gradeId?: string;
  gradeName?: string;
};

/** @deprecated Use InvoicesBillingMonthFilter + InvoicesHeaderActions directly. */
export function InvoicesToolbar(_props: InvoicesToolbarProps) {
  return (
    <>
      <InvoicesBillingMonthFilter />
      <InvoicesHeaderActions />
    </>
  );
}

type InvoicesTableProps = {
  gradeId: string;
  academicYearId: string;
};

export function InvoicesTable({ gradeId, academicYearId }: InvoicesTableProps) {
  const t = useTranslations("finance");
  const c = useTranslations("common");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(0);

  const invoicesQuery = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      academicYearId,
      gradeId,
    });
    if (sourceFilter) {
      params.set("source", sourceFilter);
    }
    return `?${params.toString()}`;
  }, [academicYearId, gradeId, page, sourceFilter]);

  const invoices = useApiQuery<InvoiceList>((tenant) => `${INVOICES_PATH(tenant)}${invoicesQuery}`);

  const sourceLabel = (source: InvoiceSource) => {
    if (source === "enrollment") return t("sourceEnrollment");
    if (source === "recurring") return t("sourceRecurring");
    return t("sourceOther");
  };

  const columns: ColumnDef<Invoice, unknown>[] = [
    {
      id: "number",
      header: t("invoiceNumber"),
      accessorFn: (i) => i.invoiceNumber,
      cell: ({ row }) => row.original.invoiceNumber,
    },
    { id: "student", header: t("student"), accessorFn: (i) => i.studentFullName ?? "—" },
    {
      id: "source",
      header: t("source"),
      accessorFn: (i) => sourceLabel(i.source),
    },
    { id: "total", header: t("total"), accessorKey: "total" },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    { id: "due", header: t("dueDate"), accessorFn: (i) => i.dueDate ?? "—" },
  ];

  return (
    <>
      <div className="table-toolbar table-toolbar--spaced">
        <label className="form-inline">
          <span className="pds-type-body-s-regular muted">{t("source")}</span>
          <PdsSelectField
            variant="filter"
            value={sourceFilter}
            onValueChange={(value) => {
              setSourceFilter(typeof value === "string" ? value : "");
              setPage(0);
            }}
            placeholder={t("allSources")}
            options={[
              { value: "enrollment", label: t("sourceEnrollment") },
              { value: "recurring", label: t("sourceRecurring") },
              { value: "ad_hoc", label: t("sourceOther") },
            ]}
          />
        </label>
      </div>
      <TablePanelBody
        loading={invoices.isLoading}
        error={invoices.isError ? c("somethingWrong") : null}
        empty={!invoices.data?.data.length}
      >
        <DataTable
          columns={columns}
          data={invoices.data?.data ?? []}
          getRowHref={(invoice) => `/dashboard/finance/invoices/${invoice.id}`}
        />
      </TablePanelBody>
      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={invoices.data?.total ?? 0}
        onPageChange={setPage}
      />
    </>
  );
}
