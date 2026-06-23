import {
  discountPaymentPlanFrequencies,
  type DiscountAppliesTo,
  type DiscountPaymentPlanFrequency,
  type DiscountRuleCriteria
} from "@sms/shared";

export type DiscountRuleRecord = {
  id: string;
  name: string;
  discountType: string;
  valueType: string;
  value: string;
  approvalThreshold: string | null;
  triggerMode: string;
  stackable: boolean;
  sortOrder?: number;
  status: string;
  criteria: DiscountRuleCriteria | Record<string, unknown>;
  tags?: string[];
};

export type DiscountRuleFormValues = {
  name: string;
  valueType: "percentage" | "fixed";
  value: string;
  triggerMode: "auto" | "manual" | "request";
  stackable: boolean;
  billingContexts: string[];
  feeItemIds: string[];
  gradeScope: "all" | "specific";
  gradeIds: string[];
  academicYearIds: string[];
  paymentPlanFrequencies: DiscountPaymentPlanFrequency[];
  eligibilityMatchMode: "all" | "any";
  requireSiblingMatch: boolean;
  minEnrolledSiblings: string;
  siblingOrdinal: string;
  requireMinEnrollmentYears: boolean;
  minEnrollmentYears: string;
  requireParentFullTimeStaff: boolean;
  requireTopRankInGrade: boolean;
  topRankInGrade: string;
  requireNewEnrollmentThisYear: boolean;
  requiresPaymentAtEnrollment: boolean;
  requiresDocumentation: boolean;
  prorateAcrossInstallments: boolean;
  priorityOrder: string;
  maxCombinedPercent: string;
  notes: string;
  /** Preserved when editing an existing non-custom rule. */
  recordDiscountType?: string;
};

export function emptyDiscountForm(): DiscountRuleFormValues {
  return {
    name: "",
    valueType: "percentage",
    value: "10",
    triggerMode: "auto",
    stackable: true,
    billingContexts: ["enrollment", "recurring"],
    feeItemIds: [],
    gradeScope: "all",
    gradeIds: [],
    academicYearIds: [],
    paymentPlanFrequencies: [...discountPaymentPlanFrequencies],
    eligibilityMatchMode: "all",
    requireSiblingMatch: false,
    minEnrolledSiblings: "1",
    siblingOrdinal: "",
    requireMinEnrollmentYears: false,
    minEnrollmentYears: "2",
    requireParentFullTimeStaff: false,
    requireTopRankInGrade: false,
    topRankInGrade: "3",
    requireNewEnrollmentThisYear: false,
    requiresPaymentAtEnrollment: false,
    requiresDocumentation: false,
    prorateAcrossInstallments: false,
    priorityOrder: "1",
    maxCombinedPercent: "60",
    notes: ""
  };
}

/** Fill missing fields so controlled inputs never receive undefined. */
export function mergeDiscountForm(
  patch: Partial<DiscountRuleFormValues>
): DiscountRuleFormValues {
  return { ...emptyDiscountForm(), ...patch };
}

function readAppliesTo(raw: DiscountRuleCriteria | Record<string, unknown>): DiscountAppliesTo {
  const record = raw as Record<string, unknown>;
  const nested = record.appliesTo as DiscountAppliesTo | undefined;
  if (nested) {
    return nested;
  }
  return {
    billingContexts: (Array.isArray(record.billingContexts)
      ? record.billingContexts
      : ["enrollment", "recurring"]) as DiscountAppliesTo["billingContexts"],
    feeTypes: Array.isArray(record.appliesToFeeTypes)
      ? (record.appliesToFeeTypes as string[])
      : [],
    feeItemIds: Array.isArray(record.feeItemIds) ? (record.feeItemIds as string[]) : undefined,
    gradeIds: Array.isArray(record.gradeIds) ? (record.gradeIds as string[]) : undefined,
    academicYearIds: Array.isArray(record.academicYearIds)
      ? (record.academicYearIds as string[])
      : undefined
  };
}

function readPaymentPlanFrequencies(
  raw: DiscountRuleCriteria | Record<string, unknown>
): DiscountPaymentPlanFrequency[] {
  const frequencies = (raw as { paymentPlanFrequencies?: string[] }).paymentPlanFrequencies;
  if (!Array.isArray(frequencies) || !frequencies.length) {
    return [...discountPaymentPlanFrequencies];
  }
  return frequencies.filter((value): value is DiscountPaymentPlanFrequency =>
    discountPaymentPlanFrequencies.includes(value as DiscountPaymentPlanFrequency)
  );
}

function readCustomCriteria(raw: DiscountRuleCriteria & Record<string, unknown>) {
  return {
    eligibilityMatchMode:
      raw.eligibilityMatchMode === "any" || raw.eligibilityMatchMode === "all"
        ? raw.eligibilityMatchMode
        : "all",
    minEnrollmentYears:
      typeof raw.minEnrollmentYears === "number" ? String(raw.minEnrollmentYears) : "2",
    parentIsFullTimeStaff: raw.parentIsFullTimeStaff === true,
    topRankInGrade: typeof raw.topRankInGrade === "number" ? String(raw.topRankInGrade) : "3",
    newEnrollmentThisYear: raw.newEnrollmentThisYear === true,
    prorateAcrossInstallments: raw.prorateAcrossInstallments === true,
    priorityOrder: typeof raw.priorityOrder === "number" ? String(raw.priorityOrder) : "1"
  };
}

