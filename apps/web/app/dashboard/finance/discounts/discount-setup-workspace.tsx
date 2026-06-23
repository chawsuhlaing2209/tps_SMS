"use client";

import { discountPaymentPlanFrequencies } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { CheckBox, ToggleList, ToggleListItem } from "../../../../components/pds";
import { InputWrapper, TextInput } from "../../../../components/shared/form-input";
import { SelectionCard, SelectionCardGrid } from "../../../../components/shared/selection-card";
import { Stepper } from "../../../../components/shared/stepper";
import { ConfirmDialog } from "../../../../components/shared/confirm-dialog";
import { cn } from "../../../../lib/utils";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { RecordFormModal } from "../../../lib/record-modal";
import {
  emptyDiscountForm,
  mergeDiscountForm,
  formToPayload,
  ruleToForm,
  type DiscountRuleFormValues,
  type DiscountRuleRecord
} from "./discount-form";
import "./discount-setup-modal.css";

const DISCOUNT_SETUP_STEPS = ["information", "value", "eligibility", "rules", "review"] as const;
type DiscountSetupStep = (typeof DISCOUNT_SETUP_STEPS)[number];

const RULES_PATH = (tenant: string) => `/tenants/${tenant}/discounts/rules`;

const PAYMENT_PLAN_LABEL_KEYS = {
  annual: "paymentPlanAnnual",
  term: "paymentPlanTerm",
  monthly: "paymentPlanMonthly"
} as const;

type FeeItemOption = { id: string; name: string; feeType: string; status: string };
type GradeOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  ruleId?: string;
  onSaved?: () => void;
};

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="discount-section-intro">
      <h2 className="pds-type-title-s-extrabold">{title}</h2>
      <p className="pds-type-body-s-regular muted">{description}</p>
    </div>
  );
}

