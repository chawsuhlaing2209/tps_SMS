"use client";

import { discountPaymentPlanFrequencies } from "@sms/shared";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { FormField, FormInput, FormTextarea, PercentInput } from "../../../../components/shared/form-input";
import { CheckboxList } from "../../../../components/pds";
import { SegmentedControl } from "../../../../components/pds/composites/segmented-control";
import { SelectionCard, SelectionCardGrid } from "../../../../components/shared/selection-card";
import { Stepper } from "../../../../components/shared/stepper";
import { Toggle } from "../../../../components/shared/toggle";
import { EmptyState } from "../../../../components/shared/empty-state";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Icon } from "../../../lib/material-icon";
import { hasAnyPermission } from "../../../lib/permissions";
import { getSession } from "../../../lib/session";
import { PageHeader } from "../../page-header-context";
import {
  emptyDiscountForm,
  formToPayload,
  ruleToForm,
  type DiscountRuleFormValues,
  type DiscountRuleRecord
} from "./discount-form";
import {
  buildSampleFeeLines,
  sampleAmountForFeeType,
  type DiscountPreviewSample
} from "./discount-preview";
import { DiscountLivePreview } from "./discount-live-preview";

const DISCOUNT_SETUP_STEPS = ["type", "scope", "eligibility", "rules", "review"] as const;
type DiscountSetupStep = (typeof DISCOUNT_SETUP_STEPS)[number];

const RULES_PATH = (tenant: string) => `/tenants/${tenant}/discounts/rules`;

const PAYMENT_PLAN_LABEL_KEYS = {
  annual: "paymentPlanAnnual",
  term: "paymentPlanTerm",
  monthly: "paymentPlanMonthly"
} as const;

type FeeItemOption = { id: string; name: string; feeType: string; status: string };
type GradeOption = { id: string; name: string };
type YearOption = { id: string; name: string; isActive?: boolean };

