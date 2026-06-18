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
  triggerMode: "auto" | "request";
  stackable: boolean;
  billingContexts: string[];
  feeItemIds: string[];
  gradeScope: "all" | "specific";
  gradeIds: string[];
  academicYearIds: string[];
  paymentPlanFrequencies: DiscountPaymentPlanFrequency[];
  requireSiblingMatch: boolean;
  minEnrolledSiblings: string;
  siblingOrdinal: string;
  requiresPaymentAtEnrollment: boolean;
  requiresDocumentation: boolean;
  notes: string;
  /** Preserved when editing an existing non-custom rule. */
  recordDiscountType?: string;
};

export function emptyDiscountForm(): DiscountRuleFormValues {
  return {
    name: "",
    valueType: "percentage",
    value: "10",
    triggerMode: "request",
    stackable: false,
    billingContexts: ["enrollment", "recurring"],
    feeItemIds: [],
    gradeScope: "all",
    gradeIds: [],
    academicYearIds: [],
    paymentPlanFrequencies: [...discountPaymentPlanFrequencies],
    requireSiblingMatch: false,
    minEnrolledSiblings: "1",
    siblingOrdinal: "",
    requiresPaymentAtEnrollment: false,
    requiresDocumentation: false,
    notes: ""
  };
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

export function ruleToForm(rule: DiscountRuleRecord): DiscountRuleFormValues {
  const criteria = rule.criteria as DiscountRuleCriteria & Record<string, unknown>;
  const appliesTo = readAppliesTo(criteria);
  const discountType = rule.discountType === "staff" ? "staff_child" : rule.discountType;
  const isLegacy = discountType !== "custom";

  return {
    name: rule.name,
    valueType: rule.valueType === "fixed" ? "fixed" : "percentage",
    value: String(Math.round(Number(rule.value))),
    triggerMode: rule.triggerMode === "auto" ? "auto" : "request",
    stackable: rule.stackable,
    billingContexts: [...appliesTo.billingContexts],
    feeItemIds: [...(appliesTo.feeItemIds ?? [])],
    gradeScope: appliesTo.gradeIds?.length ? "specific" : "all",
    gradeIds: [...(appliesTo.gradeIds ?? [])],
    academicYearIds: [...(appliesTo.academicYearIds ?? [])],
    paymentPlanFrequencies: readPaymentPlanFrequencies(criteria),
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
    notes:
      typeof criteria.notes === "string"
        ? criteria.notes
        : typeof criteria.description === "string"
          ? criteria.description
          : "",
    recordDiscountType: isLegacy ? discountType : undefined
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

  if (discountType === "sibling") {
    return {
      name: form.name.trim(),
      discountType: "sibling",
      valueType: form.valueType,
      value: Number(form.value),
      triggerMode: form.triggerMode,
      stackable: form.stackable,
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
    criteria: {
      type: "custom" as const,
      appliesTo,
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
      requiresPaymentAtEnrollment: form.requiresPaymentAtEnrollment || undefined,
      requiresDocumentation: form.requiresDocumentation || undefined,
      notes: form.notes.trim() || undefined
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
  return rule.triggerMode === "auto" ? t("tagAuto") : t("tagRequest");
}
