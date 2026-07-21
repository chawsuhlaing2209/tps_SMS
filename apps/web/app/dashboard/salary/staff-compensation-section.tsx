"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Divider,
  ToggleList,
  ToggleListSectionHead,
} from "../../../components/pds";
import { TextInput } from "../../../components/shared/form-input";
import { InputWrapper } from "../../../components/shared/input-wrapper";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { formatMoneyDigits } from "../../lib/money";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import type { BenefitPackageRecord } from "./benefits/benefit-package-form-sheet";
import type { IncentiveProgramRecord } from "./benefits/incentive-program-form-sheet";
import type { PayComponentRecord } from "./benefits/pay-component-form-sheet";
import {
  PayrollConfigRow,
  resolvePayrollRowIconTone,
} from "./run/payroll-config-row";
import styles from "./staff-compensation-section.module.css";

type StaffCompensation = {
  staffId: string;
  baseSalary: number;
  payComponentAssignments: Array<{
    payComponentId: string;
    name: string;
    amount: number;
  }>;
  benefitEnrollments: Array<{
    packageId: string;
    name: string;
  }>;
  incentiveProgramIds: string[];
};

const compensationPath = (tenant: string, staffId: string) =>
  `/tenants/${tenant}/staff/${staffId}/compensation`;

const formatMoney = formatMoneyDigits;

function parseMoneyInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatMoneyInput(value: string) {
  const digits = parseMoneyInput(value);
  if (!digits) return "";
  return formatMoneyDigits(Number(digits));
}

function resolveIncentiveIcon(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("performance") || normalized.includes("term")) {
    return "trending_up";
  }
  if (normalized.includes("attendance")) {
    return "event_available";
  }
  if (normalized.includes("exam") || normalized.includes("result")) {
    return "workspace_premium";
  }
  if (normalized.includes("service") || normalized.includes("long")) {
    return "military_tech";
  }
  return "emoji_events";
}

function resolvePayComponentIcon(component: PayComponentRecord): string {
  if (component.kind === "deduction") {
    return "remove_circle_outline";
  }
  const code = component.code.toLowerCase();
  if (code.includes("transport") || code.includes("bus")) {
    return "directions_bus";
  }
  if (code.includes("meal")) {
    return "restaurant";
  }
  if (code.includes("housing") || code.includes("home")) {
    return "home_work";
  }
  return "payments";
}

function parseComponentDefaultAmount(value: string | number): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function componentDisplayAmount(
  component: PayComponentRecord,
  assignmentAmount: number | undefined
): { amount: number; currency: string } {
  if (component.calculation === "percent_of_basic") {
    const percent = assignmentAmount ?? parseComponentDefaultAmount(component.defaultAmount);
    return { amount: percent, currency: "%" };
  }
  return {
    amount: assignmentAmount ?? parseComponentDefaultAmount(component.defaultAmount),
    currency: "MMK",
  };
}

function componentMonthlyValue(
  component: PayComponentRecord,
  assignmentAmount: number | undefined,
  baseSalary: number
): number {
  if (component.calculation === "percent_of_basic") {
    const percent = assignmentAmount ?? parseComponentDefaultAmount(component.defaultAmount);
    return Math.round((baseSalary * percent) / 100);
  }
  return assignmentAmount ?? parseComponentDefaultAmount(component.defaultAmount);
}

type Props = {
  staffId: string;
  className?: string;
};

