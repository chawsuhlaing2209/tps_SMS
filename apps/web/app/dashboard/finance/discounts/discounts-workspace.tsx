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
import { ArchiveVisibilityFilter } from "../../../../components/shared/archive-visibility-filter";
import { type ArchiveVisibility } from "../../../lib/archive-filter";
import { PadaukTableWrap } from "../../../lib/padauk-table-wrap";
import { TablePanelBody } from "../../../lib/table-panel";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { isPadaukRowInteractiveTarget } from "../../../lib/table-row-interaction";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { useFinanceYear } from "../finance-year-context";
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
    return t("valueFixed", { amount: formatMMK(Number(rule.value)) });
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
  const [viewFilter, setViewFilter] = useState<ArchiveVisibility>("active");
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

  // Discount metrics are per-year; Lifetime falls back to the active year.
  const financeYear = useFinanceYear();
  const academicYearId = financeYear.academicYearId || financeYear.activeYearId;

  const rules = useApiQuery<DiscountRuleRecord[]>(canView ? RULES_PATH : () => null);
  const metrics = useApiQuery<DiscountMetrics>((tenant) =>
    canView && academicYearId ? METRICS_PATH(tenant, academicYearId) : null
  );

  const mutationInvalidate = {
    invalidatePaths: (_b: unknown, tenant: string) => [
      RULES_PATH(tenant),
      METRICS_PATH(tenant, academicYearId)
    ]
  };

  // Enable/disable = the Active toggle (stays in the active view).
  const enableRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${RULES_PATH(tenant)}/${id}/enable`, init: { method: "POST" } }),
    mutationInvalidate
  );
  const disableRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${RULES_PATH(tenant)}/${id}/disable`, init: { method: "POST" } }),
    mutationInvalidate
  );
  // Archive/restore = the lifecycle (moves in/out of the archived view).
  const archiveRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${RULES_PATH(tenant)}/${id}/archive`, init: { method: "POST" } }),
    mutationInvalidate
  );
  const restoreRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${RULES_PATH(tenant)}/${id}/restore`, init: { method: "POST" } }),
    mutationInvalidate
  );
  const deleteRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${RULES_PATH(tenant)}/${id}`, init: { method: "DELETE" } }),
    mutationInvalidate
  );

  const allRules = rules.data ?? [];
  const visibleRules =
    viewFilter === "archived"
      ? allRules.filter((rule) => rule.status === "archived")
      : viewFilter === "all"
        ? allRules
        : allRules.filter((rule) => rule.status !== "archived");
  const enabledRules = allRules.filter((rule) => rule.status === "active");
  const metricData = metrics.data;

  async function toggleRule(rule: DiscountRuleRecord, active: boolean) {
    if (active) {
      await enableRule.mutateAsync({ id: rule.id });
    } else {
      await disableRule.mutateAsync({ id: rule.id });
    }
    void rules.refetch();
    void metrics.refetch();
  }

  async function handleArchive(rule: DiscountRuleRecord) {
    await archiveRule.mutateAsync({ id: rule.id });
    void rules.refetch();
    void metrics.refetch();
  }

  async function handleRestore(rule: DiscountRuleRecord) {
    await restoreRule.mutateAsync({ id: rule.id });
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
    const isArchived = rule.status === "archived";
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
          {isArchived ? (
            <Badge tone="neutral">{c("viewArchived")}</Badge>
          ) : canManage ? (
            <Toggle
              checked={isEnabled}
              disabled={disableRule.isPending || enableRule.isPending}
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
                ...(isArchived
                  ? [
                      {
                        id: "restore",
                        label: c("restore"),
                        icon: "restore",
                        onSelect: () => void handleRestore(rule)
                      },
                      {
                        id: "delete",
                        label: c("deletePermanently"),
                        icon: "delete_forever",
                        destructive: true,
                        onSelect: () => setDeletingRule(rule)
                      }
                    ]
                  : [
                      {
                        id: "archive",
                        label: c("archive"),
                        icon: "archive",
                        destructive: true,
                        onSelect: () => void handleArchive(rule)
                      }
                    ])
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

      {canView ? (
        <div className="discount-view-filter">
          <ArchiveVisibilityFilter value={viewFilter} onChange={setViewFilter} />
        </div>
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
        <TablePanelBody>
          <PadaukTableWrap>
            <table className="pds-type-body-m-medium padauk-table padauk-table--pinned-end discount-table">
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
          </PadaukTableWrap>
        </TablePanelBody>
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
        confirmLabel={c("deletePermanently")}
        destructive
        loading={deleteRule.isPending}
        onConfirm={async () => {
          if (!deletingRule) return;
          await deleteRule.mutateAsync({ id: deletingRule.id });
          setDeletingRule(null);
          void rules.refetch();
        }}
      />
    </div>
  );
}
