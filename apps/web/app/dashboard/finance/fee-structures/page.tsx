"use client";
import { InputWrapper, TextInput } from "../../../../components/shared/form-input";
import { formatMMK } from "../../../lib/money";
import { Toggle } from "../../../../components/shared/toggle";

import { mandatoryEnrollmentFeeTypes } from "@sms/shared";
import { cn } from "../../../../lib/utils";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";
import { PageHeader } from "../../page-header-context";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { CheckBox } from "../../../../components/pds";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { isPadaukRowInteractiveTarget } from "../../../lib/table-row-interaction";
import { EmptyState } from "../../../../components/shared/empty-state";
import styles from "./fee-structures.module.css";

type Grade = { id: string; name: string; status?: string; sortOrder?: number };
type FeeItem = {
  id: string;
  name: string;
  feeType: string;
  billingType: string;
  status: string;
};
type FeePlan = {
  id: string;
  academicYearId: string;
  gradeIds: string[];
  feeItemId: string;
  amount: string;
};
type Summary = {
  academicYearId: string;
  maxTotal: number;
  grades: Array<{
    gradeId: string;
    gradeName: string;
    totalAnnual: number;
    componentCount: number;
    studentCount: number;
  }>;
};

type ComponentFormValues = {
  name: string;
  billingType: string;
  feeType: string;
  amount: string;
  gradeIds: string[];
  required: boolean;
};

type FormMode = { type: "create" } | { type: "edit"; planId: string; feeItemId: string };

const FEE_TYPES = ["tuition", "registration", "transport", "other"] as const;
const BILLING_TYPES = ["annual", "monthly", "term", "one_time"] as const;

