"use client";

import { SegmentedControl } from "../../../../components/pds/composites/segmented-control";
import { StatCard, StatGrid } from "../../../../components/shared/stat-card";
import { StatusBadge } from "../../../../components/shared/badge";
import { Chip } from "../../../../components/shared/chip";
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
import { isPadaukRowInteractiveTarget } from "../../../lib/table-row-interaction";
import { DataTableSection, TablePanelBody } from "../../../lib/table-panel";
import { ModulePageHeader } from "../../module-page-header";
import {
  BenefitPackageFormSheet,
  type BenefitPackageRecord
} from "./benefit-package-form-sheet";
import {
  IncentiveProgramFormSheet,
  type IncentiveProgramRecord
} from "./incentive-program-form-sheet";
import {
  PayComponentFormSheet,
  type PayComponentRecord
} from "./pay-component-form-sheet";

type BenefitsMetrics = {
  activePackages: number;
  enrolledStaff: number;
  monthlyBenefitValue: number;
  activeIncentives: number;
};

const PACKAGES_PATH = (tenant: string) => `/tenants/${tenant}/benefit-packages`;
const INCENTIVES_PATH = (tenant: string) => `/tenants/${tenant}/incentive-programs`;
const PAY_COMPONENTS_PATH = (tenant: string) => `/tenants/${tenant}/pay-components`;

function formatMoney(value: number) {
  return Math.round(value).toLocaleString();
}

