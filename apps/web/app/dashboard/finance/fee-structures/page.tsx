"use client";
import { InputWrapper, TextInput } from "../../../../components/shared/form-input";
import { Toggle } from "../../../../components/shared/toggle";

import { mandatoryEnrollmentFeeTypes } from "@sms/shared";
import { cn } from "../../../../lib/utils";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, useApiMutation, useApiQuery } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { ArchiveVisibilityFilter } from "../../../../components/shared/archive-visibility-filter";
import { filterByArchiveVisibility, type ArchiveVisibility } from "../../../lib/archive-filter";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { toastSuccess } from "../../../lib/toast";
import { zodResolver } from "../../../lib/zod-resolver";
import { PageHeader } from "../../page-header-context";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { useCurrentAcademicYear } from "../../../lib/use-current-academic-year";
import { useTenantFormats } from "../../../lib/use-tenant-formats";
import { CheckBox } from "../../../../components/pds";
import { Button } from "../../../../components/ui/button";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { RowMoreActionsMenu } from "../../../../components/shared/row-more-actions";
import { EmptyState } from "../../../../components/shared/empty-state";
import styles from "./fee-structures.module.css";

type Grade = { id: string; name: string; status?: string; sortOrder?: number };
type FeeItem = { id: string; name: string; feeType: string; billingType: string; status: string };
type FeePlan = { id: string; academicYearId: string; gradeIds: string[]; feeItemId: string; amount: string };
type ComponentFormValues = { name: string; billingType: string; required: boolean };

const BILLING_TYPES = ["annual", "monthly", "term", "one_time"] as const;

const PLANS_PATH = (tenant: string) => `/tenants/${tenant}/finance/enrollment-fee-plans`;
const FEE_ITEMS_PATH = (tenant: string) => `/tenants/${tenant}/finance/fee-items`;
const SUMMARY_PATH = (tenant: string, yearId: string) =>
  `/tenants/${tenant}/finance/fee-structures/summary?academicYearId=${yearId}`;

