"use client";

import { IconTagControl } from "../../../../components/pds/composites/icon-tag";
import { StatCard, StatGrid } from "../../../../components/shared/stat-card";
import { StatusBadge } from "../../../../components/shared/badge";
import { ArchiveVisibilityFilter } from "../../../../components/shared/archive-visibility-filter";
import { type ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { filterByArchiveVisibility, type ArchiveVisibility } from "../../../lib/archive-filter";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { DataTable } from "../../../lib/data-table";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { moduleBreadcrumbs } from "../../../lib/page-header-utils";
import { getSession } from "../../../lib/session";
import { DataTableSection, TablePanelBody } from "../../../lib/table-panel";
import { ModulePageHeader } from "../../module-page-header";
import { BenefitPackageCard } from "./benefit-package-card";
import {
  BenefitPackageFormSheet,
  type BenefitPackageRecord
} from "./benefit-package-form-sheet";
import {
  IncentiveProgramFormSheet,
  type IncentiveProgramRecord
} from "./incentive-program-form-sheet";
import { IncentiveProgramsTable } from "./incentive-programs-table";
import {
  PayComponentFormSheet,
  type PayComponentRecord
} from "./pay-component-form-sheet";

type BenefitsMetrics = {
  benefitsPerMonth: number;
  activePackages: number;
  totalEnrolments: number;
  bonusesThisTerm: number;
  incentiveAwards: number;
  awardRecipients: number;
};

const PACKAGES_PATH = (tenant: string) => `/tenants/${tenant}/benefit-packages`;
const INCENTIVES_PATH = (tenant: string) => `/tenants/${tenant}/incentive-programs`;
const PAY_COMPONENTS_PATH = (tenant: string) => `/tenants/${tenant}/pay-components`;

function formatMoney(value: number) {
  return Math.round(value).toLocaleString();
}

function compactAmount(value: number) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const formatted = millions.toFixed(2).replace(/\.?0+$/, "");
    return `${formatted}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return formatMoney(value);
}

function incentivePaidTotal(program: IncentiveProgramRecord) {
  if (program.awardType === "percent") return 0;
  const recipients = program.recipients ?? program.eligibleCount ?? 0;
  return program.amount * recipients;
}

function formatDefaultAmount(
  component: PayComponentRecord,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const amount = Number(component.defaultAmount) || 0;
  if (component.calculation === "percent_of_basic") {
    return t("awardPercentValue", { percent: amount });
  }
  return t("awardFixedValue", { amount: formatMoney(amount) });
}

export default function SalaryBenefitsPage() {
  const t = useTranslations("salary");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["salary.manage"]);

  const [tab, setTab] = useState<"packages" | "incentives" | "components">("packages");
  const [packageFormOpen, setPackageFormOpen] = useState(false);
  const [packageFormMode, setPackageFormMode] = useState<"create" | "edit">("create");
  const [editingPackage, setEditingPackage] = useState<BenefitPackageRecord | null>(null);
  const [incentiveFormOpen, setIncentiveFormOpen] = useState(false);
  const [incentiveFormMode, setIncentiveFormMode] = useState<"create" | "edit">("create");
  const [editingIncentive, setEditingIncentive] = useState<IncentiveProgramRecord | null>(null);
  const [componentFormOpen, setComponentFormOpen] = useState(false);
  const [componentFormMode, setComponentFormMode] = useState<"create" | "edit">("create");
  const [editingComponent, setEditingComponent] = useState<PayComponentRecord | null>(null);
  const [componentArchiveVisibility, setComponentArchiveVisibility] =
    useState<ArchiveVisibility>("active");

  const packages = useApiQuery<BenefitPackageRecord[]>(
    canManage ? PACKAGES_PATH : () => null
  );
  const incentives = useApiQuery<IncentiveProgramRecord[]>(
    canManage ? INCENTIVES_PATH : () => null
  );
  const payComponents = useApiQuery<PayComponentRecord[]>(
    canManage ? PAY_COMPONENTS_PATH : () => null
  );

  const filteredPayComponents = useMemo(
    () => filterByArchiveVisibility(payComponents.data ?? [], componentArchiveVisibility),
    [payComponents.data, componentArchiveVisibility]
  );

  const metrics = useMemo<BenefitsMetrics>(() => {
    const pkgList = packages.data ?? [];
    const incList = incentives.data ?? [];
    const activePackages = pkgList.filter((pkg) => pkg.status === "active");
    const activeIncentives = incList.filter((inc) => inc.status === "active");

    return {
      benefitsPerMonth: activePackages.reduce((sum, pkg) => sum + pkg.monthlyValue, 0),
      activePackages: activePackages.length,
      totalEnrolments: pkgList.reduce((sum, pkg) => sum + pkg.enrolledCount, 0),
      bonusesThisTerm: activeIncentives.reduce((sum, inc) => sum + incentivePaidTotal(inc), 0),
      incentiveAwards: activeIncentives.length,
      awardRecipients: activeIncentives.reduce(
        (sum, inc) => sum + (inc.recipients ?? inc.eligibleCount ?? 0),
        0
      )
    };
  }, [packages.data, incentives.data]);

  const createPackage = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: PACKAGES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [PACKAGES_PATH(tenant)] }
  );

  const updatePackage = useApiMutation<{ id: string } & Record<string, unknown>>(
    ({ id, ...body }, tenant) => ({
      path: `${PACKAGES_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [PACKAGES_PATH(tenant)] }
  );

  const archivePackage = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PACKAGES_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [PACKAGES_PATH(tenant)] }
  );

  const createIncentive = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: INCENTIVES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [INCENTIVES_PATH(tenant)] }
  );

  const updateIncentive = useApiMutation<{ id: string } & Record<string, unknown>>(
    ({ id, ...body }, tenant) => ({
      path: `${INCENTIVES_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [INCENTIVES_PATH(tenant)] }
  );

  const createPayComponent = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: PAY_COMPONENTS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const updatePayComponent = useApiMutation<{ id: string } & Record<string, unknown>>(
    ({ id, ...body }, tenant) => ({
      path: `${PAY_COMPONENTS_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const archivePayComponent = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PAY_COMPONENTS_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const reactivatePayComponent = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PAY_COMPONENTS_PATH(tenant)}/${id}/reactivate`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [PAY_COMPONENTS_PATH(tenant)] }
  );

  const openPackageForm = (mode: "create" | "edit", record?: BenefitPackageRecord | null) => {
    setPackageFormMode(mode);
    setEditingPackage(record ?? null);
    setPackageFormOpen(true);
  };

  const openComponentForm = (mode: "create" | "edit", record?: PayComponentRecord | null) => {
    setComponentFormMode(mode);
    setEditingComponent(record ?? null);
    setComponentFormOpen(true);
  };

  const openIncentiveForm = (mode: "create" | "edit", record?: IncentiveProgramRecord | null) => {
    setIncentiveFormMode(mode);
    setEditingIncentive(record ?? null);
    setIncentiveFormOpen(true);
  };

  const refreshAll = () => {
    void packages.refetch();
    void incentives.refetch();
    void payComponents.refetch();
  };

  const payComponentColumns: ColumnDef<PayComponentRecord, unknown>[] = [
    {
      id: "name",
      header: c("name"),
      accessorKey: "name",
      cell: ({ row }) => <span className="pds-type-body-m-bold">{row.original.name}</span>
    },
    {
      id: "code",
      header: t("codeLabel"),
      accessorKey: "code",
      cell: ({ row }) => <span className="pds-type-body-s-regular muted">{row.original.code}</span>
    },
    {
      id: "kind",
      header: t("kindLabel"),
      accessorKey: "kind",
      cell: ({ row }) => t(`kind.${row.original.kind}` as "kind.earning")
    },
    {
      id: "calculation",
      header: t("calculationLabel"),
      accessorKey: "calculation",
      cell: ({ row }) => t(`calculation.${row.original.calculation}` as "calculation.fixed")
    },
    {
      id: "defaultAmount",
      header: t("amount"),
      cell: ({ row }) => formatDefaultAmount(row.original, t)
    },
    {
      id: "status",
      header: c("status"),
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          label={t(`status.${row.original.status}` as "status.active")}
        />
      )
    },
    {
      id: "actions",
      header: c("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <div style={{ display: "flex", gap: "var(--pds-gap-small)" }}>
          <button
            type="button"
            className="pds-type-body-s-regular row-action"
            onClick={() => openComponentForm("edit", row.original)}
          >
            {c("edit")}
          </button>
          {row.original.status === "archived" ? (
            <button
              type="button"
              className="pds-type-body-s-regular row-action"
              disabled={reactivatePayComponent.isPending}
              onClick={() =>
                void reactivatePayComponent.mutateAsync({ id: row.original.id }).then(() => {
                  void payComponents.refetch();
                })
              }
            >
              {c("reactivate")}
            </button>
          ) : (
            <button
              type="button"
              className="pds-type-body-s-regular row-action"
              disabled={archivePayComponent.isPending}
              onClick={() =>
                void archivePayComponent.mutateAsync({ id: row.original.id }).then(() => {
                  void payComponents.refetch();
                })
              }
            >
              {c("archive")}
            </button>
          )}
        </div>
      )
    }
  ];

  if (!canManage) {
    return null;
  }

  return (
    <div className="directory-page benefits-page">
      <ModulePageHeader
        navKey="salary"
        title={t("bonusesBenefits")}
        description={t("bonusesBenefitsDescription")}
        breadcrumbs={moduleBreadcrumbs("salary", nav, [{ label: t("bonusesBenefits") }])}
        actions={
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={refreshAll}>
            <Icon name="refresh" />
            {c("refresh")}
          </button>
        }
      />

      <StatGrid className="benefits-page__stats">
        <StatCard
          label={t("kpiBenefitsMonth")}
          value={compactAmount(metrics.benefitsPerMonth)}
          hint={t("kpiBenefitsMonthHint")}
          icon={<Icon name="savings" size={20} />}
          accent
        />
        <StatCard
          label={t("kpiActivePackages")}
          value={metrics.activePackages}
          hint={t("kpiActivePackagesHint", { count: metrics.totalEnrolments })}
          icon={<Icon name="redeem" size={20} />}
        />
        <StatCard
          label={t("kpiBonusesThisTerm")}
          value={compactAmount(metrics.bonusesThisTerm)}
          hint={t("kpiBonusesThisTermHint")}
          icon={<Icon name="emoji_events" size={20} />}
        />
        <StatCard
          label={t("kpiIncentiveAwards")}
          value={metrics.incentiveAwards}
          hint={t("kpiIncentiveAwardsHint", { count: metrics.awardRecipients })}
          icon={<Icon name="military_tech" size={20} />}
        />
      </StatGrid>

      <div className="benefits-workspace-toolbar">
        <IconTagControl
          ariaLabel={t("benefitsTabLabel")}
          value={tab}
          onChange={(id: string) => setTab(id as "packages" | "incentives" | "components")}
          options={[
            { id: "packages", label: t("tabComplimentaryPackages"), icon: "redeem" },
            { id: "incentives", label: t("tabBonusIncentives"), icon: "military_tech" },
            { id: "components", label: t("tabPayComponents"), icon: "payments" }
          ]}
        />
        {tab === "packages" ? (
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            onClick={() => openPackageForm("create")}
          >
            <Icon name="add" />
            {t("addBenefitPackage")}
          </button>
        ) : tab === "incentives" ? (
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            onClick={() => openIncentiveForm("create")}
          >
            <Icon name="add" />
            {t("newIncentiveProgram")}
          </button>
        ) : (
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            onClick={() => openComponentForm("create")}
          >
            <Icon name="add" />
            {t("addComponent")}
          </button>
        )}
      </div>

      {tab === "packages" ? (
        <div className="benefits-packages-grid">
          {(packages.data ?? []).map((pkg) => (
            <BenefitPackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={(record) => openPackageForm("edit", record)}
              onArchive={(record) =>
                void archivePackage.mutateAsync({ id: record.id }).then(() => {
                  void packages.refetch();
                })
              }
            />
          ))}
        </div>
      ) : tab === "incentives" ? (
        <div className="benefits-incentives-section">
          <p className="pds-type-body-s-regular benefits-incentives-section__context">
            {t("incentivesContextLine")}
          </p>
          <DataTableSection>
            <section className="panel incentive-programs-panel">
              <TablePanelBody
                variant="plain"
                loading={incentives.isLoading}
                error={incentives.isError ? c("somethingWrong") : null}
                empty={!incentives.data?.length}
                emptyTitle={t("emptyIncentivesTitle")}
                emptyDescription={t("emptyIncentivesDescription")}
                emptyIcon="emoji_events"
              >
                <IncentiveProgramsTable
                  programs={incentives.data ?? []}
                  onEdit={(program) => openIncentiveForm("edit", program)}
                />
              </TablePanelBody>
            </section>
          </DataTableSection>
        </div>
      ) : (
        <DataTableSection>
          <div className="benefits-components-toolbar">
            <ArchiveVisibilityFilter
              value={componentArchiveVisibility}
              onChange={setComponentArchiveVisibility}
            />
          </div>
          <TablePanelBody
            loading={payComponents.isLoading}
            error={payComponents.isError ? c("somethingWrong") : null}
            empty={!filteredPayComponents.length}
            emptyTitle={t("emptyPayComponentsTitle")}
            emptyDescription={t("emptyPayComponentsDescription")}
            emptyIcon="payments"
            unwrapEmpty
          >
            <DataTable
              columns={payComponentColumns}
              data={filteredPayComponents}
              onRowClick={(row) => openComponentForm("edit", row)}
            />
          </TablePanelBody>
        </DataTableSection>
      )}

      <BenefitPackageFormSheet
        open={packageFormOpen}
        onOpenChange={setPackageFormOpen}
        mode={packageFormMode}
        record={editingPackage}
        submitting={createPackage.isPending || updatePackage.isPending}
        onSubmit={async (values) => {
          if (packageFormMode === "edit" && editingPackage) {
            await updatePackage.mutateAsync({ id: editingPackage.id, ...values });
          } else {
            await createPackage.mutateAsync(values);
          }
          setPackageFormOpen(false);
          void packages.refetch();
        }}
      />

      <IncentiveProgramFormSheet
        open={incentiveFormOpen}
        onOpenChange={setIncentiveFormOpen}
        mode={incentiveFormMode}
        record={editingIncentive}
        submitting={createIncentive.isPending || updateIncentive.isPending}
        onSubmit={async (values) => {
          const { icon: _icon, ...payload } = values;
          if (incentiveFormMode === "edit" && editingIncentive) {
            await updateIncentive.mutateAsync({ id: editingIncentive.id, ...payload });
          } else {
            await createIncentive.mutateAsync(payload);
          }
          setIncentiveFormOpen(false);
          void incentives.refetch();
        }}
      />

      <PayComponentFormSheet
        open={componentFormOpen}
        onOpenChange={setComponentFormOpen}
        mode={componentFormMode}
        record={editingComponent}
        submitting={createPayComponent.isPending || updatePayComponent.isPending}
        archiving={archivePayComponent.isPending || reactivatePayComponent.isPending}
        onSubmit={async (values) => {
          if (componentFormMode === "edit" && editingComponent) {
            await updatePayComponent.mutateAsync({ id: editingComponent.id, ...values });
          } else {
            await createPayComponent.mutateAsync(values);
          }
          setComponentFormOpen(false);
          void payComponents.refetch();
        }}
        onArchive={
          editingComponent
            ? async () => {
                await archivePayComponent.mutateAsync({ id: editingComponent.id });
                setComponentFormOpen(false);
                void payComponents.refetch();
              }
            : undefined
        }
        onReactivate={
          editingComponent
            ? async () => {
                await reactivatePayComponent.mutateAsync({ id: editingComponent.id });
                setComponentFormOpen(false);
                void payComponents.refetch();
              }
            : undefined
        }
      />
    </div>
  );
}
