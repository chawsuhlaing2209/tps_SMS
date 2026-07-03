"use client";

import { FilterTab, FilterTabGroup } from "../../../../components/pds/composites/filter-tabs";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { formatMMK } from "../../../lib/money";
import { StatCard, StatGrid } from "../../../../components/shared/stat-card";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useApiMutation, useApiQuery } from "../../../lib/api";
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

function formatMoney(value: number): string {
  return formatMMK(value);
}

function compactAmount(value: number): string {
  return formatMMK(value);
}

function incentivePaidTotal(program: IncentiveProgramRecord) {
  if (program.awardType === "percent") return 0;
  const recipients = program.recipients ?? program.eligibleCount ?? 0;
  return program.amount * recipients;
}

export default function SalaryBenefitsPage() {
  const t = useTranslations("salary");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["salary.manage"]);

  const [tab, setTab] = useState<"packages" | "incentives">("packages");
  const [packageFormOpen, setPackageFormOpen] = useState(false);
  const [packageFormMode, setPackageFormMode] = useState<"create" | "edit">("create");
  const [editingPackage, setEditingPackage] = useState<BenefitPackageRecord | null>(null);
  const [incentiveFormOpen, setIncentiveFormOpen] = useState(false);
  const [incentiveFormMode, setIncentiveFormMode] = useState<"create" | "edit">("create");
  const [editingIncentive, setEditingIncentive] = useState<IncentiveProgramRecord | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<BenefitPackageRecord | null>(null);
  const [deletingIncentive, setDeletingIncentive] = useState<IncentiveProgramRecord | null>(null);

  const packages = useApiQuery<BenefitPackageRecord[]>(
    canManage ? PACKAGES_PATH : () => null
  );
  const incentives = useApiQuery<IncentiveProgramRecord[]>(
    canManage ? INCENTIVES_PATH : () => null
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

  const restorePackage = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PACKAGES_PATH(tenant)}/${id}/restore`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [PACKAGES_PATH(tenant)] }
  );

  const deletePackage = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PACKAGES_PATH(tenant)}/${id}`,
      init: { method: "DELETE" }
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

  const archiveIncentive = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${INCENTIVES_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [INCENTIVES_PATH(tenant)] }
  );

  const restoreIncentive = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${INCENTIVES_PATH(tenant)}/${id}/restore`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [INCENTIVES_PATH(tenant)] }
  );

  const deleteIncentive = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${INCENTIVES_PATH(tenant)}/${id}`,
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_b, tenant) => [INCENTIVES_PATH(tenant)] }
  );

  const openPackageForm = (mode: "create" | "edit", record?: BenefitPackageRecord | null) => {
    setPackageFormMode(mode);
    setEditingPackage(record ?? null);
    setPackageFormOpen(true);
  };

  const openIncentiveForm = (mode: "create" | "edit", record?: IncentiveProgramRecord | null) => {
    setIncentiveFormMode(mode);
    setEditingIncentive(record ?? null);
    setIncentiveFormOpen(true);
  };

  const refreshAll = () => {
    void packages.refetch();
    void incentives.refetch();
  };

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
        <FilterTabGroup aria-label={t("benefitsTabLabel")}>
          <FilterTab
            label={t("tabComplimentaryPackages")}
            active={tab === "packages"}
            onClick={() => setTab("packages")}
          />
          <FilterTab
            label={t("tabBonusIncentives")}
            active={tab === "incentives"}
            onClick={() => setTab("incentives")}
          />
        </FilterTabGroup>
        {tab === "packages" ? (
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            onClick={() => openPackageForm("create")}
          >
            <Icon name="add" />
            {t("addBenefitPackage")}
          </button>
        ) : (
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            onClick={() => openIncentiveForm("create")}
          >
            <Icon name="add" />
            {t("newIncentiveProgram")}
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
              onRestore={(record) =>
                void restorePackage.mutateAsync({ id: record.id }).then(() => {
                  void packages.refetch();
                })
              }
              onDelete={(record) => setDeletingPackage(record)}
            />
          ))}
        </div>
      ) : (
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
                  onArchive={(program) =>
                    void archiveIncentive.mutateAsync({ id: program.id }).then(() => {
                      void incentives.refetch();
                    })
                  }
                  onRestore={(program) =>
                    void restoreIncentive.mutateAsync({ id: program.id }).then(() => {
                      void incentives.refetch();
                    })
                  }
                  onDelete={(program) => setDeletingIncentive(program)}
                />
              </TablePanelBody>
            </section>
          </DataTableSection>
        </div>
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

      <ConfirmDialog
        open={deletingPackage !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingPackage(null);
        }}
        title={t("deletePackageTitle")}
        description={t("deletePackageHelp", { name: deletingPackage?.name ?? "" })}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deletePackage.isPending}
        onConfirm={async () => {
          if (!deletingPackage) return;
          await deletePackage.mutateAsync({ id: deletingPackage.id });
          setDeletingPackage(null);
          void packages.refetch();
        }}
      />

      <ConfirmDialog
        open={deletingIncentive !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingIncentive(null);
        }}
        title={t("deleteIncentiveTitle")}
        description={t("deleteIncentiveHelp", { name: deletingIncentive?.name ?? "" })}
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteIncentive.isPending}
        onConfirm={async () => {
          if (!deletingIncentive) return;
          await deleteIncentive.mutateAsync({ id: deletingIncentive.id });
          setDeletingIncentive(null);
          void incentives.refetch();
        }}
      />
    </div>
  );
}