function annualizeAmount(amount: number, billingType: string): number {
  if (!Number.isFinite(amount)) return 0;
  switch (billingType) {
    case "monthly":
      return amount * 12;
    case "term":
      return amount * 3;
    default:
      return amount;
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

// Category indicator colors drawn from the shared status palette so the dots
// stay consistent with the rest of finance instead of ad-hoc brand hues.
function feeTypeColor(feeType: string): string {
  switch (feeType) {
    case "tuition":
      return "var(--pds-status-info)";
    case "registration":
      return "var(--pds-status-error)";
    case "transport":
      return "var(--pds-status-success)";
    default:
      return "var(--pds-status-warning)";
  }
}

type GradeDraft = Record<string, { included: boolean; amount: string }>;

export default function FeeStructuresPage() {
  const t = useTranslations("finance");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const { formatMoney } = useTenantFormats();
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["finance.manage"]);
  const currentYear = useCurrentAcademicYear();
  const workingYearId = currentYear.data?.id ?? "";

  const [selectedFeeItemId, setSelectedFeeItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GradeDraft>({});
  const [originalDraft, setOriginalDraft] = useState<GradeDraft>({});
  const [addOpen, setAddOpen] = useState(false);
  const [renaming, setRenaming] = useState<FeeItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<FeeItem | null>(null);
  const [restoring, setRestoring] = useState<FeeItem | null>(null);
  const [permanentDeleting, setPermanentDeleting] = useState<FeeItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [componentView, setComponentView] = useState<ArchiveVisibility>("active");
  const [lastEditedGrade, setLastEditedGrade] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const grades = useApiQuery<Grade[]>((tenant) => `/tenants/${tenant}/academics/grades`);
  const feeItems = useApiQuery<FeeItem[]>(FEE_ITEMS_PATH);
  const plans = useApiQuery<FeePlan[]>(PLANS_PATH);

  const dataError = grades.isError || feeItems.isError || plans.isError;
  const dataLoading =
    !dataError &&
    (grades.isLoading || feeItems.isLoading || plans.isLoading) &&
    !(grades.data && feeItems.data && plans.data);

  const activeGrades = useMemo(
    () =>
      (grades.data ?? [])
        .filter((grade) => grade.status !== "archived")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [grades.data]
  );

  const activeComponents = useMemo(
    () => (feeItems.data ?? []).filter((item) => item.status === "active"),
    [feeItems.data]
  );

  const displayedComponents = useMemo(
    () => filterByArchiveVisibility(feeItems.data ?? [], componentView),
    [feeItems.data, componentView]
  );

  const yearPlans = useMemo(
    () => plans.data?.filter((plan) => plan.academicYearId === workingYearId) ?? [],
    [plans.data, workingYearId]
  );

  const selectedComponent =
    (feeItems.data ?? []).find((item) => item.id === selectedFeeItemId) ?? null;
  const selectedArchived = selectedComponent?.status === "archived";
  const amountSuffix = t(`amountSuffix.${billingAmountSuffixKey(selectedComponent?.billingType ?? "annual")}`);

  // Keep a valid selection within the current view.
  useEffect(() => {
    const inView = displayedComponents.some((item) => item.id === selectedFeeItemId);
    if (!inView) {
      setSelectedFeeItemId(displayedComponents[0]?.id ?? null);
    }
  }, [displayedComponents, selectedFeeItemId]);

  // Build the grade/amount editor state from the selected component's plans.
  useEffect(() => {
    if (!selectedFeeItemId) return;
    const next: GradeDraft = {};
    for (const grade of activeGrades) next[grade.id] = { included: false, amount: "" };
    for (const plan of yearPlans.filter((p) => p.feeItemId === selectedFeeItemId)) {
      for (const gradeId of plan.gradeIds) {
        if (next[gradeId]) next[gradeId] = { included: true, amount: plan.amount };
      }
    }
    setDraft(next);
    setOriginalDraft(next);
    setLastEditedGrade(null);
  }, [selectedFeeItemId, yearPlans, activeGrades]);

  // Per-grade annual totals across all components (for the comparison chart + left rail counts).
  const componentTotals = useMemo(() => {
    const map = new Map<string, { grades: number; annual: number }>();
    for (const item of activeComponents) map.set(item.id, { grades: 0, annual: 0 });
    for (const plan of yearPlans) {
      const item = feeItems.data?.find((f) => f.id === plan.feeItemId);
      const entry = map.get(plan.feeItemId);
      if (!item || !entry) continue;
      entry.grades += plan.gradeIds.length;
      entry.annual += annualizeAmount(Number(plan.amount), item.billingType) * plan.gradeIds.length;
    }
    return map;
  }, [activeComponents, yearPlans, feeItems.data]);

  const includedCount = Object.values(draft).filter((d) => d.included).length;
  const editorAnnualTotal = useMemo(
    () =>
      Object.values(draft)
        .filter((d) => d.included && Number(d.amount) > 0)
        .reduce((sum, d) => sum + annualizeAmount(Number(d.amount), selectedComponent?.billingType ?? "annual"), 0),
    [draft, selectedComponent?.billingType]
  );

  const allGradesIncluded = activeGrades.length > 0 && activeGrades.every((g) => draft[g.id]?.included);

  const setGrade = (gradeId: string, patch: Partial<{ included: boolean; amount: string }>) => {
    setDraft((prev) => ({ ...prev, [gradeId]: { ...(prev[gradeId] ?? { included: false, amount: "" }), ...patch } }));
  };

  const toggleAllGrades = (checked: boolean) => {
    setDraft((prev) => {
      const next: GradeDraft = { ...prev };
      for (const grade of activeGrades) {
        next[grade.id] = {
          included: checked,
          amount: next[grade.id]?.amount || ""
        };
      }
      return next;
    });
  };

  // Copy one grade's amount to the other SELECTED grades only — never auto-include
  // grades the user left unchecked.
  const applyAmountToAll = (amount: string) => {
    if (!Number(amount)) return;
    setDraft((prev) => {
      const next: GradeDraft = { ...prev };
      for (const grade of activeGrades) {
        if (prev[grade.id]?.included) {
          next[grade.id] = { included: true, amount };
        }
      }
      return next;
    });
  };

  const createFeeItem = useApiMutation<{ name: string; feeType: string; billingType: string }, FeeItem>(
    (body, tenant) => ({ path: FEE_ITEMS_PATH(tenant), init: { method: "POST", body: JSON.stringify(body) } }),
    { invalidatePaths: (_b, tenant) => [FEE_ITEMS_PATH(tenant)] }
  );

  const updateFeeItem = useApiMutation<{ id: string; name?: string }, FeeItem>(
    ({ id, ...body }, tenant) => ({ path: `${FEE_ITEMS_PATH(tenant)}/${id}`, init: { method: "PATCH", body: JSON.stringify(body) } }),
    { invalidatePaths: (_b, tenant) => [FEE_ITEMS_PATH(tenant)] }
  );

  const archiveFeeItem = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${FEE_ITEMS_PATH(tenant)}/${id}/archive`, init: { method: "POST" } }),
    { showErrorToast: false, invalidatePaths: (_b, tenant) => [FEE_ITEMS_PATH(tenant), PLANS_PATH(tenant)] }
  );

  const restoreFeeItem = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${FEE_ITEMS_PATH(tenant)}/${id}/restore`, init: { method: "POST" } }),
    { showErrorToast: false, invalidatePaths: (_b, tenant) => [FEE_ITEMS_PATH(tenant), PLANS_PATH(tenant)] }
  );

  const deleteFeeItem = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({ path: `${FEE_ITEMS_PATH(tenant)}/${id}`, init: { method: "DELETE" } }),
    { showErrorToast: false, invalidatePaths: (_b, tenant) => [FEE_ITEMS_PATH(tenant), PLANS_PATH(tenant)] }
  );

  const reconcile = useApiMutation<{ academicYearId: string; entries: Array<{ gradeId: string; amount: number }> }>(
    (body, tenant) => ({
      path: `${FEE_ITEMS_PATH(tenant)}/${selectedFeeItemId}/grade-amounts`,
      init: { method: "PUT", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        PLANS_PATH(tenant),
        FEE_ITEMS_PATH(tenant),
        workingYearId ? SUMMARY_PATH(tenant, workingYearId) : PLANS_PATH(tenant)
      ]
    }
  );

  async function saveGrades() {
    if (!selectedFeeItemId) return;
    setFormError(null);
    const entries = Object.entries(draft)
      .filter(([, d]) => d.included && Number(d.amount) > 0)
      .map(([gradeId, d]) => ({ gradeId, amount: Number(d.amount) }));
    try {
      await reconcile.mutateAsync({ academicYearId: workingYearId, entries });
      toastSuccess(t("componentSaved"));
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
    }
  }

  // ── Add component modal ──
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, c("required")),
        billingType: z.string().min(1),
        required: z.boolean()
      }),
    [c]
  );
  const form = useForm<ComponentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", billingType: "annual", required: false }
  });
  const billingType = form.watch("billingType");
  const requiredValue = form.watch("required");

  const isSaving = reconcile.isPending;

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
        actions={
          <ArchiveVisibilityFilter value={componentView} onChange={setComponentView} />
        }
      />

      {!workingYearId ? (
        <p className="pds-type-body-s-regular muted">{t("selectAcademicYear")}</p>
      ) : dataError ? (
        <EmptyState embedded icon="error" title={c("somethingWrong")} />
      ) : dataLoading ? (
        <p className="pds-type-body-s-regular muted">{c("loading")}</p>
      ) : (
        <div className={styles.layout}>
          <aside className={styles.gradeNav}>
            <div className={styles.componentsHead}>
              <p className={cn("pds-type-title-xxs-extrabold", styles.gradeNavLabel)}>{t("feeComponents")}</p>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  buttonType="ghost"
                  buttonColor="secondary"
                  onClick={() => {
                    form.reset({ name: "", billingType: "annual", required: false });
                    setFormError(null);
                    setAddOpen(true);
                  }}
                >
                  <Icon name="add" size={16} />
                  {t("addComponent")}
                </Button>
              ) : null}
            </div>
            {!displayedComponents.length ? (
              <p className="pds-type-body-s-regular muted">{t("noComponentsYet")}</p>
            ) : (
              displayedComponents.map((item) => {
                const active = item.id === selectedFeeItemId;
                const totals = componentTotals.get(item.id);
                const archived = item.status === "archived";
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.gradeNavItem} ${active ? styles.gradeNavItemActive : ""}`}
                    onClick={() => setSelectedFeeItemId(item.id)}
                  >
                    <span>
                      <span className={cn("pds-type-body-m-bold", styles.gradeNavName)}>
                        <span className={styles.componentDot} style={{ background: feeTypeColor(item.feeType) }} aria-hidden />
                        {item.name}
                        {archived ? (
                          <span className="badge badge--neutral" style={{ marginInlineStart: 6 }}>
                            {c("viewArchived")}
                          </span>
                        ) : null}
                      </span>
                      <span className={cn("pds-type-body-s-regular", styles.gradeNavAmount)}>
                        {t(`billingTypes.${item.billingType}`)} · {t("appliesToGrades", { count: totals?.grades ?? 0 })}
                      </span>
                    </span>
                    {active ? <Icon name="chevron_right" size={18} className={styles.gradeNavCheck} /> : null}
                  </button>
                );
              })
            )}
          </aside>

          <div className={styles.main}>
            {selectedComponent ? (
              <>
                <section className={styles.hero}>
                  <div>
                    <p className={cn("pds-type-caption-m", styles.heroEyebrow)}>
                      {t(`billingTypes.${selectedComponent.billingType}`)} · {selectedComponent.name}
                    </p>
                    <p className={cn("pds-type-display-m", styles.heroTotal)}>{formatMoney(editorAnnualTotal)}</p>
                    <p className={cn("pds-type-body-m-medium", styles.heroSub)}>{t("componentAnnualHint")}</p>
                  </div>
                  <div className={styles.heroStats}>
                    <div className={styles.heroStat}>
                      <span className={cn("pds-type-label-s-bold", styles.heroStatLabel)}>{t("appliedGradesStat")}</span>
                      <strong className={cn("pds-type-title-s-extrabold", styles.heroStatValue)}>
                        {includedCount} / {activeGrades.length}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className={styles.componentsPanel}>
                  <div className={styles.componentsHead}>
                    <h2 className={cn("pds-type-title-xs-bold", styles.componentsTitle)}>{t("whereItApplies")}</h2>
                    {canManage ? (
                      <div className={styles.headActions}>
                        <Button
                          type="button"
                          size="sm"
                          buttonType="filled"
                          buttonColor="primary"
                          onClick={() => void saveGrades()}
                          disabled={isSaving}
                        >
                          <Icon name="check" size={16} />
                          {isSaving ? c("loading") : t("saveChanges")}
                        </Button>
                        <RowMoreActionsMenu
                          ariaLabel={c("moreActions")}
                          items={[
                            {
                              id: "rename",
                              label: t("renameComponent"),
                              icon: "edit",
                              onSelect: () => {
                                setRenaming(selectedComponent);
                                setRenameValue(selectedComponent.name);
                              }
                            },
                            ...(selectedArchived
                              ? [
                                  {
                                    id: "restore",
                                    label: c("restore"),
                                    icon: "restore",
                                    onSelect: () => {
                                      void restoreFeeItem.mutateAsync({ id: selectedComponent.id }).then(() => {
                                        void feeItems.refetch();
                                      });
                                    }
                                  },
                                  {
                                    id: "delete",
                                    label: c("deletePermanently"),
                                    icon: "delete_forever",
                                    destructive: true,
                                    onSelect: () => {
                                      setDeleteError(null);
                                      setPermanentDeleting(selectedComponent);
                                    }
                                  }
                                ]
                              : [
                                  {
                                    id: "archive",
                                    label: c("archive"),
                                    icon: "archive",
                                    destructive: true,
                                    onSelect: () => {
                                      setDeleteError(null);
                                      setDeleting(selectedComponent);
                                    }
                                  }
                                ])
                          ]}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.componentsBody}>
                    {canManage ? (
                      <CheckBox
                        checked={allGradesIncluded}
                        indeterminate={includedCount > 0 && !allGradesIncluded}
                        label={t("selectAllGrades")}
                        showDescription={false}
                        size="sm"
                        onCheckedChange={(checked) => toggleAllGrades(Boolean(checked))}
                      />
                    ) : null}

                    <div className={styles.gradeEditor}>
                      {activeGrades.map((grade) => {
                        const d = draft[grade.id] ?? { included: false, amount: "" };
                        const originalAmount = originalDraft[grade.id]?.amount ?? "";
                        const changed = Number(d.amount) !== Number(originalAmount);
                        const showApplyAll =
                          canManage && lastEditedGrade === grade.id && Number(d.amount) > 0 && changed;
                        // Checked when every *selected* grade already shares this amount.
                        const includedGrades = activeGrades.filter((g) => draft[g.id]?.included);
                        const allShareAmount =
                          Number(d.amount) > 0 &&
                          includedGrades.length > 0 &&
                          includedGrades.every((g) => Number(draft[g.id]?.amount) === Number(d.amount));
                        return (
                          <div key={grade.id} className={cn(styles.gradeEditorRow, d.included && styles.gradeEditorRowActive)}>
                            <div className={styles.gradeEditorMain}>
                              <CheckBox
                                size="sm"
                                label={grade.name}
                                checked={d.included}
                                disabled={!canManage}
                                onCheckedChange={(checked) => setGrade(grade.id, { included: checked })}
                              />
                              <TextInput
                                type="number"
                                min="0"
                                value={d.amount}
                                disabled={!canManage || !d.included}
                                onChange={(e) => {
                                  setGrade(grade.id, { amount: e.target.value });
                                  setLastEditedGrade(grade.id);
                                }}
                                suffix={amountSuffix}
                                className={styles.gradeEditorAmount}
                              />
                            </div>
                            {showApplyAll ? (
                              <CheckBox
                                size="sm"
                                className={styles.applyAllRow}
                                label={t("applyToAllGrades")}
                                checked={allShareAmount}
                                onCheckedChange={(checked) => {
                                  if (checked) applyAmountToAll(d.amount);
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {formError ? <p className="pds-type-body-s-regular error-text">{formError}</p> : null}
                  </div>
                </section>
              </>
            ) : (
              <EmptyState compact icon="receipt_long" title={t("noComponentsYet")} />
            )}
          </div>
        </div>
      )}

      {/* Add component */}
      <RecordFormSheet
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setFormError(null);
        }}
        title={t("addComponent")}
        onSubmit={form.handleSubmit(async (values) => {
          setFormError(null);
          const feeType = values.required ? "tuition" : "other";
          try {
            const item = await createFeeItem.mutateAsync({
              name: values.name.trim(),
              feeType,
              billingType: values.billingType
            });
            setSelectedFeeItemId(item.id);
            setAddOpen(false);
          } catch (error) {
            setFormError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        })}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setAddOpen(false)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? c("loading") : t("saveComponent")}
            </button>
          </>
        }
      >
        <div className={styles.formStack}>
          <InputWrapper label={t("componentName")} error={form.formState.errors.name?.message}>
            <TextInput {...form.register("name")} placeholder={t("componentNamePlaceholder")} />
          </InputWrapper>

          <InputWrapper label={t("billingFrequency")}>
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
          </InputWrapper>

          <div className={styles.requiredToggle}>
            <div className={styles.requiredToggleCopy}>
              <p className={cn("pds-type-body-m-bold", styles.requiredToggleTitle)}>{t("markRequired")}</p>
              <p className={cn("pds-type-body-s-regular", styles.requiredToggleHelp)}>{t("markRequiredAutoApplied")}</p>
            </div>
            <Toggle surface="secondary" checked={requiredValue} onCheckedChange={(checked) => form.setValue("required", checked)} />
          </div>

          {formError ? <p className="pds-type-body-s-regular error-text">{formError}</p> : null}
        </div>
      </RecordFormSheet>

      {/* Rename component */}
      <RecordFormSheet
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        title={t("renameComponent")}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!renaming || !renameValue.trim()) return;
          await updateFeeItem.mutateAsync({ id: renaming.id, name: renameValue.trim() });
          setRenaming(null);
        }}
        footer={
          <>
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => setRenaming(null)}>
              {c("cancel")}
            </button>
            <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={updateFeeItem.isPending}>
              {updateFeeItem.isPending ? c("loading") : c("save")}
            </button>
          </>
        }
      >
        <InputWrapper label={t("componentName")}>
          <TextInput value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
        </InputWrapper>
      </RecordFormSheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        title={t("archiveComponent")}
        description={deleteError ?? (deleting ? t("archiveComponentHelp", { name: deleting.name }) : "")}
        confirmLabel={c("archive")}
        cancelLabel={c("cancel")}
        destructive
        loading={archiveFeeItem.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          setDeleteError(null);
          try {
            await archiveFeeItem.mutateAsync({ id: deleting.id });
            if (selectedFeeItemId === deleting.id) setSelectedFeeItemId(null);
            setDeleting(null);
          } catch (error) {
            setDeleteError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        }}
      />

      <ConfirmDialog
        open={permanentDeleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPermanentDeleting(null);
            setDeleteError(null);
          }
        }}
        title={t("deleteComponent")}
        description={
          deleteError ??
          (permanentDeleting ? t("deleteComponentHelp", { name: permanentDeleting.name }) : "")
        }
        confirmLabel={c("deletePermanently")}
        cancelLabel={c("cancel")}
        destructive
        loading={deleteFeeItem.isPending}
        onConfirm={async () => {
          if (!permanentDeleting) return;
          setDeleteError(null);
          try {
            await deleteFeeItem.mutateAsync({ id: permanentDeleting.id });
            if (selectedFeeItemId === permanentDeleting.id) setSelectedFeeItemId(null);
            setPermanentDeleting(null);
          } catch (error) {
            setDeleteError(error instanceof ApiError ? error.message : c("somethingWrong"));
          }
        }}
      />
    </div>
  );
}