export function ruleToForm(rule: DiscountRuleRecord): DiscountRuleFormValues {
  const criteria = rule.criteria as DiscountRuleCriteria & Record<string, unknown>;
  const appliesTo = readAppliesTo(criteria);
  const discountType = rule.discountType === "staff" ? "staff_child" : rule.discountType;
  const isLegacy = discountType !== "custom";
  const customFields = criteria.type === "custom" ? readCustomCriteria(criteria) : null;

  const triggerMode =
    rule.triggerMode === "auto"
      ? "auto"
      : rule.triggerMode === "manual"
        ? "manual"
        : "request";

  return mergeDiscountForm({
    name: rule.name,
    valueType: rule.valueType === "fixed" ? "fixed" : "percentage",
    value: String(Math.round(Number(rule.value))),
    triggerMode,
    stackable: rule.stackable,
    billingContexts: [...appliesTo.billingContexts],
    feeItemIds: [...(appliesTo.feeItemIds ?? [])],
    gradeScope: appliesTo.gradeIds?.length ? "specific" : "all",
    gradeIds: [...(appliesTo.gradeIds ?? [])],
    academicYearIds: [...(appliesTo.academicYearIds ?? [])],
    paymentPlanFrequencies: readPaymentPlanFrequencies(criteria),
    eligibilityMatchMode: (customFields?.eligibilityMatchMode ?? "all") as "all" | "any",
    requireSiblingMatch:
      criteria.type === "sibling" ||
      (criteria.type === "custom" &&
        (criteria.minEnrolledSiblings != null || criteria.siblingOrdinal != null)),
    minEnrolledSiblings:
      criteria.type === "sibling" && criteria.minEnrolledSiblings != null
        ? String(criteria.minEnrolledSiblings)
        : criteria.type === "custom" && criteria.minEnrolledSiblings != null
          ? String(criteria.minEnrolledSiblings)
          : "1",
    siblingOrdinal:
      criteria.type === "sibling" && criteria.siblingOrdinal != null
        ? String(criteria.siblingOrdinal)
        : criteria.type === "custom" && criteria.siblingOrdinal != null
          ? String(criteria.siblingOrdinal)
          : "",
    requireMinEnrollmentYears:
      criteria.type === "custom" && criteria.minEnrollmentYears != null,
    minEnrollmentYears: customFields?.minEnrollmentYears ?? "2",
    requireParentFullTimeStaff: customFields?.parentIsFullTimeStaff ?? false,
    requireTopRankInGrade:
      criteria.type === "custom" && criteria.topRankInGrade != null,
    topRankInGrade: customFields?.topRankInGrade ?? "3",
    requireNewEnrollmentThisYear: customFields?.newEnrollmentThisYear ?? false,
    requiresPaymentAtEnrollment:
      criteria.type === "early_payment"
        ? criteria.requiresPaymentAtEnrollment !== false
        : criteria.type === "custom"
          ? criteria.requiresPaymentAtEnrollment === true
          : false,
    requiresDocumentation:
      criteria.type === "scholarship" ||
      criteria.type === "staff_child" ||
      (criteria.type === "custom" && criteria.requiresDocumentation === true),
    prorateAcrossInstallments: customFields?.prorateAcrossInstallments ?? false,
    priorityOrder: customFields?.priorityOrder ?? String(rule.sortOrder ?? 1),
    maxCombinedPercent: "60",
    notes:
      typeof criteria.notes === "string"
        ? criteria.notes
        : typeof criteria.description === "string"
          ? criteria.description
          : "",
    recordDiscountType: isLegacy ? discountType : undefined
  });
}

function buildCustomCriteriaFields(form: DiscountRuleFormValues) {
  const hasEligibility =
    form.requireSiblingMatch ||
    form.requireMinEnrollmentYears ||
    form.requireParentFullTimeStaff ||
    form.requireTopRankInGrade ||
    form.requireNewEnrollmentThisYear ||
    form.requiresPaymentAtEnrollment;

  return {
    eligibilityMatchMode: hasEligibility ? form.eligibilityMatchMode : undefined,
    paymentPlanFrequencies: form.paymentPlanFrequencies.length
      ? form.paymentPlanFrequencies
      : undefined,
    minEnrolledSiblings: form.requireSiblingMatch
      ? Number(form.minEnrolledSiblings || "1")
      : undefined,
    siblingOrdinal:
      form.requireSiblingMatch && form.siblingOrdinal
        ? Number(form.siblingOrdinal)
        : undefined,
    minEnrollmentYears: form.requireMinEnrollmentYears
      ? Number(form.minEnrollmentYears || "1")
      : undefined,
    parentIsFullTimeStaff: form.requireParentFullTimeStaff || undefined,
    topRankInGrade: form.requireTopRankInGrade
      ? Number(form.topRankInGrade || "1")
      : undefined,
    newEnrollmentThisYear: form.requireNewEnrollmentThisYear || undefined,
    requiresPaymentAtEnrollment: form.requiresPaymentAtEnrollment || undefined,
    requiresDocumentation: form.requiresDocumentation || undefined,
    prorateAcrossInstallments: form.prorateAcrossInstallments || undefined,
    priorityOrder: Number(form.priorityOrder || "1"),
    notes: form.notes.trim() || undefined
  };
}