const PLANS_PATH = (tenant: string) => `/tenants/${tenant}/finance/enrollment-fee-plans`;
const FEE_ITEMS_PATH = (tenant: string) => `/tenants/${tenant}/finance/fee-items`;
const SUMMARY_PATH = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/finance/fee-structures/summary?academicYearId=${yearId}`;

function formatMmk(value: number): string {
  return formatMMK(value);
}

function formatAmount(value: number) {
  return Math.round(value).toLocaleString();
}

function annualizeAmount(amount: string, billingType: string): number {
  const base = Number(amount);
  if (!Number.isFinite(base)) return 0;
  switch (billingType) {
    case "monthly":
      return base * 12;
    case "term":
      return base * 3;
    default:
      return base;
  }
}

function billingAmountSuffixKey(billingType: string): "monthly" | "term" | "once" | "annual" {
  switch (billingType) {
    case "monthly":
      return "monthly";
    case "term":
      return "term";
    case "one_time":
      return "once";
    default:
      return "annual";
  }
}

function resolveFeeType(required: boolean, feeType: string): string {
  if (required) {
    return (mandatoryEnrollmentFeeTypes as readonly string[]).includes(feeType) ? feeType : "tuition";
  }
  return "other";
}

function feeTypeColor(feeType: string): string {
  switch (feeType) {
    case "tuition":
      return "var(--pds-color-azure-60)";
    case "registration":
      return "var(--pds-color-red-67)";
    case "transport":
      return "var(--pds-color-green-600)";
    default:
      return "var(--pds-color-accent-purple)";
  }
}

export default function FeeStructuresPage() {
  const t = useTranslations("finance");
  const nav = useTranslations("nav");
  const a = useTranslations("academics");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["finance.manage"]);
  const currentYear = useCurrentAcademicYear();

  const workingYearId = currentYear.data?.id ?? "";
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingComponent, setDeletingComponent] = useState<{
    planId: string;
    feeItemId: string;
    name: string;
    gradeOnly: boolean;
  } | null>(null);

  const grades = useApiQuery<Grade[]>((tenant) => `/tenants/${tenant}/academics/grades`);
  const feeItems = useApiQuery<FeeItem[]>(FEE_ITEMS_PATH);
  const plans = useApiQuery<FeePlan[]>(PLANS_PATH);
  const summary = useApiQuery<Summary>((tenant) =>
    workingYearId ? SUMMARY_PATH(tenant, workingYearId) : null
  );

  const activeGrades = useMemo(
    () =>
      (grades.data ?? [])
        .filter((grade) => grade.status !== "archived")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [grades.data]
  );

  useEffect(() => {
    if (!selectedGradeId && activeGrades.length) {
      setSelectedGradeId(activeGrades[0]!.id);
    }
  }, [activeGrades, selectedGradeId]);

  const yearPlans = useMemo(
    () => plans.data?.filter((plan) => plan.academicYearId === workingYearId) ?? [],
    [plans.data, workingYearId]
  );

  const itemById = useMemo(
    () => new Map((feeItems.data ?? []).map((item) => [item.id, item])),
    [feeItems.data]
  );

  const selectedGrade = activeGrades.find((grade) => grade.id === selectedGradeId) ?? null;
  const selectedSummary = summary.data?.grades.find((row) => row.gradeId === selectedGradeId);

  const gradeComponents = useMemo(() => {
    if (!selectedGradeId) return [];

    const rows = yearPlans
      .filter((plan) => plan.gradeIds.includes(selectedGradeId))
      .map((plan) => {
        const item = itemById.get(plan.feeItemId);
        if (!item || item.status === "archived") return null;
        const annualAmount = annualizeAmount(plan.amount, item.billingType);
        return {
          planId: plan.id,
          feeItemId: item.id,
          name: item.name,
          feeType: item.feeType,
          billingType: item.billingType,
          annualAmount,
          planAmount: plan.amount
        };
      })
      .filter(Boolean) as Array<{
      planId: string;
      feeItemId: string;
      name: string;
      feeType: string;
      billingType: string;
      annualAmount: number;
      planAmount: string;
    }>;

    const total = rows.reduce((sum, row) => sum + row.annualAmount, 0);
    return rows.map((row) => ({
      ...row,
      share: total > 0 ? Math.round((row.annualAmount / total) * 100) : 0
    }));
  }, [itemById, selectedGradeId, yearPlans]);

  const totalAnnual =
    selectedSummary?.totalAnnual ??
    gradeComponents.reduce((sum, row) => sum + row.annualAmount, 0);

  const createFeeItem = useApiMutation<
    { name: string; feeType: string; billingType: string },
    FeeItem
  >(
    (body, tenant) => ({
      path: FEE_ITEMS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [FEE_ITEMS_PATH(tenant)] }
  );

  const createPlan = useApiMutation<{
    academicYearId: string;
    gradeIds: string[];
    feeItemId: string;
    amount: number;
  }>(
    (body, tenant) => ({
      path: PLANS_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        PLANS_PATH(tenant),
        workingYearId ? SUMMARY_PATH(tenant, workingYearId) : PLANS_PATH(tenant)
      ]
    }
  );

  const updatePlan = useApiMutation<{ id: string; gradeIds: string[]; amount: number }>(
    ({ id, ...body }, tenant) => ({
      path: `${PLANS_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        PLANS_PATH(tenant),
        FEE_ITEMS_PATH(tenant),
        workingYearId ? SUMMARY_PATH(tenant, workingYearId) : PLANS_PATH(tenant)
      ]
    }
  );

  const updateFeeItem = useApiMutation<
    { id: string; name?: string; feeType?: string; billingType?: string },
    FeeItem
  >(
    ({ id, ...body }, tenant) => ({
      path: `${FEE_ITEMS_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        FEE_ITEMS_PATH(tenant),
        PLANS_PATH(tenant),
        workingYearId ? SUMMARY_PATH(tenant, workingYearId) : PLANS_PATH(tenant)
      ]
    }
  );

  const deletePlan = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${PLANS_PATH(tenant)}/${id}`,
      init: { method: "DELETE" }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        PLANS_PATH(tenant),
        FEE_ITEMS_PATH(tenant),
        workingYearId ? SUMMARY_PATH(tenant, workingYearId) : PLANS_PATH(tenant)
      ]
    }
  );

  const archiveFeeItem = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${FEE_ITEMS_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [FEE_ITEMS_PATH(tenant), PLANS_PATH(tenant)] }
  );

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, c("required")),
        billingType: z.string().min(1),
        feeType: z.string().min(1),
        amount: z.string().min(1, c("required")),
        gradeIds: z.array(z.string()).min(1, t("selectGradesRequired")),
        required: z.boolean()
      }),
    [c, t]
  );

  const defaultValues: ComponentFormValues = {
    name: "",
    billingType: "annual",
    feeType: "tuition",
    amount: "",
    gradeIds: selectedGradeId ? [selectedGradeId] : [],
    required: true
  };

  const form = useForm<ComponentFormValues>({
    resolver: zodResolver(schema),
    defaultValues
  });

  const billingType = form.watch("billingType");
  const amountValue = form.watch("amount");
  const nameValue = form.watch("name");
  const gradeIdsValue = form.watch("gradeIds");
  const requiredValue = form.watch("required");
  const amountSuffix = t(`amountSuffix.${billingAmountSuffixKey(billingType)}`);
  const allGradesSelected =
    activeGrades.length > 0 && activeGrades.every((grade) => gradeIdsValue.includes(grade.id));
  const someGradesSelected = gradeIdsValue.length > 0 && !allGradesSelected;
  const previewName = nameValue.trim() || t("componentPreviewPlaceholder");
  const previewAmount =
    Number.isFinite(Number(amountValue)) && Number(amountValue) > 0
      ? `${formatAmount(Number(amountValue))} ${amountSuffix}`
      : `— ${amountSuffix}`;

  const openCreate = () => {
    form.reset({
      ...defaultValues,
      gradeIds: selectedGradeId ? [selectedGradeId] : []
    });
    setFormError(null);
    setFormMode({ type: "create" });
  };

  const openEdit = (planId: string, feeItemId: string) => {
    const plan = yearPlans.find((row) => row.id === planId);
    const item = itemById.get(feeItemId);
    if (!plan || !item) return;

    form.reset({
      name: item.name,
      billingType: item.billingType,
      feeType: item.feeType,
      amount: plan.amount,
      gradeIds: plan.gradeIds,
      required: (mandatoryEnrollmentFeeTypes as readonly string[]).includes(item.feeType)
    });
    setFormError(null);
    setFormMode({ type: "edit", planId, feeItemId });
  };

  const toggleGrade = (gradeId: string) => {
    const current = form.getValues("gradeIds");
    const next = current.includes(gradeId)
      ? current.filter((id) => id !== gradeId)
      : [...current, gradeId];
    form.setValue("gradeIds", next, { shouldValidate: true, shouldDirty: true });
  };

  const selectAllGrades = () => {
    form.setValue(
      "gradeIds",
      activeGrades.map((grade) => grade.id),
      { shouldValidate: true, shouldDirty: true }
    );
  };

  const confirmRemoveComponent = async () => {
    if (!deletingComponent || !selectedGradeId) return;

    const plan = yearPlans.find((row) => row.id === deletingComponent.planId);
    if (!plan) {
      setDeletingComponent(null);
      return;
    }

    try {
      if (deletingComponent.gradeOnly) {
        await updatePlan.mutateAsync({
          id: plan.id,
          gradeIds: plan.gradeIds.filter((gradeId) => gradeId !== selectedGradeId),
          amount: Number(plan.amount)
        });
      } else {
        await deletePlan.mutateAsync({ id: plan.id });
        const hasOtherPlans = yearPlans.some(
          (row) => row.feeItemId === deletingComponent.feeItemId && row.id !== plan.id
        );
        if (!hasOtherPlans) {
          await archiveFeeItem.mutateAsync({ id: deletingComponent.feeItemId });
        }
      }
      setDeletingComponent(null);
    } catch {
      // Keep dialog open; mutation error surfaces via query invalidation / toast if configured.
    }
  };

  const summaryByGrade = new Map(
    (summary.data?.grades ?? []).map((row) => [row.gradeId, row.totalAnnual])
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title={t("feeStructuresTitle")}
        description={t("feeStructuresHelp")}
        breadcrumbs={[
          { label: nav("group_business") },
          { label: nav("finance"), href: "/dashboard/finance/invoices" },
          { label: t("feeStructuresTitle") }
        ]}
      />

      {!workingYearId ? (
        <p className="pds-type-body-s-regular muted">{t("selectAcademicYear")}</p>
      ) : (
        <div className={styles.layout}>
          <aside className={styles.gradeNav}>
            <p className={cn("pds-type-label-s-medium", styles.gradeNavLabel)}>{t("gradeLevelNav")}</p>
            {activeGrades.map((grade) => {
              const total = summaryByGrade.get(grade.id) ?? 0;
              const active = grade.id === selectedGradeId;
              return (
                <button
                  key={grade.id}
                  type="button"
                  className={`${styles.gradeNavItem} ${active ? styles.gradeNavItemActive : ""}`}
                  onClick={() => setSelectedGradeId(grade.id)}
                >
                  <span>
                    <span className={cn("pds-type-body-m-bold", styles.gradeNavName)}>{grade.name}</span>
                    <span className={cn("pds-type-body-s-regular", styles.gradeNavAmount)}>{formatMmk(total)}</span>
                  </span>
                  {active ? (
                    <Icon name="check_circle" size={18} className={styles.gradeNavCheck} />
                  ) : null}
                </button>
              );
            })}
          </aside>

          <div className={styles.main}>
            {selectedGrade ? (
              <>
                <section className={styles.hero}>
                  <div>
                    <p className={cn("pds-type-caption-m", styles.heroEyebrow)}>
                      {t("annualLabel")} · {selectedGrade.name}
                    </p>
                    <p className={cn("pds-type-display-m", styles.heroTotal)}>{formatMmk(totalAnnual)}</p>
                    <p className={cn("pds-type-body-m-medium", styles.heroSub)}>{t("annualCurrencyHint")}</p>
                  </div>
                  <div className={styles.heroStats}>
                    <div className={styles.heroStat}>
                      <span className={cn("pds-type-label-s-bold", styles.heroStatLabel)}>{t("perTerm")}</span>
                      <strong className={cn("pds-type-title-s-extrabold", styles.heroStatValue)}>
                        {formatMmk(totalAnnual / 3)}
                      </strong>
                    </div>
                    <div className={styles.heroStat}>
                      <span className={cn("pds-type-label-s-bold", styles.heroStatLabel)}>{t("perMonth")}</span>
                      <strong className={cn("pds-type-title-s-extrabold", styles.heroStatValue)}>
                        {formatMmk(totalAnnual / 12)}
                      </strong>
                    </div>
                    <div className={styles.heroStat}>
                      <span className={cn("pds-type-label-s-bold", styles.heroStatLabel)}>{t("estRevenue")}</span>
                      <strong className={cn("pds-type-title-s-extrabold", styles.heroStatValue)}>
                        {formatMmk(totalAnnual * (selectedSummary?.studentCount ?? 0))}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className={styles.componentsPanel}>
                  <div className={styles.componentsHead}>
                    <h2 className={cn("pds-type-title-xs-bold", styles.componentsTitle)}>{t("feeComponents")}</h2>
                    {canManage ? (
                      <button type="button" className={cn("pds-type-body-m-bold", styles.componentsAdd)} onClick={openCreate}>
                        <Icon name="add" />
                        {t("addComponent")}
                      </button>
                    ) : null}
                  </div>

                  {!gradeComponents.length ? (
                    <EmptyState compact embedded icon="receipt_long" title={t("noFeeComponents")} />
                  ) : (
                    <div className={styles.componentTable}>
                      <div className={cn("pds-type-caption-s", styles.componentTableHead)}>
                        <span>{t("feeComponentColumn")}</span>
                        <span className={styles.componentTableAnnualHead}>
                          {t("feeAnnualColumn")}
                        </span>
                        <span>{t("feeShareColumn")}</span>
                        <span className="sr-only">{a("actions")}</span>
                      </div>
                      {gradeComponents.map((row) => {
                        const isRequired = (
                          mandatoryEnrollmentFeeTypes as readonly string[]
                        ).includes(row.feeType);
                        return (
                        <div
                          key={row.planId}
                          className={cn(styles.componentRow, canManage && styles.componentRowClickable)}
                          tabIndex={canManage ? 0 : undefined}
                          onClick={
                            canManage
                              ? (event) => {
                                  if (isPadaukRowInteractiveTarget(event.target)) return;
                                  openEdit(row.planId, row.feeItemId);
                                }
                              : undefined
                          }
                          onKeyDown={
                            canManage
                              ? (event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  openEdit(row.planId, row.feeItemId);
                                }
                              : undefined
                          }
                        >
                          <div className={styles.componentName}>
                            <span
                              className={styles.componentDot}
                              style={{ background: feeTypeColor(row.feeType) }}
                              aria-hidden
                            />
                            <span className={styles.componentTitleRow}>
                              <span className={cn("pds-type-body-m-bold", styles.componentTitle)}>{row.name}</span>
                              {isRequired ? (
                                <span className={cn("pds-type-label-s-bold", styles.requiredBadge)}>{t("requiredBadge")}</span>
                              ) : null}
                            </span>
                          </div>
                          <span className={cn("pds-type-body-m-bold", styles.componentAmount)}>
                            {formatMmk(row.annualAmount)}
                          </span>
                          <div className={styles.shareCell}>
                            <div className={styles.shareBar}>
                              <div
                                className={styles.shareFill}
                                style={{
                                  width: `${row.share}%`,
                                  background: feeTypeColor(row.feeType)
                                }}
                              />
                            </div>
                            <span className={cn("pds-type-body-s-semibold", styles.sharePct)}>{row.share}%</span>
                          </div>
                          {canManage ? (
                            <RowMoreActionsMenu
                              ariaLabel={c("moreActions")}
                              items={[
                                {
                                  id: "view",
                                  label: c("view"),
                                  icon: "visibility",
                                  onSelect: () => openEdit(row.planId, row.feeItemId)
                                },
                                {
                                  id: "edit",
                                  label: c("edit"),
                                  icon: "edit",
                                  onSelect: () => openEdit(row.planId, row.feeItemId)
                                },
                                ...(!isRequired
                                  ? [
                                      {
                                        id: "delete",
                                        label: c("delete"),
                                        icon: "delete",
                                        destructive: true,
                                        onSelect: () => {
                                          const plan = yearPlans.find((entry) => entry.id === row.planId);
                                          setDeletingComponent({
                                            planId: row.planId,
                                            feeItemId: row.feeItemId,
                                            name: row.name,
                                            gradeOnly: Boolean(
                                              plan &&
                                                selectedGradeId &&
                                                plan.gradeIds.length > 1 &&
                                                plan.gradeIds.includes(selectedGradeId)
                                            )
                                          });
                                        }
                                      }
                                    ]
                                  : [])
                              ]}
                            />
                          ) : null}
                        </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            ) : null}

            <section className={styles.comparisonPanel}>
              <h2 className={cn("pds-type-title-s-extrabold", styles.comparisonTitle)}>{t("annualComparisonTitle")}</h2>
              {(summary.data?.grades ?? []).map((row) => {
                const width =
                  summary.data?.maxTotal && summary.data.maxTotal > 0
                    ? Math.round((row.totalAnnual / summary.data.maxTotal) * 100)
                    : 0;
                return (
                  <div key={row.gradeId} className={styles.comparisonRow}>
                    <span className={cn("pds-type-body-m-medium", styles.comparisonLabel)}>{row.gradeName}</span>
                    <div className={styles.comparisonBar}>
                      <div className={styles.comparisonFill} style={{ width: `${width}%` }} />
                    </div>
                    <span className={cn("pds-type-body-m-bold", styles.comparisonValue)}>{formatMmk(row.totalAnnual)}</span>
                  </div>
                );
              })}
            </section>
          </div>
        </div>
      )}

      <RecordFormSheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            form.reset(defaultValues);
            setFormError(null);
            setFormMode(null);
          }
        }}
        title={formMode?.type === "edit" ? t("editComponent") : t("addComponent")}
        onSubmit={form.handleSubmit(async (values) => {
          setFormError(null);
          const feeType = resolveFeeType(values.required, values.feeType);
          const payload = {
            gradeIds: values.gradeIds,
            amount: Number(values.amount)
          };

          try {
            if (formMode?.type === "edit") {
              await updateFeeItem.mutateAsync({
                id: formMode.feeItemId,
                name: values.name.trim(),
                billingType: values.billingType,
                feeType
              });
              await updatePlan.mutateAsync({ id: formMode.planId, ...payload });
            } else {
              const item = await createFeeItem.mutateAsync({
                name: values.name.trim(),
                feeType,
                billingType: values.billingType
              });
              await createPlan.mutateAsync({
                academicYearId: workingYearId,
                feeItemId: item.id,
                ...payload
              });
            }
            form.reset(defaultValues);
            setFormMode(null);
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setFormMode(null)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? c("loading") : t("saveComponent")}
            </button>
          </>
        }
      >
        <div className={styles.formStack}>
          <div className={styles.componentPreview}>
            <p className={cn("pds-type-body-m-bold", styles.componentPreviewName)}>{previewName}</p>
            <p className={cn("pds-type-title-s-extrabold", styles.componentPreviewAmount)}>{previewAmount}</p>
            {requiredValue ? (
              <span className={cn("pds-type-label-s-bold", styles.componentPreviewBadge)}>
                {t("markRequiredAutoApplied")}
              </span>
            ) : null}
          </div>

          <InputWrapper label={t("componentName")} error={form.formState.errors.name?.message}>
            <TextInput
              {...form.register("name")}
              placeholder={t("componentNamePlaceholder")}
            />
          </InputWrapper>

          <div>
            <p className={cn("pds-type-label-s-medium", styles.modalSectionLabel)}>{t("billingFrequency")}</p>
            <div className={styles.pillRow}>
              {BILLING_TYPES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn("pds-type-body-s-semibold", styles.pill, billingType === value && styles.pillActive)}
                  onClick={() => form.setValue("billingType", value, { shouldDirty: true })}
                >
                  {t(`billingTypes.${value}`)}
                </button>
              ))}
            </div>
          </div>

          <InputWrapper label={t("amount")} error={form.formState.errors.amount?.message}>
            <TextInput
              type="number"
              step="1"
              min="0"
              {...form.register("amount")}
              suffix={amountSuffix}
            />
          </InputWrapper>

          <div className={styles.gradeSection}>
            <div className={styles.gradeSectionHead}>
              <p className={cn("pds-type-label-s-medium", styles.gradeSectionLabel)}>{t("applyToGrades")}</p>
              <CheckBox
                checked={allGradesSelected}
                indeterminate={someGradesSelected}
                label={t("selectAllGrades")}
                showDescription={false}
                size="sm"
                onCheckedChange={(checked) => {
                  if (checked) {
                    selectAllGrades();
                  } else {
                    form.setValue("gradeIds", [], { shouldValidate: true, shouldDirty: true });
                  }
                }}
              />
            </div>
            <div className={cn(styles.pillRow, styles.gradePillRow)}>
              {activeGrades.map((grade) => {
                const selected = gradeIdsValue.includes(grade.id);
                return (
                  <button
                    key={grade.id}
                    type="button"
                    className={cn("pds-type-body-s-semibold", styles.gradePill, selected && styles.gradePillActive)}
                    onClick={() => toggleGrade(grade.id)}
                  >
                    {grade.name}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.gradeIds ? (
              <p className="pds-type-body-m-medium error-text">{form.formState.errors.gradeIds.message}</p>
            ) : null}
          </div>

          <div className={styles.requiredToggle}>
            <div className={styles.requiredToggleCopy}>
              <div className={styles.requiredToggleHeader}>
                <span className={cn("pds-type-body-m-medium", styles.requiredToggleTitle)}>{t("markRequired")}</span>
                {requiredValue ? (
                  <span className={cn("pds-type-label-s-bold", styles.requiredToggleBadge)}>
                    {t("markRequiredAutoApplied")}
                  </span>
                ) : null}
              </div>
              <span className={cn("pds-type-body-s-regular", styles.requiredToggleHelp)}>{t("markRequiredHelp")}</span>
            </div>
            <Toggle
              checked={requiredValue}
              onCheckedChange={(checked) => form.setValue("required", checked, { shouldValidate: true })}
              aria-label={t("markRequired")}
            />
          </div>

          {formError ? (
            <p className="pds-type-body-m-medium error-text" role="alert">
              {formError}
            </p>
          ) : null}
        </div>
      </RecordFormSheet>

      <ConfirmDialog
        open={deletingComponent !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingComponent(null);
        }}
        title={t("deleteComponentTitle")}
        description={
          deletingComponent?.gradeOnly
            ? t("deleteComponentGradeHelp", {
                name: deletingComponent.name,
                grade: selectedGrade?.name ?? ""
              })
            : t("deleteComponentHelp", { name: deletingComponent?.name ?? "" })
        }
        confirmLabel={c("delete")}
        destructive
        loading={deletePlan.isPending || updatePlan.isPending || archiveFeeItem.isPending}
        onConfirm={() => void confirmRemoveComponent()}
      />
    </div>
  );
}