export function StaffCompensationSection({ staffId, className }: Props) {
  const t = useTranslations("salary");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["salary.manage", "hr.manage"]);

  const [baseSalary, setBaseSalary] = useState("");
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [selectedIncentives, setSelectedIncentives] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const baseSalaryDirty = useRef(false);

  const compensation = useApiQuery<StaffCompensation>(
    canManage ? (tenant) => compensationPath(tenant, staffId) : () => null
  );

  const benefitPackages = useApiQuery<BenefitPackageRecord[]>(
    canManage ? (tenant) => `/tenants/${tenant}/benefit-packages` : () => null
  );

  const payComponents = useApiQuery<PayComponentRecord[]>(
    canManage ? (tenant) => `/tenants/${tenant}/pay-components` : () => null
  );

  const incentivePrograms = useApiQuery<IncentiveProgramRecord[]>(
    canManage ? (tenant) => `/tenants/${tenant}/incentive-programs` : () => null
  );

  const saveCompensation = useApiMutation<{
    baseSalary: number;
    payComponentIds: string[];
    benefitPackageIds: string[];
    incentiveProgramIds: string[];
  }>(
    (body, tenant) => ({
      path: compensationPath(tenant, staffId),
      init: { method: "PUT", body: JSON.stringify(body) },
    }),
    {
      invalidatePaths: (_b, tenant) => [
        compensationPath(tenant, staffId),
        `/tenants/${tenant}/payroll-runs`,
      ],
    }
  );

  useEffect(() => {
    if (!compensation.data) return;
    const data = compensation.data;
    setBaseSalary(formatMoneyInput(String(data.baseSalary)));
    setSelectedComponents(
      data.payComponentAssignments.map((item) => item.payComponentId)
    );
    setSelectedBenefits(data.benefitEnrollments.map((item) => item.packageId));
    setSelectedIncentives(data.incentiveProgramIds ?? []);
    baseSalaryDirty.current = false;
  }, [compensation.data]);

  const activePayComponents = useMemo(
    () =>
      (payComponents.data ?? []).filter(
        (item) => item.status === "active" && item.code !== "basic"
      ),
    [payComponents.data]
  );

  const activePackages = useMemo(
    () => (benefitPackages.data ?? []).filter((item) => item.status === "active"),
    [benefitPackages.data]
  );

  const activeIncentives = useMemo(
    () => (incentivePrograms.data ?? []).filter((item) => item.status === "active"),
    [incentivePrograms.data]
  );

  const assignmentAmountByComponentId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of compensation.data?.payComponentAssignments ?? []) {
      map.set(item.payComponentId, item.amount);
    }
    return map;
  }, [compensation.data?.payComponentAssignments]);

  const compensationBase =
    Number(parseMoneyInput(baseSalary)) || compensation.data?.baseSalary || 0;

  const componentSummary = useMemo(() => {
    const active = activePayComponents.filter(
      (item) => selectedComponents.includes(item.id) && item.kind !== "deduction"
    );
    const total = active.reduce(
      (sum, item) =>
        sum +
        componentMonthlyValue(
          item,
          assignmentAmountByComponentId.get(item.id),
          compensationBase
        ),
      0
    );
    return { count: active.length, total };
  }, [
    activePayComponents,
    selectedComponents,
    assignmentAmountByComponentId,
    compensationBase,
  ]);

  const packageSummary = useMemo(() => {
    const active = activePackages.filter((item) => selectedBenefits.includes(item.id));
    const total = active.reduce((sum, item) => sum + item.monthlyValue, 0);
    return { count: active.length, total };
  }, [activePackages, selectedBenefits]);

  const incentiveSummary = useMemo(() => {
    const active = activeIncentives.filter((item) => selectedIncentives.includes(item.id));
    const total = active.reduce((sum, item) => {
      if (item.awardType === "percent") {
        const base = compensationBase;
        return sum + Math.round((base * item.amount) / 100);
      }
      return sum + item.amount;
    }, 0);
    return { count: active.length, total };
  }, [activeIncentives, selectedIncentives, compensationBase]);

  async function persist(payload?: {
    baseSalary?: number;
    payComponentIds?: string[];
    benefitPackageIds?: string[];
    incentiveProgramIds?: string[];
  }) {
    setSaveError(null);
    try {
      await saveCompensation.mutateAsync({
        baseSalary:
          payload?.baseSalary ?? (Number(parseMoneyInput(baseSalary)) || 0),
        payComponentIds: payload?.payComponentIds ?? selectedComponents,
        benefitPackageIds: payload?.benefitPackageIds ?? selectedBenefits,
        incentiveProgramIds: payload?.incentiveProgramIds ?? selectedIncentives,
      });
      baseSalaryDirty.current = false;
      void compensation.refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : c("somethingWrong"));
    }
  }

  function handleComponentToggle(componentId: string, checked: boolean) {
    const next = checked
      ? [...selectedComponents, componentId]
      : selectedComponents.filter((id) => id !== componentId);
    setSelectedComponents(next);
    void persist({ payComponentIds: next });
  }

  function handleBenefitToggle(packageId: string, checked: boolean) {
    const next = checked
      ? [...selectedBenefits, packageId]
      : selectedBenefits.filter((id) => id !== packageId);
    setSelectedBenefits(next);
    void persist({ benefitPackageIds: next });
  }

  function handleIncentiveToggle(programId: string, checked: boolean) {
    const next = checked
      ? [...selectedIncentives, programId]
      : selectedIncentives.filter((id) => id !== programId);
    setSelectedIncentives(next);
    void persist({ incentiveProgramIds: next });
  }

  function handleBaseSalaryBlur() {
    if (!baseSalaryDirty.current) return;
    void persist({
      baseSalary: Number(parseMoneyInput(baseSalary)) || 0,
    });
  }

  if (!canManage) {
    return null;
  }

  return (
    <section className={[styles.compensationSection, className].filter(Boolean).join(" ")}>
      <h2 className={`pds-type-title-xs-bold ${styles.compensationSectionTitle}`}>
        {t("compensationTitle")}
      </h2>

      {compensation.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : compensation.isError ? (
        <p className={`pds-type-body-m-medium error-text ${styles.compensationSectionError}`}>
          {c("somethingWrong")}
        </p>
      ) : (
        <>
          <InputWrapper label={t("baseSalary")} labelStyle="caps">
            <TextInput
              inputMode="numeric"
              value={baseSalary}
              suffix={t("monthlyValueSuffix")}
              disabled={saveCompensation.isPending}
              onChange={(event) => {
                baseSalaryDirty.current = true;
                setBaseSalary(formatMoneyInput(event.target.value));
              }}
              onBlur={handleBaseSalaryBlur}
            />
          </InputWrapper>

          <Divider size="sm" />

          <div className={styles.compensationSectionGroup}>
            <ToggleListSectionHead
              title={t("payComponentsSection")}
              summary={t("sectionActiveSummary", {
                count: componentSummary.count,
                total: formatMoney(componentSummary.total),
              })}
            />
            {activePayComponents.length === 0 ? (
              <p className="pds-type-body-s-regular muted">{t("emptyPayComponentsDescription")}</p>
            ) : (
              <ToggleList aria-label={t("payComponentsSection")}>
                {activePayComponents.map((component) => {
                  const icon = resolvePayComponentIcon(component);
                  const display = componentDisplayAmount(
                    component,
                    assignmentAmountByComponentId.get(component.id)
                  );
                  return (
                    <PayrollConfigRow
                      key={component.id}
                      icon={icon}
                      iconTone={resolvePayrollRowIconTone(icon, component.kind)}
                      label={component.name}
                      description={t(
                        `componentTypes.${component.componentType}` as "componentTypes.allowance"
                      )}
                      amount={display.amount}
                      currency={display.currency}
                      enabled={selectedComponents.includes(component.id)}
                      readOnly={saveCompensation.isPending}
                      onToggle={(checked) => handleComponentToggle(component.id, checked)}
                    />
                  );
                })}
              </ToggleList>
            )}
          </div>

          <Divider size="sm" />

          <div className={styles.compensationSectionGroup}>
            <ToggleListSectionHead
              title={t("allowancePackagesSection")}
              summary={t("sectionActiveSummary", {
                count: packageSummary.count,
                total: formatMoney(packageSummary.total),
              })}
            />
            {activePackages.length === 0 ? (
              <p className="pds-type-body-s-regular muted">{t("noAllowancePackagesConfigured")}</p>
            ) : (
              <ToggleList aria-label={t("allowancePackagesSection")}>
                {activePackages.map((pkg) => (
                  <PayrollConfigRow
                    key={pkg.id}
                    icon={pkg.icon ?? "redeem"}
                    iconTone={resolvePayrollRowIconTone(pkg.icon ?? "redeem")}
                    label={pkg.name}
                    amount={pkg.monthlyValue}
                    enabled={selectedBenefits.includes(pkg.id)}
                    readOnly={saveCompensation.isPending}
                    onToggle={(checked) => handleBenefitToggle(pkg.id, checked)}
                  />
                ))}
              </ToggleList>
            )}
          </div>

          <Divider size="sm" />

          <div className={styles.compensationSectionGroup}>
            <ToggleListSectionHead
              title={t("bonusIncentivesSection")}
              summary={t("sectionAwardedSummary", {
                count: incentiveSummary.count,
                total: formatMoney(incentiveSummary.total),
              })}
            />
            {activeIncentives.length === 0 ? (
              <p className="pds-type-body-s-regular muted">{t("emptyIncentivesDescription")}</p>
            ) : (
              <ToggleList aria-label={t("bonusIncentivesSection")}>
                {activeIncentives.map((program) => {
                  const icon = resolveIncentiveIcon(program.name);
                  const isPercent = program.awardType === "percent";
                  return (
                    <PayrollConfigRow
                      key={program.id}
                      icon={icon}
                      iconTone={resolvePayrollRowIconTone(icon)}
                      label={program.name}
                      description={program.description}
                      amount={program.amount}
                      currency={isPercent ? "%" : "MMK"}
                      enabled={selectedIncentives.includes(program.id)}
                      readOnly={saveCompensation.isPending}
                      onToggle={(checked) => handleIncentiveToggle(program.id, checked)}
                    />
                  );
                })}
              </ToggleList>
            )}
          </div>

          {saveCompensation.isPending ? (
            <p className={`pds-type-body-s-regular muted ${styles.compensationSectionSaving}`}>
              {c("loading")}
            </p>
          ) : null}
          {saveError ? (
            <p className={`pds-type-body-m-medium error-text ${styles.compensationSectionError}`}>
              {saveError}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