function awardLabel(
  program: IncentiveProgramRecord,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (program.awardType === "percent") {
    return t("awardPercentValue", { percent: program.amount });
  }
  return t("awardFixedValue", { amount: formatMoney(program.amount) });
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
  const [expandedIncentiveIds, setExpandedIncentiveIds] = useState<Set<string>>(new Set());
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
    return {
      activePackages: pkgList.filter((pkg) => pkg.status === "active").length,
      enrolledStaff: pkgList.reduce((sum, pkg) => sum + pkg.enrolledCount, 0),
      monthlyBenefitValue: pkgList.reduce((sum, pkg) => sum + pkg.monthlyValue, 0),
      activeIncentives: incList.filter((inc) => inc.status === "active").length
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

  const openComponentForm = (mode: "create" | "edit", record?: PayComponentRecord | null) => {
    setComponentFormMode(mode);
    setEditingComponent(record ?? null);
    setComponentFormOpen(true);
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

  const incentiveColumns: ColumnDef<IncentiveProgramRecord, unknown>[] = [
    {
      id: "expand",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const expanded = expandedIncentiveIds.has(row.original.id);
        return (
          <button
            type="button"
            className="pds-type-body-s-regular row-action"
            aria-expanded={expanded}
            aria-label={expanded ? t("collapseDetails") : t("expandDetails")}
            onClick={() => {
              setExpandedIncentiveIds((prev) => {
                const next = new Set(prev);
                if (next.has(row.original.id)) next.delete(row.original.id);
                else next.add(row.original.id);
                return next;
              });
            }}
          >
            <Icon name={expanded ? "expand_less" : "expand_more"} size={20} />
          </button>
        );
      }
    },
    {
      id: "name",
      header: c("name"),
      accessorKey: "name",
      cell: ({ row }) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--pds-gap-xx-small)" }}>
          <span className="pds-type-body-m-bold">{row.original.name}</span>
          <StatusBadge
            status={row.original.status}
            label={t(`status.${row.original.status}` as "status.active")}
          />
        </div>
      )
    },
    {
      id: "cadence",
      header: t("cadenceLabel"),
      accessorKey: "cadence",
      cell: ({ row }) => t(`cadence.${row.original.cadence}` as "cadence.monthly")
    },
    {
      id: "award",
      header: t("award"),
      cell: ({ row }) => awardLabel(row.original, t)
    },
    {
      id: "eligible",
      header: t("eligibleStaff"),
      accessorKey: "eligibleCount",
      cell: ({ row }) => String(row.original.eligibleCount)
    },
    {
      id: "actions",
      header: c("actions"),
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          className="pds-type-body-s-regular row-action"
          onClick={() => {
            setIncentiveFormMode("edit");
            setEditingIncentive(row.original);
            setIncentiveFormOpen(true);
          }}
        >
          {c("edit")}
        </button>
      )
    }
  ];

  if (!canManage) {
    return null;
  }

  return (
    <div className="directory-page">
      <ModulePageHeader
        navKey="salary"
        title={t("bonusesBenefits")}
        description={t("bonusesBenefitsDescription")}
        breadcrumbs={moduleBreadcrumbs("salary", nav, [{ label: t("bonusesBenefits") }])}
        actions={
          <>
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost"
              onClick={() => {
                void packages.refetch();
                void incentives.refetch();
                void payComponents.refetch();
              }}
            >
              <Icon name="refresh" />
              {c("refresh")}
            </button>
            {tab === "packages" ? (
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                onClick={() => {
                  setPackageFormMode("create");
                  setEditingPackage(null);
                  setPackageFormOpen(true);
                }}
              >
                <Icon name="add" />
                {t("addBenefitPackage")}
              </button>
            ) : tab === "incentives" ? (
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                onClick={() => {
                  setIncentiveFormMode("create");
                  setEditingIncentive(null);
                  setIncentiveFormOpen(true);
                }}
              >
                <Icon name="add" />
                {t("addIncentiveProgram")}
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
          </>
        }
      />

      <StatGrid>
        <StatCard
          label={t("kpiActivePackages")}
          value={metrics.activePackages}
          icon={<Icon name="card_giftcard" size={20} />}
          accent
        />
        <StatCard
          label={t("kpiEnrolledStaff")}
          value={metrics.enrolledStaff}
          icon={<Icon name="groups" size={20} />}
        />
        <StatCard
          label={t("kpiMonthlyBenefitValue")}
          value={formatMoney(metrics.monthlyBenefitValue)}
          icon={<Icon name="savings" size={20} />}
        />
        <StatCard
          label={t("kpiActiveIncentives")}
          value={metrics.activeIncentives}
          icon={<Icon name="emoji_events" size={20} />}
        />
      </StatGrid>

      <SegmentedControl
        ariaLabel={t("benefitsTabLabel")}
        value={tab}
        onChange={(id: string) => setTab(id as "packages" | "incentives" | "components")}
        options={[
          { id: "packages", label: t("tabPackages"), icon: "card_giftcard" },
          { id: "incentives", label: t("tabIncentives"), icon: "emoji_events" },
          { id: "components", label: t("tabPayComponents"), icon: "payments" }
        ]}
      />

      {tab === "packages" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--pds-gap-large)"
          }}
        >
          {(packages.data ?? []).map((pkg) => (
            <article
              key={pkg.id}
              className="panel"
              style={{ display: "flex", flexDirection: "column", gap: "var(--pds-gap-medium)" }}
              tabIndex={0}
              onClick={(event) => {
                if (isPadaukRowInteractiveTarget(event.target)) return;
                setPackageFormMode("edit");
                setEditingPackage(pkg);
                setPackageFormOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setPackageFormMode("edit");
                setEditingPackage(pkg);
                setPackageFormOpen(true);
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span
                  className="stat-card__icon"
                  style={{ margin: 0 }}
                  aria-hidden
                >
                  <Icon name={pkg.icon ?? "card_giftcard"} size={22} />
                </span>
                <StatusBadge
                  status={pkg.status}
                  label={t(`status.${pkg.status}` as "status.active")}
                />
              </div>
              <div>
                <h2 className="pds-type-title-xs-bold">{pkg.name}</h2>
                {pkg.description ? (
                  <p className="pds-type-body-s-regular muted" style={{ marginTop: "var(--pds-gap-xx-small)" }}>
                    {pkg.description}
                  </p>
                ) : null}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="pds-type-caption-s">{t("monthlyValue")}</span>
                <strong className="pds-type-body-m-bold">{formatMoney(pkg.monthlyValue)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="pds-type-caption-s">{t("enrolledCount")}</span>
                <strong className="pds-type-body-m-bold">{pkg.enrolledCount}</strong>
              </div>
              <Chip>{t(`eligibility.${pkg.eligibility}` as "eligibility.all_staff")}</Chip>
              <button
                type="button"
                className="pds-type-body-s-regular row-action"
                style={{ alignSelf: "flex-start" }}
                onClick={(event) => {
                  event.stopPropagation();
                  setPackageFormMode("edit");
                  setEditingPackage(pkg);
                  setPackageFormOpen(true);
                }}
              >
                <Icon name="edit" size={16} />
                {c("edit")}
              </button>
            </article>
          ))}
        </div>
      ) : tab === "incentives" ? (
        <DataTableSection>
          <section className="panel">
            <TablePanelBody
              loading={incentives.isLoading}
              error={incentives.isError ? c("somethingWrong") : null}
              empty={!incentives.data?.length}
              emptyTitle={t("emptyIncentivesTitle")}
              emptyDescription={t("emptyIncentivesDescription")}
              emptyIcon="emoji_events"
            >
              <DataTable
                columns={incentiveColumns}
                data={incentives.data ?? []}
                renderSubRow={(row) =>
                  expandedIncentiveIds.has(row.original.id) ? (
                    <tr className="padauk-table__subrow">
                      <td colSpan={incentiveColumns.length}>
                        <div
                          style={{
                            display: "grid",
                            gap: "var(--pds-gap-x-small)",
                            padding: "var(--pds-padding-medium) var(--pds-padding-large)"
                          }}
                        >
                          <div>
                            <span className="pds-type-caption-s">{t("cadenceLabel")}</span>
                            <p className="pds-type-body-m-medium">
                              {t(`cadence.${row.original.cadence}` as "cadence.monthly")}
                            </p>
                          </div>
                          <div>
                            <span className="pds-type-caption-s">{t("award")}</span>
                            <p className="pds-type-body-m-medium">{awardLabel(row.original, t)}</p>
                          </div>
                          {row.original.description ? (
                            <div>
                              <span className="pds-type-caption-s">{c("description")}</span>
                              <p className="pds-type-body-s-regular muted">{row.original.description}</p>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null
                }
              />
            </TablePanelBody>
          </section>
        </DataTableSection>
      ) : (
        <DataTableSection>
          <section className="panel">
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "var(--pds-padding-medium) var(--pds-padding-large) 0"
              }}
            >
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
          </section>
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
          if (incentiveFormMode === "edit" && editingIncentive) {
            await updateIncentive.mutateAsync({ id: editingIncentive.id, ...values });
          } else {
            await createIncentive.mutateAsync(values);
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
