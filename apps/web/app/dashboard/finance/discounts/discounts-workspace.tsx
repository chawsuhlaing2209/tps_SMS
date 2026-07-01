"use client";

import { formatMMK } from "../../../lib/money";
import {
  defaultTriggerMode,
  normalizeDiscountType,
  type DiscountAppliesTo,
  type DiscountRuleCriteria
} from "@sms/shared";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../../../components/shared/badge";
import { Toggle } from "../../../../components/shared/toggle";
import { EmptyState } from "../../../../components/shared/empty-state";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { StatCard, StatGrid } from "../../../../components/shared/stat-card";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { isPadaukRowInteractiveTarget } from "../../../lib/table-row-interaction";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { PageHeader } from "../../page-header-context";
import { DiscountSetupModal } from "./discount-setup-workspace";
import { type DiscountRuleRecord } from "./discount-form";

const RULES_PATH = (tenant: string) => `/tenants/${tenant}/discounts/rules`;
const METRICS_PATH = (tenant: string, academicYearId: string) =>
  `/tenants/${tenant}/discounts/metrics?academicYearId=${academicYearId}`;

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

function compactMMK(value: number): string {
  return formatMMK(value);
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

function applicationLabel(
  triggerMode: string,
  t: (key: string) => string
): { label: string; tone: "success" | "warning" | "info" } {
  if (triggerMode === "auto") {
    return { label: t("applicationAutomatic"), tone: "success" };
  }
  if (triggerMode === "manual") {
    return { label: t("applicationManual"), tone: "info" };
  }
  return { label: t("applicationOnRequest"), tone: "warning" };
}

export function DiscountsWorkspace() {
  const router = useRouter();
  const t = useTranslations("discounts");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canView = hasAnyPermission(permissions, ["discount.request", "discount.approve"]);
  const canManage = hasAnyPermission(permissions, ["discount.approve"]);
  const [deletingRule, setDeletingRule] = useState<DiscountRuleRecord | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<"create" | "edit">("create");
  const [editingRuleId, setEditingRuleId] = useState<string | undefined>();
  const searchParams = useSearchParams();

  const openCreate = useCallback(() => {
    setSetupMode("create");
    setEditingRuleId(undefined);
    setSetupOpen(true);
  }, []);

  const openEdit = useCallback((ruleId: string) => {
    setSetupMode("edit");
    setEditingRuleId(ruleId);
    setSetupOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      openCreate();
      router.replace("/dashboard/finance/discounts");
    }
    const editId = searchParams.get("edit");
    if (editId) {
      openEdit(editId);
      router.replace("/dashboard/finance/discounts");
    }
  }, [searchParams, openCreate, openEdit, router]);

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
    const application = applicationLabel(triggerMode, t);
    const isEnabled = rule.status === "active";
    const isSibling = normalizedType === "sibling";

    return (
      <tr
        key={rule.id}
        className={[
          isEnabled ? undefined : "discount-table__row--inactive",
          "table-row--clickable"
        ]
          .filter(Boolean)
          .join(" ")}
        tabIndex={0}
        onClick={(event) => {
          if (isPadaukRowInteractiveTarget(event.target)) return;
          openEdit(rule.id);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openEdit(rule.id);
        }}
      >
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
          <Badge tone={application.tone}>{application.label}</Badge>
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
          {canManage && isSibling ? (
            <button
              type="button"
              className="discount-table__configure"
              onClick={(event) => {
                event.stopPropagation();
                openEdit(rule.id);
              }}
            >
              <Icon name="tune" size={16} />
              {t("configure")}
            </button>
          ) : null}
          {canManage ? (
            <RowMoreActionsMenu
              ariaLabel={c("moreActions")}
              items={[
                {
                  id: "view",
                  label: c("view"),
                  icon: "visibility",
                  onSelect: () => openEdit(rule.id)
                },
                {
                  id: "edit",
                  label: c("edit"),
                  icon: "edit",
                  onSelect: () => openEdit(rule.id)
                },
                {
                  id: "delete",
                  label: c("delete"),
                  icon: "delete",
                  destructive: true,
                  onSelect: () => setDeletingRule(rule)
                }
              ]}
            />
          ) : null}
        </td>
      </tr>
    );
  }

  return (
    <div className="discounts-config-page">
      <PageHeader
        title={t("pageTitle")}
        breadcrumbs={[
          { label: nav("finance"), href: "/dashboard/finance/invoices" },
          { label: t("pageTitle") }
        ]}
        actions={
          canManage ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Icon name="add" />
              {t("newDiscount")}
            </button>
          ) : null
        }
      />

      {!canView ? (
        <section className="panel">
          <EmptyState embedded icon="lock" title={t("noAccess")} />
        </section>
      ) : null}

      {canView ? (
        <StatGrid className="discount-stat-grid">
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

      {canView && rules.isLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : null}

      {canView && rules.isError ? (
        <section className="panel">
          <EmptyState embedded icon="error" title={c("somethingWrong")} />
        </section>
      ) : null}

      {canView && !rules.isLoading && !rules.isError && !visibleRules.length ? (
        <section className="panel">
          <EmptyState
            embedded
            icon="sell"
            title={t("noRules")}
            action={
              canManage ? (
                <Button buttonType="filled" buttonColor="secondary" prefixIcon="add" onClick={openCreate}>
                  {t("addDiscount")}
                </Button>
              ) : null
            }
          />
        </section>
      ) : null}

      {canView && visibleRules.length ? (
        <section className="panel discount-table-panel">
          <div className="discount-table-wrap">
            <table className="padauk-table padauk-table--pinned-end discount-table">
              <thead>
                <tr>
                  <th className="pds-type-caption-s">{t("colDiscount")}</th>
                  <th className="pds-type-caption-s">{t("colValue")}</th>
                  <th className="pds-type-caption-s">{t("colScope")}</th>
                  <th className="pds-type-caption-s">{t("colApplication")}</th>
                  <th className="pds-type-caption-s">{t("colActive")}</th>
                  <th className="pds-type-caption-s">{t("colAction")}</th>
                </tr>
              </thead>
              <tbody>{visibleRules.map(renderRuleRow)}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <DiscountSetupModal
        open={setupOpen}
        onOpenChange={setSetupOpen}
        mode={setupMode}
        ruleId={editingRuleId}
        onSaved={() => {
          void rules.refetch();
          void metrics.refetch();
        }}
      />

      <ConfirmDialog
        open={deletingRule !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRule(null);
        }}
        title={t("deleteDiscountTitle")}
        description={t("deleteDiscountHelp", { name: deletingRule?.name ?? "" })}
        confirmLabel={c("delete")}
        destructive
        loading={deactivateRule.isPending}
        onConfirm={async () => {
          if (!deletingRule) return;
          await deactivateRule.mutateAsync({ id: deletingRule.id });
          setDeletingRule(null);
        }}
      />
    </div>
  );
}