export function DiscountSetupModal({ open, onOpenChange, mode, ruleId, onSaved }: Props) {
  const t = useTranslations("discounts");
  const c = useTranslations("common");

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DiscountRuleFormValues>(emptyDiscountForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DiscountRuleFormValues, string>>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  const rules = useApiQuery<DiscountRuleRecord[]>(open ? RULES_PATH : () => null);
  const feeItems = useApiQuery<FeeItemOption[]>((tenant) => `/tenants/${tenant}/finance/fee-items`);
  const grades = useApiQuery<GradeOption[]>((tenant) => `/tenants/${tenant}/academics/grades`);

  const editingRule = useMemo(
    () => (mode === "edit" && ruleId ? rules.data?.find((rule) => rule.id === ruleId) : null),
    [mode, ruleId, rules.data]
  );

  useEffect(() => {
    if (!open) {
      setStep(0);
      setForm(emptyDiscountForm());
      setFormErrors({});
      return;
    }
    if (mode === "edit" && editingRule) {
      setForm(mergeDiscountForm(ruleToForm(editingRule)));
      setStep(0);
      setFormErrors({});
    }
    if (mode === "create") {
      setForm(emptyDiscountForm());
      setStep(0);
      setFormErrors({});
    }
  }, [open, mode, editingRule]);

  const createRule = useApiMutation<Record<string, unknown>>(
    (body, tenant) => ({
      path: RULES_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant)] }
  );

  const updateRule = useApiMutation<{ id: string } & Record<string, unknown>>(
    ({ id, ...body }, tenant) => ({
      path: `${RULES_PATH(tenant)}/${id}`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant)] }
  );

  const deactivateRule = useApiMutation<{ id: string }>(
    ({ id }, tenant) => ({
      path: `${RULES_PATH(tenant)}/${id}/archive`,
      init: { method: "POST" }
    }),
    { invalidatePaths: (_b, tenant) => [RULES_PATH(tenant)] }
  );

  const activeFeeItems = (feeItems.data ?? []).filter((item) => item.status === "active");
  const feeTypesByItemId = useMemo(
    () => Object.fromEntries(activeFeeItems.map((item) => [item.id, item.feeType])),
    [activeFeeItems]
  );

  const scopeFeeItems = activeFeeItems.length
    ? activeFeeItems
    : [
        { id: "tuition", name: "Tuition", feeType: "tuition", status: "active" },
        { id: "registration", name: "Registration", feeType: "registration", status: "active" },
        { id: "lab", name: "Lab fee", feeType: "lab", status: "active" },
        { id: "transport", name: "Transport", feeType: "transport", status: "active" },
        { id: "lunch", name: "Lunch", feeType: "lunch", status: "active" },
        { id: "activities", name: "Activities", feeType: "activities", status: "active" }
      ];

  const currentStep = DISCOUNT_SETUP_STEPS[step] as DiscountSetupStep;
  const setupSteps = DISCOUNT_SETUP_STEPS.map((key) => ({
    id: key,
    label: t(`setupStep_${key}`)
  }));

  const formSchema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, c("required")),
          valueType: z.enum(["percentage", "fixed"]),
          value: z.string().trim().min(1, c("required")),
          feeItemIds: z.array(z.string()).min(1, t("feeComponentsRequired")),
          billingContexts: z.array(z.string()).min(1, t("billingContextsRequired"))
        })
        .superRefine((data, ctx) => {
          const num = Number(data.value);
          if (!Number.isFinite(num) || num < 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("valueRequiredError"),
              path: ["value"]
            });
            return;
          }
          if (data.valueType === "percentage" && num > 100) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("percentRangeError"),
              path: ["value"]
            });
          }
          if (data.valueType === "fixed" && num <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("fixedAmountError"),
              path: ["value"]
            });
          }
        }),
    [c, t]
  );

  function setField<K extends keyof DiscountRuleFormValues>(
    field: K,
    value: DiscountRuleFormValues[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setGradeSelection(scope: "all" | "specific", gradeIds: string[]) {
    setForm((current) => ({ ...current, gradeScope: scope, gradeIds }));
    if (formErrors.gradeIds) {
      setFormErrors((current) => ({ ...current, gradeIds: undefined }));
    }
  }

  function selectValueType(nextType: "percentage" | "fixed") {
    setForm((current) => ({
      ...current,
      valueType: nextType,
      value:
        nextType === "percentage"
          ? current.valueType === "percentage"
            ? current.value
            : "10"
          : current.valueType === "fixed"
            ? current.value
            : "50000"
    }));
    setFormErrors({});
  }

  function toggleFeeItem(feeItemId: string) {
    setForm((current) => {
      const selected = current.feeItemIds.includes(feeItemId);
      const feeItemIds = selected
        ? current.feeItemIds.filter((id) => id !== feeItemId)
        : [...current.feeItemIds, feeItemId];
      return { ...current, feeItemIds };
    });
    if (formErrors.feeItemIds) {
      setFormErrors((current) => ({ ...current, feeItemIds: undefined }));
    }
  }

  function validateStep(index: number): boolean {
    if (index === 0) {
      const num = Number(form.value);
      if (!form.name.trim()) {
        setFormErrors({ name: c("required") });
        return false;
      }
      if (!form.value.trim()) {
        setFormErrors({ value: t("valueRequiredError") });
        return false;
      }
      if (form.valueType === "percentage" && (!Number.isFinite(num) || num < 0 || num > 100)) {
        setFormErrors({ value: t("percentRangeError") });
        return false;
      }
      if (form.valueType === "fixed" && (!Number.isFinite(num) || num <= 0)) {
        setFormErrors({ value: t("fixedAmountError") });
        return false;
      }
      setFormErrors({});
      return true;
    }
    if (index === 1) {
      if (!form.feeItemIds.length) {
        setFormErrors({ feeItemIds: t("feeComponentsRequired") });
        return false;
      }
      if (form.gradeScope === "specific" && !form.gradeIds.length) {
        setFormErrors({ gradeIds: t("selectGradeRequired") });
        return false;
      }
      setFormErrors({});
      return true;
    }
    setFormErrors({});
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    if (step < DISCOUNT_SETUP_STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    void saveRule();
  }

  function closeModal() {
    onOpenChange(false);
  }

  function goBack() {
    if (step > 0) {
      setStep((current) => current - 1);
      return;
    }
    closeModal();
  }

  async function saveRule() {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      setStep(0);
      return;
    }

    const payload = formToPayload(form, feeTypesByItemId);

    if (mode === "edit" && ruleId) {
      await updateRule.mutateAsync({ id: ruleId, ...payload });
    } else {
      await createRule.mutateAsync(payload);
    }

    closeModal();
    onSaved?.();
  }
  const modalTitle = mode === "edit" ? t("editComponent") : t("addDiscount");
  const saving = createRule.isPending || updateRule.isPending;
  const gradeList = grades.data ?? [];
  const allGradesSelected =
    form.gradeScope === "all" ||
    (gradeList.length > 0 && gradeList.every((grade) => form.gradeIds.includes(grade.id)));
  const someGradesSelected = !allGradesSelected && form.gradeIds.length > 0;
  const amountSuffix =
    form.valueType === "percentage" ? t("percentOffEligible") : "MMK";
  const editLoading = mode === "edit" && rules.isLoading;
  const editMissing = mode === "edit" && Boolean(ruleId) && !rules.isLoading && !editingRule;

  return (
    <>
      <RecordFormModal
        open={open}
        size="wide"
        contentClassName="record-modal--discount-setup"
        headerVariant="withStepper"
        closeLabel={c("close")}
        title={modalTitle}
        stepper={
          <Stepper
            variant="ceremony"
            steps={setupSteps}
            currentStep={step}
            ariaLabel={t("setupProgress")}
            onStepClick={(index) => {
              if (index <= step) setStep(index);
            }}
          />
        }
        onOpenChange={onOpenChange}
        onSubmit={(event) => {
          event.preventDefault();
          if (step === DISCOUNT_SETUP_STEPS.length - 1) return;
          goNext();
        }}
        footerStart={
          mode === "edit" && editingRule && editingRule.status === "active" ? (
            <button
              type="button"
              className="pds-type-body-m-bold btn-ghost discount-setup-footer__delete"
              onClick={() => setDeleteOpen(true)}
            >
              <Icon name="delete" />
              {c("delete")}
            </button>
          ) : null
        }
        footer={
          <>
            {step === 0 ? (
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={closeModal}>
                {c("cancel")}
              </button>
            ) : (
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={goBack}>
                <Icon name="arrow_back" />
                {c("previous")}
              </button>
            )}
            {step === DISCOUNT_SETUP_STEPS.length - 1 ? (
              <button
                type="button"
                className="pds-type-body-m-bold btn-primary"
                disabled={saving || editLoading || editMissing}
                onClick={() => void goNext()}
              >
                {saving ? c("loading") : mode === "edit" ? c("save") : t("createDiscount")}
              </button>
            ) : (
              <button
                type="submit"
                className="pds-type-body-m-bold btn-primary"
                disabled={editLoading || editMissing}
              >
                {t("setupContinue")}
                <Icon name="arrow_forward" />
              </button>
            )}
          </>
        }
      >
        {editLoading ? (
          <p className="pds-type-body-s-regular muted">{c("loading")}</p>
        ) : editMissing ? (
          <p className="pds-type-body-m-medium error-text">{t("ruleNotFound")}</p>
        ) : (
          <>
            {currentStep === "information" ? (
              <section className="discount-setup-section">
                <SectionIntro title={t("setupInformationTitle")} description={t("setupTypeHelpCustom")} />

                <InputWrapper label={t("ruleName")} required error={formErrors.name}>
                  <TextInput
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder={t("ruleNamePlaceholder")}
                  />
                </InputWrapper>

                <div>
                  <p className="pds-type-label-s-medium discount-field-label">{t("awardBasisLabel")}</p>
                  <div className="award-basis-grid">
                    <button
                      type="button"
                      className={cn("award-basis-card", form.valueType === "percentage" && "award-basis-card--selected")}
                      onClick={() => selectValueType("percentage")}
                    >
                      <Icon name="percent" size={22} className="award-basis-card__icon" />
                      <span className="award-basis-card__copy">
                        <strong className="pds-type-body-s-bold">{t("calcMethodPercentageTitle")}</strong>
                        <span className="pds-type-body-s-regular muted">{t("calcMethodPercentageDesc")}</span>
                      </span>
                      {form.valueType === "percentage" ? (
                        <CheckBox checked disabled showLabel={false} showDescription={false} />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={cn("award-basis-card", form.valueType === "fixed" && "award-basis-card--selected")}
                      onClick={() => selectValueType("fixed")}
                    >
                      <Icon name="payments" size={22} className="award-basis-card__icon" />
                      <span className="award-basis-card__copy">
                        <strong className="pds-type-body-s-bold">{t("calcMethodFixedTitle")}</strong>
                        <span className="pds-type-body-s-regular muted">{t("calcMethodFixedDesc")}</span>
                      </span>
                      {form.valueType === "fixed" ? (
                        <CheckBox checked disabled showLabel={false} showDescription={false} />
                      ) : null}
                    </button>
                  </div>
                </div>

                <InputWrapper
                  label={form.valueType === "percentage" ? t("discountPercentage") : t("fixedAmountLabel")}
                  required
                  error={formErrors.value}
                >
                  <TextInput
                    type="number"
                    min={form.valueType === "percentage" ? 0 : 1}
                    max={form.valueType === "percentage" ? 100 : undefined}
                    step={form.valueType === "fixed" ? 1000 : 1}
                    value={form.value}
                    onChange={(event) => setField("value", event.target.value)}
                    suffix={amountSuffix}
                  />
                </InputWrapper>
              </section>
            ) : null}

            {currentStep === "value" ? (
              <section className="discount-setup-section">
                <SectionIntro title={t("setupScopeTitle")} description={t("setupScopeHelpCustom")} />

                <div>
                  <p className="pds-type-label-s-medium discount-field-label">{t("feeComponentsLabel")}</p>
                  <p className="pds-type-body-s-regular muted discount-field-hint">{t("feeComponentsHelp")}</p>
                  <div className="fee-component-chip-row">
                    {scopeFeeItems.map((item) => {
                      const selected = form.feeItemIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={cn("fee-component-chip", selected && "fee-component-chip--selected")}
                          onClick={() => toggleFeeItem(item.id)}
                        >
                          <span
                            className={cn("fee-component-chip__check", selected && "fee-component-chip__check--on")}
                            aria-hidden
                          >
                            {selected ? <Icon name="check" size={14} /> : null}
                          </span>
                          <span className="pds-type-body-s-semibold">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {formErrors.feeItemIds ? (
                    <p className="pds-type-body-s-regular error-text">{formErrors.feeItemIds}</p>
                  ) : null}
                </div>

                <div>
                  <div className="discount-grade-head">
                    <p className="pds-type-label-s-medium discount-field-label">{t("selectGradeLabel")}</p>
                    <CheckBox
                      checked={allGradesSelected}
                      indeterminate={someGradesSelected}
                      label={t("selectAllGrades")}
                      showDescription={false}
                      size="sm"
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setGradeSelection("all", []);
                        } else {
                          setGradeSelection("specific", []);
                        }
                      }}
                    />
                  </div>
                  <div className="discount-pill-grid">
                    {gradeList.map((grade) => {
                      const selected =
                        form.gradeScope === "all" || form.gradeIds.includes(grade.id);
                      return (
                        <button
                          key={grade.id}
                          type="button"
                          aria-pressed={selected}
                          className={cn("discount-pill", selected && "discount-pill--selected")}
                          onClick={() => {
                            if (form.gradeScope === "all") {
                              setGradeSelection("specific", [grade.id]);
                              return;
                            }
                            if (selected) {
                              const next = form.gradeIds.filter((id) => id !== grade.id);
                              if (
                                gradeList.length > 0 &&
                                next.length > 0 &&
                                gradeList.every((entry) => next.includes(entry.id))
                              ) {
                                setGradeSelection("all", []);
                              } else {
                                setGradeSelection("specific", next);
                              }
                              return;
                            }
                            const next = [...form.gradeIds, grade.id];
                            if (
                              gradeList.length > 0 &&
                              gradeList.every((entry) => next.includes(entry.id))
                            ) {
                              setGradeSelection("all", []);
                            } else {
                              setGradeSelection("specific", next);
                            }
                          }}
                        >
                          {grade.name}
                        </button>
                      );
                    })}
                  </div>
                  {formErrors.gradeIds ? (
                    <p className="pds-type-body-s-regular error-text">{formErrors.gradeIds}</p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {currentStep === "eligibility" ? (
              <section className="discount-setup-section">
                <SectionIntro
                  title={t("setupEligibilityTitle")}
                  description={t("setupEligibilityHelpCustom")}
                />

                <div className="eligibility-match-row" role="group" aria-label={t("eligibilityMatchLabel")}>
                  <span className="eligibility-match-row__prefix">{t("eligibilityMatchPrefix")}</span>
                  <button
                    type="button"
                    className={cn(
                      "eligibility-match-row__option",
                      form.eligibilityMatchMode === "all" && "eligibility-match-row__option--active"
                    )}
                    aria-pressed={form.eligibilityMatchMode === "all"}
                    onClick={() => setField("eligibilityMatchMode", "all")}
                  >
                    {t("eligibilityMatchAll")}
                  </button>
                  <span className="eligibility-match-row__sep">{t("eligibilityMatchOr")}</span>
                  <button
                    type="button"
                    className={cn(
                      "eligibility-match-row__option",
                      form.eligibilityMatchMode === "any" && "eligibility-match-row__option--active"
                    )}
                    aria-pressed={form.eligibilityMatchMode === "any"}
                    onClick={() => setField("eligibilityMatchMode", "any")}
                  >
                    {t("eligibilityMatchAny")}
                  </button>
                  <span className="eligibility-match-row__suffix">{t("eligibilityMatchSuffix")}</span>
                </div>

                <ToggleList aria-label={t("conditionsLabel")}>
                  <ToggleListItem
                    variant="expandable"
                    icon="family_restroom"
                    iconTone="info"
                    title={t("criterionSiblingTitle")}
                    description={t("criterionSiblingDesc")}
                    checked={form.requireSiblingMatch}
                    onCheckedChange={(checked) => setField("requireSiblingMatch", checked)}
                  >
                    <div className="pds-toggle-list__expandable-fields">
                      <InputWrapper label={t("minEnrolledSiblings")}>
                        <TextInput
                          inputMode="numeric"
                          value={form.minEnrolledSiblings}
                          onChange={(event) => setField("minEnrolledSiblings", event.target.value)}
                        />
                      </InputWrapper>
                      <InputWrapper label={t("siblingOrdinal")}>
                        <TextInput
                          inputMode="numeric"
                          value={form.siblingOrdinal}
                          onChange={(event) => setField("siblingOrdinal", event.target.value)}
                          placeholder={t("siblingOrdinalPlaceholder")}
                        />
                      </InputWrapper>
                    </div>
                  </ToggleListItem>

                  <ToggleListItem
                    variant="expandable"
                    icon="history"
                    iconTone="success"
                    title={t("criterionEnrollmentYearsTitle", { years: form.minEnrollmentYears })}
                    description={t("criterionEnrollmentYearsDesc")}
                    checked={form.requireMinEnrollmentYears}
                    onCheckedChange={(checked) => setField("requireMinEnrollmentYears", checked)}
                  >
                    <InputWrapper label={t("enrollmentYearsLabel")}>
                      <TextInput
                        inputMode="numeric"
                        min={1}
                        value={form.minEnrollmentYears}
                        onChange={(event) => setField("minEnrollmentYears", event.target.value)}
                        suffix={t("enrollmentYearsSuffix")}
                      />
                    </InputWrapper>
                  </ToggleListItem>

                  <ToggleListItem
                    variant="expandable"
                    icon="badge"
                    iconTone="warning"
                    title={t("criterionStaffParentTitle")}
                    description={t("criterionStaffParentDesc")}
                    checked={form.requireParentFullTimeStaff}
                    onCheckedChange={(checked) => setField("requireParentFullTimeStaff", checked)}
                  />

                  <ToggleListItem
                    variant="expandable"
                    icon="emoji_events"
                    iconTone="warning"
                    title={t("criterionTopRankTitle", { rank: form.topRankInGrade })}
                    description={t("criterionTopRankDesc")}
                    checked={form.requireTopRankInGrade}
                    onCheckedChange={(checked) => setField("requireTopRankInGrade", checked)}
                  >
                    <InputWrapper label={t("rankingLabel")}>
                      <TextInput
                        inputMode="numeric"
                        min={1}
                        value={form.topRankInGrade}
                        onChange={(event) => setField("topRankInGrade", event.target.value)}
                      />
                    </InputWrapper>
                  </ToggleListItem>

                  <ToggleListItem
                    variant="expandable"
                    icon="person_add"
                    iconTone="info"
                    title={t("criterionNewEnrollmentTitle")}
                    description={t("criterionNewEnrollmentDesc")}
                    checked={form.requireNewEnrollmentThisYear}
                    onCheckedChange={(checked) => setField("requireNewEnrollmentThisYear", checked)}
                  />
                </ToggleList>
              </section>
            ) : null}

            {currentStep === "rules" ? (
              <section className="discount-setup-section">
                <SectionIntro title={t("setupRulesApplicationTitle")} description={t("setupRulesHelp")} />

                <SelectionCardGrid className="application-mode-grid">
                  <SelectionCard
                    variant="stack"
                    selected={form.triggerMode === "auto"}
                    icon={<Icon name="bolt" size={20} />}
                    title={t("applicationAutomaticTitle")}
                    description={t("applicationAutomaticDesc")}
                    onClick={() => setField("triggerMode", "auto")}
                  />
                  <SelectionCard
                    variant="stack"
                    selected={form.triggerMode === "manual"}
                    icon={<Icon name="touch_app" size={20} />}
                    title={t("applicationManualTitle")}
                    description={t("applicationManualDesc")}
                    onClick={() => setField("triggerMode", "manual")}
                  />
                  <SelectionCard
                    variant="stack"
                    selected={form.triggerMode === "request"}
                    icon={<Icon name="description" size={20} />}
                    title={t("applicationRequestTitle")}
                    description={t("applicationRequestDesc")}
                    onClick={() => setField("triggerMode", "request")}
                  />
                </SelectionCardGrid>

                <ToggleList aria-label={t("setupRulesTitle")}>
                  <ToggleListItem
                    variant="expandable"
                    icon="verified_user"
                    iconTone="info"
                    title={t("requiresPaymentAtEnrollment")}
                    description={t("requiresPaymentAtEnrollmentHelp")}
                    checked={form.requiresPaymentAtEnrollment}
                    onCheckedChange={(checked) => setField("requiresPaymentAtEnrollment", checked)}
                  />
                  <ToggleListItem
                    variant="expandable"
                    icon="layers"
                    iconTone="success"
                    title={t("stackableLabel")}
                    description={t("stackableHelp")}
                    checked={form.stackable}
                    onCheckedChange={(checked) => setField("stackable", checked)}
                  />
                  <ToggleListItem
                    variant="expandable"
                    icon="account_balance_wallet"
                    iconTone="warning"
                    title={t("prorateLabel")}
                    description={t("prorateHelp")}
                    checked={form.prorateAcrossInstallments}
                    onCheckedChange={(checked) => setField("prorateAcrossInstallments", checked)}
                  />
                </ToggleList>

                <div className="discount-rules-config-grid">
                  <div className="discount-rules-config-card">
                    <p className="pds-type-body-s-bold">{t("maxCombinedLabel")}</p>
                    <p className="pds-type-body-s-regular muted">{t("maxCombinedHelp")}</p>
                    <TextInput
                      type="number"
                      min={0}
                      max={100}
                      value={form.maxCombinedPercent ?? ""}
                      onChange={(event) => setField("maxCombinedPercent", event.target.value)}
                      suffix={t("maxCombinedSuffix")}
                    />
                  </div>
                  <div className="discount-rules-config-card">
                    <p className="pds-type-body-s-bold">{t("priorityOrderLabel")}</p>
                    <p className="pds-type-body-s-regular muted">{t("priorityOrderHelp")}</p>
                    <div className="priority-order-row">
                      {[1, 2, 3, 4].map((order) => (
                        <button
                          key={order}
                          type="button"
                          className={cn(
                            "priority-order-pill",
                            Number(form.priorityOrder) === order && "priority-order-pill--selected"
                          )}
                          onClick={() => setField("priorityOrder", String(order))}
                        >
                          {order}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {currentStep === "review" ? (
              <section className="discount-setup-section">
                <SectionIntro title={t("setupReviewTitle")} description={t("setupReviewHelp")} />

                <dl className="pds-type-body-s-regular discount-review-list">
                  <div>
                    <dt>{t("ruleName")}</dt>
                    <dd>{form.name}</dd>
                  </div>
                  <div>
                    <dt>{t("valueType")}</dt>
                    <dd>
                      {form.valueType === "fixed" ? t("calcMethodFixedTitle") : t("calcMethodPercentageTitle")}
                    </dd>
                  </div>
                  <div>
                    <dt>{form.valueType === "percentage" ? t("discountPercentage") : t("fixedAmountLabel")}</dt>
                    <dd>
                      {form.valueType === "percentage"
                        ? `${form.value}%`
                        : `${Number(form.value || 0).toLocaleString()} MMK`}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("applicationModeLabel")}</dt>
                    <dd>
                      {form.triggerMode === "auto"
                        ? t("applicationAutomaticTitle")
                        : form.triggerMode === "manual"
                          ? t("applicationManualTitle")
                          : t("applicationRequestTitle")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("stackableLabel")}</dt>
                    <dd>{form.stackable ? t("stackableHelp") : t("bestWinsHelp")}</dd>
                  </div>
                  <div>
                    <dt>{t("feeComponentsLabel")}</dt>
                    <dd>
                      {form.feeItemIds
                        .map((id) => scopeFeeItems.find((item) => item.id === id)?.name ?? id)
                        .join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("gradeLevelsLabel")}</dt>
                    <dd>
                      {form.gradeScope === "all"
                        ? t("gradeScopeAllSummary")
                        : form.gradeIds
                            .map((id) => gradeList.find((grade) => grade.id === id)?.name ?? id)
                            .join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("paymentPlansLabel")}</dt>
                    <dd>
                      {form.paymentPlanFrequencies
                        .map((frequency) => t(PAYMENT_PLAN_LABEL_KEYS[frequency]))
                        .join(" · ")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("conditionsLabel")}</dt>
                    <dd>
                      {[
                        form.requireSiblingMatch && t("criterionSiblingTitle"),
                        form.requireMinEnrollmentYears &&
                          t("criterionEnrollmentYearsTitle", { years: form.minEnrollmentYears }),
                        form.requireParentFullTimeStaff && t("criterionStaffParentTitle"),
                        form.requireTopRankInGrade &&
                          t("criterionTopRankTitle", { rank: form.topRankInGrade }),
                        form.requireNewEnrollmentThisYear && t("criterionNewEnrollmentTitle")
                      ]
                        .filter(Boolean)
                        .join(" · ") || t("noEligibilityCriteria")}
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </>
        )}
      </RecordFormModal>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("deleteDiscountTitle")}
        description={t("deleteDiscountHelp", { name: editingRule?.name ?? "" })}
        confirmLabel={c("delete")}
        destructive
        loading={deactivateRule.isPending}
        onConfirm={async () => {
          if (!editingRule) return;
          await deactivateRule.mutateAsync({ id: editingRule.id });
          setDeleteOpen(false);
          closeModal();
          onSaved?.();
        }}
      />
    </>
  );
}

/** @deprecated Use {@link DiscountSetupModal}. */
export const DiscountSetupWorkspace = DiscountSetupModal;
