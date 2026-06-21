"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { FormInput } from "../../../components/shared/form-input";
import { CheckboxList } from "../../../components/pds";
import { Chip, ChipGroup } from "../../../components/shared/chip";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";

type PayComponentOption = {
  id: string;
  name: string;
  componentType: string;
  status: string;
};

type BenefitPackageOption = {
  id: string;
  name: string;
  status: string;
};

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
};

const compensationPath = (tenant: string, staffId: string) =>
  `/tenants/${tenant}/staff/${staffId}/compensation`;

function formatMoney(value: number) {
  return Math.round(value).toLocaleString();
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
  const [dirty, setDirty] = useState(false);

  const compensation = useApiQuery<StaffCompensation>(
    canManage ? (tenant) => compensationPath(tenant, staffId) : () => null
  );

  const payComponents = useApiQuery<PayComponentOption[]>(
    canManage ? (tenant) => `/tenants/${tenant}/pay-components` : () => null
  );

  const benefitPackages = useApiQuery<BenefitPackageOption[]>(
    canManage ? (tenant) => `/tenants/${tenant}/benefit-packages` : () => null
  );

  const saveCompensation = useApiMutation<{
    baseSalary: number;
    payComponentIds: string[];
    benefitPackageIds: string[];
  }>(
    (body, tenant) => ({
      path: compensationPath(tenant, staffId),
      init: { method: "PUT", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        compensationPath(tenant, staffId),
        `/tenants/${tenant}/payroll-runs`
      ]
    }
  );

  useEffect(() => {
    if (!compensation.data) return;
    const data = compensation.data;
    setBaseSalary(String(data.baseSalary));
    setSelectedComponents(data.payComponentAssignments.map((item) => item.payComponentId));
    setSelectedBenefits(data.benefitEnrollments.map((item) => item.packageId));
    setDirty(false);
  }, [compensation.data]);

  if (!canManage) {
    return null;
  }

  const activeComponents = (payComponents.data ?? []).filter((item) => item.status === "active");
  const activePackages = (benefitPackages.data ?? []).filter((item) => item.status === "active");

  return (
    <section className={["panel", className].filter(Boolean).join(" ")}>
      <div className="panel-head">
        <div>
          <h2 className="pds-type-title-xs-bold">{t("compensationTitle")}</h2>
        </div>
        {dirty ? (
          <button
            type="button"
            className="pds-type-body-m-bold btn-primary"
            disabled={saveCompensation.isPending || compensation.isLoading}
            onClick={() =>
              void saveCompensation
                .mutateAsync({
                  baseSalary: Number(baseSalary) || 0,
                  payComponentIds: selectedComponents,
                  benefitPackageIds: selectedBenefits
                })
                .then(() => {
                  setDirty(false);
                  void compensation.refetch();
                })
            }
          >
            <Icon name="check" />
            {saveCompensation.isPending ? c("loading") : c("save")}
          </button>
        ) : null}
      </div>

      {compensation.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : compensation.isError ? (
        <p className="pds-type-body-m-medium error-text">{c("somethingWrong")}</p>
      ) : (
        <div className="form-stack">
          <Field label={t("baseSalary")}>
            <FormInput
              type="number"
              value={baseSalary}
              onChange={(event) => {
                setBaseSalary(event.target.value);
                setDirty(true);
              }}
            />
          </Field>

          <div>
            <h3 className="pds-type-title-xxs-extrabold">{t("assignedComponents")}</h3>
            <div style={{ marginTop: "var(--pds-gap-small)" }}>
              <CheckboxList
                options={activeComponents.map((component) => ({
                  id: component.id,
                  label: component.name,
                  description: t(`componentTypes.${component.componentType}` as "componentTypes.allowance")
                }))}
                selectedIds={selectedComponents}
                onChange={(next) => {
                  setSelectedComponents(next);
                  setDirty(true);
                }}
              />
            </div>
            {selectedComponents.length > 0 ? (
              <ChipGroup>
                {selectedComponents.map((id) => {
                  const component = activeComponents.find((item) => item.id === id);
                  return <Chip key={id}>{component?.name ?? id}</Chip>;
                })}
              </ChipGroup>
            ) : (
              <p className="pds-type-body-s-regular muted">{t("noAssignedComponents")}</p>
            )}
          </div>

          <div>
            <h3 className="pds-type-title-xxs-extrabold">{t("benefitEnrollments")}</h3>
            <div style={{ marginTop: "var(--pds-gap-small)" }}>
              <CheckboxList
                options={activePackages.map((pkg) => ({
                  id: pkg.id,
                  label: pkg.name
                }))}
                selectedIds={selectedBenefits}
                onChange={(next) => {
                  setSelectedBenefits(next);
                  setDirty(true);
                }}
              />
            </div>
          </div>

          {compensation.data ? (
            <p className="pds-type-body-s-regular muted">
              {t("compensationSummary", { amount: formatMoney(compensation.data.baseSalary) })}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
