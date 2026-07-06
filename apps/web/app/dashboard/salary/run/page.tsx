"use client";

import { FormDatePicker } from "../../../../components/shared/form-input";
import { formatMMK } from "../../../lib/money";
import { PdsSearchBar, PdsSearchFiltersRow, PdsSelectField } from "../../../../components/pds";
import { StatCard, StatGrid } from "../../../../components/shared/stat-card";
import { StatusBadge } from "../../../../components/shared/badge";
import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable, DirectoryMemberCell } from "../../../lib/data-table";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { DataTableSection, TablePanelBody } from "../../../lib/table-panel";
import { ModulePageHeader } from "../../module-page-header";
import { PayrollStaffConfigModal } from "./payroll-staff-config-modal";

type PayrollRun = {
  id: string;
  month: string;
  status: string;
};

type PayrollRunSummary = {
  netPayroll: number;
  paidOut: number;
  pending: number;
  bonuses: number;
  staffCount: number;
};

type PayrollRecordRow = {
  id: string;
  staffId: string;
  staffFullName: string | null;
  staffEmail: string | null;
  department: string | null;
  departmentId: string | null;
  baseSalary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  netPay: number;
  status: string;
};

type DepartmentOption = { id: string; name: string };

const runsPath = (tenant: string, month: string) =>
  `/tenants/${tenant}/payroll-runs?month=${encodeURIComponent(month)}`;

function formatMoney(value: number): string {
  return formatMMK(value);
}

