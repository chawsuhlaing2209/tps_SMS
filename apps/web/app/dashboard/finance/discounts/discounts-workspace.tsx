"use client";

import {
  defaultTriggerMode,
  normalizeDiscountType,
  type DiscountAppliesTo,
  type DiscountRuleCriteria
} from "@sms/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "../../../../components/shared/badge";
import { Toggle } from "../../../../components/shared/toggle";
import { EmptyState } from "../../../../components/shared/empty-state";
import { StatCard, StatGrid } from "../../../../components/shared/stat-card";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { type DiscountRuleRecord } from "./discount-form";

const RULES_PATH = (tenant: string) => `/tenants/${tenant}/discounts/rules`;
const METRICS_PATH = (tenant: string, academicYearId: string) =>
  `/tenants/${tenant}/discounts/metrics?academicYearId=${academicYearId}`;

type DiscountGroup = "automatic" | "merit" | "staff";

type DiscountMetrics = {
  activeTypes: number;
  configuredTotal: number;
  studentsBenefiting: number;
  enrolledStudents: number;
  enrollmentSharePercent: number;
  annualDiscountValue: number;
  avgDiscountPercent: number;
};

const TYPE_ICONS: Record<string, string> = {
  sibling: "groups",
  scholarship: "emoji_events",
  staff: "work",
  staff_child: "work",
  early_payment: "schedule",
  custom: "volunteer_activism"
};

const TYPE_ICON_TONES: Record<string, string> = {
  sibling: "sibling",
  scholarship: "merit",
  staff: "staff",
  staff_child: "staff",
  early_payment: "early",
  custom: "need"
};

const GROUP_ORDER: DiscountGroup[] = ["automatic", "merit", "staff"];