type Props = {
  mode: "create" | "edit";
  ruleId?: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function DiscountSetupWorkspace({ mode, ruleId }: Props) {
  const router = useRouter();
  const t = useTranslations("discounts");
  const finance = useTranslations("finance");
  const nav = useTranslations("nav");
  const c = useTranslations("common");
  const permissions = getSession()?.permissions;
  const canManage = hasAnyPermission(permissions, ["discount.approve"]);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DiscountRuleFormValues>(emptyDiscountForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof DiscountRuleFormValues, string>>>({});

  const rules = useApiQuery<DiscountRuleRecord[]>(canManage ? RULES_PATH : () => null);
  const feeItems = useApiQuery<FeeItemOption[]>((tenant) => `/tenants/${tenant}/finance/fee-items`);
  const grades = useApiQuery<GradeOption[]>((tenant) => `/tenants/${tenant}/academics/grades`);
  const years = useApiQuery<YearOption[]>((tenant) => `/tenants/${tenant}/academics/academic-years`);

  const editingRule = useMemo(
    () => (mode === "edit" && ruleId ? rules.data?.find((rule) => rule.id === ruleId) : null),
    [mode, ruleId, rules.data]
  );

  useEffect(() => {
    if (mode === "edit" && editingRule) {
      setForm(ruleToForm(editingRule));
    }
  }, [mode, editingRule]);

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

  const previewSample = useMemo<DiscountPreviewSample>(() => {
    const sampleGrade = grades.data?.[0]?.name ?? "Grade 9";
    return {
      studentName: t("previewSampleStudent"),
      gradeName: sampleGrade,
      invoiceLabel: t("previewSampleInvoice"),
      feeLines: buildSampleFeeLines(
        scopeFeeItems.map((item) => ({
          id: item.id,
          name: item.name,
          feeType: item.feeType
        }))
      ),
      siblingSummary: {
        eligible: true,
        enrolledSiblingCount: 1,
        studentPosition: Number(form.siblingOrdinal || "2")
      }
    };
  }, [form.siblingOrdinal, grades.data, scopeFeeItems, t]);

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

  function setFeeItemIds(feeItemIds: string[]) {
    setForm((current) => ({ ...current, feeItemIds }));
    if (formErrors.feeItemIds) {
      setFormErrors((current) => ({ ...current, feeItemIds: undefined }));
    }
  }

  function togglePaymentPlan(frequency: (typeof discountPaymentPlanFrequencies)[number]) {
    setForm((current) => {
      const selected = current.paymentPlanFrequencies.includes(frequency);
      return {
        ...current,
        paymentPlanFrequencies: selected
          ? current.paymentPlanFrequencies.filter((value) => value !== frequency)
          : [...current.paymentPlanFrequencies, frequency]
      };
    });
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
    if (!validateStep(step)) {
      return;
    }
    if (step < DISCOUNT_SETUP_STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    void saveRule();
  }

  function goBack() {
    if (step > 0) {
      setStep((current) => current - 1);
      return;
    }
    router.push("/dashboard/finance/discounts");
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

    router.push("/dashboard/finance/discounts");
  }

  if (!canManage) {
    return <EmptyState icon="lock" title={t("noAccess")} />;
  }

  if (mode === "edit" && rules.isLoading) {
    return <p className="pds-type-body-s-regular muted">{c("loading")}</p>;
  }

  if (mode === "edit" && !editingRule && !rules.isLoading) {
    return (
      <div className="page-stack">
        <p className="pds-type-body-m-medium error-text">{t("ruleNotFound")}</p>
      </div>
    );
  }

  const pageTitle = mode === "edit" ? form.name || t("editRuleTitle") : t("configureDiscount");
  const saving = createRule.isPending || updateRule.isPending;
  const gradeList = grades.data ?? [];

  return (
    <div className="discount-setup-page">
      <PageHeader
        title={pageTitle}
        segment={{
          label: pageTitle,
          href:
            mode === "edit" && ruleId
              ? `/dashboard/finance/discounts/${ruleId}`
              : "/dashboard/finance/discounts/new"
        }}
        breadcrumbs={[
          { label: nav("finance"), href: "/dashboard/finance/discounts" },
          { label: t("pageTitle"), href: "/dashboard/finance/discounts" },
          { label: pageTitle }
        ]}
      />

      <div className="discount-setup-shell">
        <div className="discount-setup-workspace">
          <Stepper
            className="stepper--plain"
            steps={setupSteps}
            currentStep={step}
            ariaLabel={t("setupProgress")}
            onStepClick={(index) => {
              if (index <= step) {
                setStep(index);
              }
            }}
          />

          <div className="discount-setup-main">
            {currentStep === "type" ? (
              <section className="discount-setup-section">
                <div className="discount-setup-section-header">
                  <h2 className="pds-type-title-xs-bold">{t("setupTypeTitle")}</h2>
                  <p className="pds-type-body-s-regular discount-setup-section__intro muted">
                    {t("setupTypeHelpCustom")}
                  </p>
                </div>
               

                <FormField label={t("ruleName")} required labelStyle="caps" error={formErrors.name}>
                  <FormInput
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder={t("ruleNamePlaceholder")}
                  />
                </FormField>

                <FormField label={t("calculationMethodLabel")} labelStyle="caps">
                  <SelectionCardGrid>
                    <SelectionCard
                      selected={form.valueType === "percentage"}
                      icon={<Icon name="percent" />}
                      title={t("calcMethodPercentageTitle")}
                      description={t("calcMethodPercentageDesc")}
                      onClick={() => selectValueType("percentage")}
                    />
                    <SelectionCard
                      selected={form.valueType === "fixed"}
                      icon={<Icon name="payments" />}
                      title={t("calcMethodFixedTitle")}
                      description={t("calcMethodFixedDesc")}
                      onClick={() => selectValueType("fixed")}
                    />
                  </SelectionCardGrid>
                </FormField>

                <FormField
                  label={form.valueType === "percentage" ? t("discountPercentage") : t("fixedAmountLabel")}
                  required
                  labelStyle="caps"
                  error={formErrors.value}
                >
                  {form.valueType === "percentage" ? (
                    <div className="discount-rule-sheet__percent-row">
                      <PercentInput
                        value={form.value}
                        onChange={(event) => setField("value", event.target.value)}
                        aria-label={t("discountPercentage")}
                      />
                      <span className="pds-type-body-s-regular muted">{t("percentOffEligible")}</span>
                    </div>
                  ) : (
                    <div className="amount-input">
                      <FormInput
                        type="number"
                        min={1}
                        step={1000}
                        value={form.value}
                        onChange={(event) => setField("value", event.target.value)}
                        aria-label={t("fixedAmountLabel")}
                        inputClassName="amount-input__field"
                      />
                      <span className="pds-type-body-m-medium amount-input__suffix">MMK</span>
                    </div>
                  )}
                </FormField>
              </section>
            ) : null}

            {currentStep === "scope" ? (
              <section className="discount-setup-section">
                <h2 className="pds-type-title-xs-bold">{t("setupScopeTitle")}</h2>
                <p className="pds-type-body-s-regular discount-setup-section__intro muted">
                  {t("setupScopeHelpCustom")}
                </p>

                <FormField
                  label={t("feeComponentsLabel")}
                  required
                  labelStyle="caps"
                  error={formErrors.feeItemIds}
                >
                  <CheckboxList
                    title={finance("feeComponents")}
                    options={scopeFeeItems.map((item) => ({
                      id: item.id,
                      label: item.name,
                      description: t(`feeComponentDescriptions.${item.feeType}`),
                      amount: sampleAmountForFeeType(item.feeType),
                    }))}
                    selectedIds={form.feeItemIds}
                    onChange={setFeeItemIds}
                    disabled={feeItems.isLoading}
                  />
                  <p className="pds-type-body-s-regular discount-setup-section__note muted">
                    {t("feeComponentsHelp")}
                  </p>
                </FormField>

                <FormField label={t("gradeLevelsLabel")} labelStyle="caps">
                  <SegmentedControl
                    ariaLabel={t("gradeLevelsLabel")}
                    value={form.gradeScope}
                    onChange={(next) => {
                      setField("gradeScope", next as "all" | "specific");
                      if (next === "all") {
                        setField("gradeIds", []);
                      }
                    }}
                    options={[
                      { id: "all", label: t("gradeScopeAll") },
                      { id: "specific", label: t("gradeScopeSpecific") }
                    ]}
                  />
                  {form.gradeScope === "all" ? (
                    <p className="scope-summary-callout muted">{t("gradeScopeAllSummary")}</p>
                  ) : (
                    <div className="discount-pill-grid">
                      {gradeList.map((grade) => {
                        const selected = form.gradeIds.includes(grade.id);
                        return (
                          <button
                            key={grade.id}
                            type="button"
                            className={`discount-pill${selected ? " discount-pill--selected" : ""}`}
                            onClick={() =>
                              setField(
                                "gradeIds",
                                selected
                                  ? form.gradeIds.filter((id) => id !== grade.id)
                                  : [...form.gradeIds, grade.id]
                              )
                            }
                          >
                            {selected ? <Icon name="check" size={16} /> : null}
                            {grade.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {formErrors.gradeIds ? (
                    <span className="pds-type-body-s-regular field-error">{formErrors.gradeIds}</span>
                  ) : null}
                </FormField>

                <FormField label={t("paymentPlansLabel")} labelStyle="caps">
                  <SelectionCardGrid>
                    {discountPaymentPlanFrequencies.map((frequency) => {
                      const selected = form.paymentPlanFrequencies.includes(frequency);
                      const iconName =
                        frequency === "annual"
                          ? "savings"
                          : frequency === "monthly"
                            ? "calendar_month"
                            : "date_range";
                      return (
                        <SelectionCard
                          key={frequency}
                          selected={selected}
                          icon={<Icon name={iconName} />}
                          title={t(PAYMENT_PLAN_LABEL_KEYS[frequency])}
                          description={t(`paymentPlanDesc_${frequency}`)}
                          onClick={() => togglePaymentPlan(frequency)}
                        />
                      );
                    })}
                  </SelectionCardGrid>
                </FormField>
              </section>
            ) : null}

            {currentStep === "eligibility" ? (
              <section className="discount-setup-section">
                <h2 className="pds-type-title-xs-bold">{t("setupEligibilityTitle")}</h2>
                <p className="pds-type-body-s-regular muted">{t("setupEligibilityHelpCustom")}</p>

                <FormField label={t("applicationModeLabel")} labelStyle="caps">
                  <SegmentedControl
                    ariaLabel={t("applicationModeLabel")}
                    value={form.triggerMode}
                    onChange={(next) => setField("triggerMode", next as "auto" | "request")}
                    options={[
                      { id: "auto", label: t("tagAuto") },
                      { id: "request", label: t("tagRequest") }
                    ]}
                  />
                  <p className="pds-type-body-s-regular muted">
                    {form.triggerMode === "auto" ? t("autoApplyHelp") : t("requestOnlyHelp")}
                  </p>
                </FormField>

                <FormField label={t("conditionsLabel")} labelStyle="caps">
                  <div className="form-stack">
                    <div className="form-inline-toggle">
                      <Toggle
                        checked={form.requireSiblingMatch}
                        onCheckedChange={(checked) => setField("requireSiblingMatch", checked)}
                        aria-label={t("requireSiblingMatch")}
                      />
                      <span className="pds-type-body-s-regular muted">{t("requireSiblingMatchHelp")}</span>
                    </div>
                    {form.requireSiblingMatch ? (
                      <div className="form-grid-2">
                        <FormField label={t("minEnrolledSiblings")} labelStyle="caps">
                          <FormInput
                            inputMode="numeric"
                            value={form.minEnrolledSiblings}
                            onChange={(event) => setField("minEnrolledSiblings", event.target.value)}
                          />
                        </FormField>
                        <FormField label={t("siblingOrdinal")} labelStyle="caps">
                          <FormInput
                            inputMode="numeric"
                            value={form.siblingOrdinal}
                            onChange={(event) => setField("siblingOrdinal", event.target.value)}
                            placeholder={t("siblingOrdinalPlaceholder")}
                          />
                        </FormField>
                      </div>
                    ) : null}

                    <div className="form-inline-toggle">
                      <Toggle
                        checked={form.requiresPaymentAtEnrollment}
                        onCheckedChange={(checked) => setField("requiresPaymentAtEnrollment", checked)}
                        aria-label={t("requiresPaymentAtEnrollment")}
                      />
                      <span className="pds-type-body-s-regular muted">{t("requiresPaymentAtEnrollmentHelp")}</span>
                    </div>

                    <div className="form-inline-toggle">
                      <Toggle
                        checked={form.requiresDocumentation}
                        onCheckedChange={(checked) => setField("requiresDocumentation", checked)}
                        aria-label={t("requiresDocumentation")}
                      />
                      <span className="pds-type-body-s-regular muted">{t("requiresDocumentationHelp")}</span>
                    </div>
                  </div>
                </FormField>

                <FormField label={t("notesLabel")} labelStyle="caps">
                  <FormTextarea
                    value={form.notes}
                    onChange={(event) => setField("notes", event.target.value)}
                    placeholder={t("notesPlaceholder")}
                    rows={3}
                  />
                </FormField>
              </section>
            ) : null}

            {currentStep === "rules" ? (
              <section className="discount-setup-section">
                <h2 className="pds-type-title-xs-bold">{t("setupRulesTitle")}</h2>
                <p className="pds-type-body-s-regular muted">{t("setupRulesHelp")}</p>

                <FormField label={t("stackableLabel")} labelStyle="caps">
                  <div className="form-inline-toggle">
                    <Toggle
                      checked={form.stackable}
                      onCheckedChange={(checked) => setField("stackable", checked)}
                      aria-label={t("stackableLabel")}
                    />
                    <span className="pds-type-body-s-regular muted">
                      {form.stackable ? t("stackableHelp") : t("bestWinsHelp")}
                    </span>
                  </div>
                </FormField>

                <p className="pds-type-body-s-regular muted">{t("stackCapNote")}</p>
              </section>
            ) : null}

            {currentStep === "review" ? (
              <section className="discount-setup-section">
                <h2 className="pds-type-title-xs-bold">{t("setupReviewTitle")}</h2>
                <p className="pds-type-body-s-regular muted">{t("setupReviewHelp")}</p>

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
                    <dd>{form.triggerMode === "auto" ? t("tagAuto") : t("tagRequest")}</dd>
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
                </dl>
              </section>
            ) : null}

            <footer className="discount-setup-footer">
              <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={goBack}>
                <Icon name="arrow_back" />
                {step === 0 ? c("cancel") : c("previous")}
              </button>
              <span className="pds-type-body-m-medium discount-setup-footer__meta">
                {t("setupStepMeta", {
                  current: step + 1,
                  total: DISCOUNT_SETUP_STEPS.length,
                  label: t(`setupStep_${currentStep}`)
                })}
              </span>
              <button type="button" className="pds-type-body-m-bold btn-primary" disabled={saving} onClick={() => void goNext()}>
                {step === DISCOUNT_SETUP_STEPS.length - 1 ? (
                  saving ? t("creating") : mode === "edit" ? c("save") : t("createDiscount")
                ) : (
                  <>
                    {c("next")}
                    <Icon name="arrow_forward" />
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>

        <DiscountLivePreview form={form} sample={previewSample} feeTypesByItemId={feeTypesByItemId} />
      </div>
    </div>
  );
}