export function formToPayload(
  form: DiscountRuleFormValues,
  feeTypesByItemId: Record<string, string>
) {
  const feeTypes = [
    ...new Set(
      form.feeItemIds.map((id) => feeTypesByItemId[id]).filter((feeType): feeType is string => Boolean(feeType))
    )
  ];

  const appliesTo: DiscountAppliesTo = {
    billingContexts: form.billingContexts as DiscountAppliesTo["billingContexts"],
    feeTypes,
    feeItemIds: form.feeItemIds.length ? form.feeItemIds : undefined,
    gradeIds: form.gradeScope === "specific" && form.gradeIds.length ? form.gradeIds : undefined,
    academicYearIds: form.academicYearIds.length ? form.academicYearIds : undefined
  };

  const discountType = form.recordDiscountType ?? "custom";
  const sortOrder = Number(form.priorityOrder || "1");

  if (discountType === "sibling") {
    return {
      name: form.name.trim(),
      discountType: "sibling",
      valueType: form.valueType,
      value: Number(form.value),
      triggerMode: form.triggerMode,
      stackable: form.stackable,
      sortOrder,
      criteria: {
        type: "sibling" as const,
        appliesTo,
        minEnrolledSiblings: Number(form.minEnrolledSiblings || "1"),
        siblingOrdinal: form.siblingOrdinal ? Number(form.siblingOrdinal) : undefined,
        notes: form.notes.trim() || undefined
      }
    };
  }

  if (discountType === "early_payment") {
    return {
      name: form.name.trim(),
      discountType: "early_payment",
      valueType: form.valueType,
      value: Number(form.value),
      triggerMode: form.triggerMode,
      stackable: form.stackable,
      sortOrder,
      criteria: {
        type: "early_payment" as const,
        appliesTo,
        requiresPaymentAtEnrollment: form.requiresPaymentAtEnrollment,
        notes: form.notes.trim() || undefined
      }
    };
  }

  if (discountType === "staff_child" || discountType === "staff") {
    return {
      name: form.name.trim(),
      discountType: "staff",
      valueType: form.valueType,
      value: Number(form.value),
      triggerMode: form.triggerMode,
      stackable: form.stackable,
      sortOrder,
      criteria: {
        type: "staff_child" as const,
        appliesTo,
        requiresDocumentation: form.requiresDocumentation,
        notes: form.notes.trim() || undefined
      }
    };
  }

  if (discountType === "scholarship") {
    return {
      name: form.name.trim(),
      discountType: "scholarship",
      valueType: form.valueType,
      value: Number(form.value),
      triggerMode: form.triggerMode,
      stackable: form.stackable,
      sortOrder,
      criteria: {
        type: "scholarship" as const,
        appliesTo,
        requiresDocumentation: form.requiresDocumentation,
        notes: form.notes.trim() || undefined
      }
    };
  }

  return {
    name: form.name.trim(),
    discountType: "custom" as const,
    valueType: form.valueType,
    value: Number(form.value),
    triggerMode: form.triggerMode,
    stackable: form.stackable,
    sortOrder,
    criteria: {
      type: "custom" as const,
      appliesTo,
      ...buildCustomCriteriaFields(form)
    }
  };
}

export function ruleSummaryText(rule: DiscountRuleRecord, t: (key: string) => string): string {
  const criteria = rule.criteria as DiscountRuleCriteria & { notes?: string; description?: string };
  if (criteria.notes) return criteria.notes;
  if (typeof (criteria as { description?: string }).description === "string") {
    return (criteria as { description: string }).description;
  }
  if (rule.discountType === "custom") return t("descCustom");
  if (rule.discountType === "sibling") return t("descSibling");
  if (rule.discountType === "scholarship") return t("descMerit");
  if (rule.discountType === "staff" || rule.discountType === "staff_child") return t("descStaff");
  if (rule.discountType === "early_payment") return t("descEarlyPayment");
  return t("descGeneric");
}

export function ruleTagText(rule: DiscountRuleRecord, t: (key: string) => string): string {
  if (rule.tags?.length) {
    return rule.tags.join(" · ");
  }
  if (rule.triggerMode === "auto") return t("tagAuto");
  if (rule.triggerMode === "manual") return t("tagManual");
  return t("tagRequest");
}