export default function RunPayrollPage() {
  const t = useTranslations("salary");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["salary.manage"]);

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [configRecordId, setConfigRecordId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configPayslipHint, setConfigPayslipHint] = useState(false);

  const runs = useApiQuery<PayrollRun[]>(
    canManage ? (tenant) => runsPath(tenant, month) : () => null,
    { staleTime: 0 }
  );

  const activeRun = runs.data?.[0] ?? null;
  const runId = activeRun?.id ?? null;

  const summary = useApiQuery<PayrollRunSummary>(
    (tenant) => (runId ? `/tenants/${tenant}/payroll-runs/${runId}/summary` : null),
    { staleTime: 0 }
  );

  const recordsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (departmentFilter) params.set("departmentId", departmentFilter);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [search, departmentFilter, statusFilter]);

  const records = useApiQuery<PayrollRecordRow[]>(
    (tenant) =>
      runId ? `/tenants/${tenant}/payroll-runs/${runId}/records${recordsQuery}` : null,
    { staleTime: 0 }
  );

  const departments = useApiQuery<DepartmentOption[]>(
    canManage ? (tenant) => `/tenants/${tenant}/departments/active` : () => null
  );

  const createRun = useApiMutation<{ month: string }>(
    (body, tenant) => ({
      path: `/tenants/${tenant}/payroll-runs`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [`/tenants/${tenant}/payroll-runs`] }
  );

  const generateRun = useApiMutation<{ runId: string }>(
    ({ runId: id }, tenant) => ({
      path: `/tenants/${tenant}/payroll-runs/${id}/generate`,
      init: { method: "POST", body: JSON.stringify({}) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/payroll-runs`,
        `/tenants/${tenant}/payroll-runs/${runId}/summary`,
        `/tenants/${tenant}/payroll-runs/${runId}/records`
      ]
    }
  );

  const generating = createRun.isPending || generateRun.isPending;

  async function handleGenerate() {
    let id = runId;
    if (!id) {
      const created = await createRun.mutateAsync({ month });
      id = (created as PayrollRun).id;
    }
    await generateRun.mutateAsync({ runId: id });
    void runs.refetch();
    void summary.refetch();
    void records.refetch();
  }

  useEffect(() => {
    setSearch("");
    setDepartmentFilter("");
    setStatusFilter("");
  }, [month]);

  const columns: ColumnDef<PayrollRecordRow, unknown>[] = [
    {
      id: "staff",
      header: c("staffMember"),
      accessorFn: (row) => row.staffFullName ?? row.staffId,
      cell: ({ row }) => (
        <DirectoryMemberCell
          name={row.original.staffFullName ?? row.original.staffId.slice(0, 8)}
          email={row.original.staffEmail}
        />
      )
    },
    {
      id: "department",
      header: t("department"),
      accessorKey: "department",
      cell: ({ row }) => row.original.department ?? "—"
    },
    {
      id: "base",
      header: t("baseSalary"),
      accessorKey: "baseSalary",
      cell: ({ row }) => formatMoney(row.original.baseSalary)
    },
    {
      id: "allowances",
      header: t("allowances"),
      accessorKey: "allowances",
      cell: ({ row }) => formatMoney(row.original.allowances)
    },
    {
      id: "bonus",
      header: t("bonus"),
      accessorKey: "bonus",
      cell: ({ row }) => formatMoney(row.original.bonus)
    },
    {
      id: "deductions",
      header: t("deductions"),
      accessorKey: "deductions",
      cell: ({ row }) => formatMoney(row.original.deductions)
    },
    {
      id: "net",
      header: t("netAmount"),
      accessorKey: "netPay",
      cell: ({ row }) => formatMoney(row.original.netPay)
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          label={t(`status.${row.original.status}` as "status.draft")}
        />
      )
    },
    {
      id: "actions",
      header: c("actions"),
      enableSorting: false,
      cell: ({ row }) => {
        const isPaid = row.original.status === "paid";
        return (
          <button
            type="button"
            className="pds-type-body-s-regular row-action"
            aria-label={isPaid ? c("view") : t("configureRecord")}
            onClick={() => {
              setConfigRecordId(row.original.id);
              setConfigPayslipHint(row.original.status !== "draft");
              setConfigOpen(true);
            }}
          >
            <Icon name={isPaid ? "visibility" : "tune"} size={18} />
          </button>
        );
      }
    }
  ];

  if (!canManage) {
    return null;
  }

  const summaryData = summary.data;

  return (
    <div className="directory-page">
      <ModulePageHeader
        navKey="runPayroll"
        title={t("runPayroll")}
        description={t("runPayrollDescription")}
        actions={
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            disabled={generating}
            onClick={() => void handleGenerate()}
          >
            <Icon name="bolt" />
            {generating ? c("loading") : t("generatePayroll")}
          </button>
        }
      />

      <StatGrid>
        <StatCard
          label={t("kpiNetPayroll")}
          value={summaryData ? formatMoney(summaryData.netPayroll) : "—"}
          icon={<Icon name="account_balance_wallet" size={20} />}
          accent
        />
        <StatCard
          label={t("kpiPaidOut")}
          value={summaryData ? formatMoney(summaryData.paidOut) : "—"}
          icon={<Icon name="payments" size={20} />}
        />
        <StatCard
          label={t("kpiPending")}
          value={summaryData ? formatMoney(summaryData.pending) : "—"}
          icon={<Icon name="pending" size={20} />}
        />
        <StatCard
          label={t("kpiBonuses")}
          value={summaryData ? formatMoney(summaryData.bonuses) : "—"}
          icon={<Icon name="card_giftcard" size={20} />}
        />
      </StatGrid>

      <DataTableSection>
        <PdsSearchFiltersRow
          filters={
            <>
              <PdsSearchBar
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchStaff")}
                aria-label={t("searchStaff")}
              />
              <div className="pds-search-filters-row__filter--160">
                <FormDatePicker
                  type="month"
                  variant="filter"
                  ariaLabel={t("month")}
                  placeholder={t("month")}
                  value={month}
                  onValueChange={setMonth}
                />
              </div>
              <div className="pds-search-filters-row__filter--160">
                <PdsSelectField
                  variant="filter"
                  value={departmentFilter}
                  onValueChange={(value) =>
                    setDepartmentFilter(typeof value === "string" ? value : "")
                  }
                  placeholder={t("allDepartments")}
                  options={(departments.data ?? []).map((dept) => ({
                    value: dept.id,
                    label: dept.name
                  }))}
                />
              </div>
              <div className="pds-search-filters-row__filter--160">
                <PdsSelectField
                  variant="filter"
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(typeof value === "string" ? value : "")
                  }
                  placeholder={t("allStatuses")}
                  options={["draft", "pending", "approved", "paid"].map((status) => ({
                    value: status,
                    label: t(`status.${status}` as "status.draft")
                  }))}
                />
              </div>
            </>
          }
        />

        <TablePanelBody
          variant="plain"
          loading={records.isLoading || runs.isLoading}
          error={records.isError ? c("somethingWrong") : null}
          empty={!records.data?.length}
          emptyTitle={t("emptyPayrollTitle")}
          emptyDescription={t("emptyPayrollDescription")}
          emptyIcon="payments"
          unwrapEmpty
        >
          <DataTable columns={columns} data={records.data ?? []} />
        </TablePanelBody>
      </DataTableSection>

      <PayrollStaffConfigModal
        recordId={configRecordId}
        open={configOpen}
        payslipHint={configPayslipHint}
        onOpenChange={(open) => {
          setConfigOpen(open);
          if (!open) {
            setConfigRecordId(null);
            setConfigPayslipHint(false);
          }
        }}
        onSaved={() => {
          void summary.refetch();
          void records.refetch();
        }}
      />
    </div>
  );
}