function compactMMK(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function discountGroup(rule: DiscountRuleRecord): DiscountGroup {
  const type = normalizeDiscountType(rule.discountType);
  if (type === "scholarship") return "merit";
  if (type === "staff_child") return "staff";
  if (type === "sibling" || type === "early_payment") return "automatic";
  const mode = rule.triggerMode ?? defaultTriggerMode(rule.discountType);
  return mode === "request" ? "staff" : "automatic";
}

function appliesToFor(rule: DiscountRuleRecord): DiscountAppliesTo | undefined {
  const criteria = rule.criteria as DiscountRuleCriteria;
  return criteria?.appliesTo;
}

function ruleValueLabel(rule: DiscountRuleRecord, t: (key: string, values?: Record<string, string | number>) => string) {
  if (rule.discountType === "sibling") {
    return t("valueTiered");
  }
  if (rule.valueType === "fixed") {
    return t("valueFixed", { amount: Number(rule.value).toLocaleString() });
  }
  return t("valuePercent", { percent: Math.round(Number(rule.value)) });
}

function ruleScopeLabel(rule: DiscountRuleRecord, t: (key: string, values?: Record<string, string | number>) => string) {
  const appliesTo = appliesToFor(rule);
  const feeCount = appliesTo?.feeItemIds?.length ?? appliesTo?.feeTypes?.length ?? 1;
  const grades =
    appliesTo?.gradeIds?.length && appliesTo.gradeIds.length > 0
      ? t("specificGrades", { count: appliesTo.gradeIds.length })
      : t("allGradesShort");
  return t("scopeLine", { fees: feeCount, grades });
}

function valueTypeBadge(rule: DiscountRuleRecord, t: (key: string) => string) {
  if (rule.discountType === "sibling") return t("badgeTiered");
  if (rule.valueType === "percentage") return t("badgePercent");
  return t("badgeFixed");
}

export function DiscountsWorkspace() {
  const t = useTranslations("discounts");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canView = hasAnyPermission(permissions, ["discount.request", "discount.approve"]);
  const canManage = hasAnyPermission(permissions, ["discount.approve"]);

  const currentYear = useCurrentAcademicYear();
  const academicYearId = currentYear.data?.id ?? "";

  const rules = useApiQuery<DiscountRuleRecord[]>(canView ? RULES_PATH : () => null);
  const metrics = useApiQuery<DiscountMetrics>((tenant) =>
    canView && academicYearId ? METRICS_PATH(tenant, academicYearId) : null
  );

  const deactivateRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${RULES_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant), METRICS_PATH(tenant, academicYearId)] }
  );

  const activateRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${RULES_PATH(tenant)}/${id}/reactivate`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant), METRICS_PATH(tenant, academicYearId)] }
  );

  const visibleRules = (rules.data ?? []).filter((rule) => rule.status !== "archived");
  const enabledRules = visibleRules.filter((rule) => rule.status === "active");

  const groupedRules = useMemo(() => {
    const groups: Record<DiscountGroup, DiscountRuleRecord[]> = {
      automatic: [],
      merit: [],
      staff: []
    };
    for (const rule of visibleRules) {
      groups[discountGroup(rule)].push(rule);
    }
    return groups;
  }, [visibleRules]);

  const metricData = metrics.data;

  async function toggleRule(rule: DiscountRuleRecord, active: boolean) {
    if (active) {
      await activateRule.mutateAsync({ id: rule.id });
    } else {
      await deactivateRule.mutateAsync({ id: rule.id });
    }
    void rules.refetch();
    void metrics.refetch();
  }

  function renderRuleRow(rule: DiscountRuleRecord) {
    const normalizedType = normalizeDiscountType(rule.discountType);
    const iconName = TYPE_ICONS[rule.discountType] ?? TYPE_ICONS[normalizedType] ?? "sell";
    const iconTone =
      rule.status === "active"
        ? TYPE_ICON_TONES[rule.discountType] ?? TYPE_ICON_TONES[normalizedType] ?? "need"
        : "need";
    const triggerMode = rule.triggerMode ?? defaultTriggerMode(rule.discountType);
    const isAuto = triggerMode === "auto";
    const isEnabled = rule.status === "active";

    return (
      <tr key={rule.id} className={isEnabled ? undefined : "discount-table__row--inactive"}>
        <td>
          <div className="discount-table__discount">
            <span className={`discount-table__icon discount-table__icon--${iconTone}`} aria-hidden>
              <Icon name={iconName} size={18} />
            </span>
            <div className="discount-table__name">
              <strong>{rule.name}</strong>
              <Badge tone="info" className="discount-table__type-badge">
                {valueTypeBadge(rule, t)}
              </Badge>
            </div>
          </div>
        </td>
        <td className="discount-table__value">{ruleValueLabel(rule, t)}</td>
        <td className="discount-table__scope">{ruleScopeLabel(rule, t)}</td>
        <td>
          <Badge tone={isAuto ? "success" : "warning"}>
            {isAuto ? t("applicationAutomatic") : t("applicationOnRequest")}
          </Badge>
        </td>
        <td>
          {canManage ? (
            <Toggle
              checked={isEnabled}
              disabled={deactivateRule.isPending || activateRule.isPending}
              aria-label={t("toggleRule", { name: rule.name })}
              onCheckedChange={(checked) => void toggleRule(rule, checked)}
            />
          ) : (
            <span className="padauk-table__muted">{isEnabled ? c("yes") : c("no")}</span>
          )}
        </td>
        <td className="padauk-table__actions">
          {canManage ? (
            <Link href={`/dashboard/finance/discounts/${rule.id}`} className="discount-table__configure">
              {t("configure")}
              <Icon name="tune" size={16} />
            </Link>
          ) : null}
        </td>
      </tr>
    );
  }

  function renderGroup(group: DiscountGroup, items: DiscountRuleRecord[]) {
    if (!items.length) {
      return null;
    }

    const titleKey =
      group === "automatic" ? "groupAutomatic" : group === "merit" ? "groupMerit" : "groupStaff";
    const metaKey =
      group === "automatic"
        ? "groupAutomaticMeta"
        : group === "merit"
          ? "groupMeritMeta"
          : "groupStaffMeta";

    return (
      <section key={group} className="discount-list-group">
        <div className="discount-list-group__head">
          <h2>{t(titleKey)}</h2>
          <span className="discount-list-group__meta">{t(metaKey, { count: items.length })}</span>
        </div>
        <div className="discount-table-wrap">
          <table className="padauk-table discount-table">
            <thead>
              <tr>
                <th>{t("colDiscount")}</th>
                <th>{t("colValue")}</th>
                <th>{t("colScope")}</th>
                <th>{t("colApplication")}</th>
                <th>{t("colActive")}</th>
                <th>{t("colAction")}</th>
              </tr>
            </thead>
            <tbody>{items.map(renderRuleRow)}</tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="discounts-config-page">
      <PageHeader
        title={t("pageTitle")}
        breadcrumbs={[
          { label: nav("finance"), href: "/dashboard/finance/billing" },
          { label: t("pageTitle") }
        ]}
      />

      {canManage ? (
        <div className="discounts-page-actions">
          <Link href="/dashboard/finance/discounts/new" className="btn-primary">
            <Icon name="add" />
            {t("newDiscount")}
          </Link>
        </div>
      ) : null}

      {canView ? (
        <StatGrid>
          <StatCard
            accent
            icon={<Icon name="sell" size={18} />}
            label={t("statActiveTypes")}
            value={metricData?.activeTypes ?? enabledRules.length}
            hint={t("statConfigured", { count: metricData?.configuredTotal ?? rules.data?.length ?? 0 })}
          />
          <StatCard
            icon={<Icon name="groups" size={18} />}
            label={t("statStudentsBenefiting")}
            value={metricData?.studentsBenefiting ?? 0}
            hint={
              metricData?.enrolledStudents
                ? t("statStudentsShare", { percent: metricData.enrollmentSharePercent })
                : t("statStudentsShareEmpty")
            }
          />
          <StatCard
            icon={<Icon name="savings" size={18} />}
            label={t("statAnnualValue")}
            value={compactMMK(metricData?.annualDiscountValue ?? 0)}
            hint={t("statAnnualValueHelp")}
          />
          <StatCard
            icon={<Icon name="percent" size={18} />}
            label={t("statAvgDiscount")}
            value={`${metricData?.avgDiscountPercent ?? 0}%`}
            hint={t("statAvgHelp")}
          />
        </StatGrid>
      ) : null}

      {!canView ? (
        <section className="panel">
          <EmptyState icon="lock" title={t("noAccess")} />
        </section>
      ) : null}
      {canView && rules.isLoading ? <p className="muted">{c("loading")}</p> : null}
      {canView && rules.isError ? (
        <section className="panel">
          <EmptyState icon="error" title={c("somethingWrong")} />
        </section>
      ) : null}

      {canView && !rules.isLoading && !rules.isError && !visibleRules.length ? (
        <section className="panel">
          <EmptyState
            icon="sell"
            title={t("noRules")}
            action={
              canManage ? (
                <Link href="/dashboard/finance/discounts/new" className="btn-primary">
                  <Icon name="add" />
                  {t("addDiscount")}
                </Link>
              ) : null
            }
          />
        </section>
      ) : null}

      {GROUP_ORDER.map((group) => renderGroup(group, groupedRules[group]))}

      <p className="discounts-config-footnote">{t("infoCallout")}</p>
    </div>
  );
}
