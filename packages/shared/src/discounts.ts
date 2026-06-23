import { z } from "zod";

export const discountBillingContexts = ["enrollment", "recurring"] as const;
export type DiscountBillingContext = (typeof discountBillingContexts)[number];

export const discountTriggerModes = ["auto", "manual", "request"] as const;
export type DiscountTriggerMode = (typeof discountTriggerModes)[number];

export const discountRuleTypes = [
  "sibling",
  "scholarship",
  "staff_child",
  "early_payment",
  "custom"
] as const;
export type DiscountRuleType = (typeof discountRuleTypes)[number];

/** Legacy API/seed alias */
export const LEGACY_STAFF_DISCOUNT_TYPE = "staff";

export function normalizeDiscountType(type: string): DiscountRuleType | string {
  if (type === LEGACY_STAFF_DISCOUNT_TYPE) return "staff_child";
  return type;
}

export function defaultTriggerMode(type: string): DiscountTriggerMode {
  const normalized = normalizeDiscountType(type);
  if (normalized === "custom") return "request";
  if (normalized === "sibling" || normalized === "early_payment") return "auto";
  return "request";
}

export function defaultStackable(type: string): boolean {
  const normalized = normalizeDiscountType(type);
  if (normalized === "custom") return false;
  if (normalized === "sibling" || normalized === "early_payment") return true;
  return false;
}

export const discountAppliesToSchema = z.object({
  billingContexts: z.array(z.enum(discountBillingContexts)).min(1),
  feeTypes: z.array(z.string().min(1)).default([]),
  feeItemIds: z.array(z.string().uuid()).optional(),
  gradeIds: z.array(z.string().uuid()).optional(),
  academicYearIds: z.array(z.string().uuid()).optional()
});

export type DiscountAppliesTo = z.infer<typeof discountAppliesToSchema>;

export const siblingRuleCriteriaSchema = z.object({
  type: z.literal("sibling"),
  appliesTo: discountAppliesToSchema,
  minEnrolledSiblings: z.number().int().min(0).default(1),
  siblingOrdinal: z.number().int().min(2).optional(),
  notes: z.string().optional()
});

/** @deprecated Use siblingRuleCriteriaSchema */
export const siblingDiscountCriteriaSchema = siblingRuleCriteriaSchema;

export const scholarshipRuleCriteriaSchema = z.object({
  type: z.literal("scholarship"),
  appliesTo: discountAppliesToSchema,
  requiresDocumentation: z.boolean().optional(),
  notes: z.string().optional()
});

export const staffChildRuleCriteriaSchema = z.object({
  type: z.literal("staff_child"),
  appliesTo: discountAppliesToSchema,
  requiresDocumentation: z.boolean().optional(),
  notes: z.string().optional()
});

export const discountPaymentPlanFrequencies = ["annual", "term", "monthly"] as const;
export type DiscountPaymentPlanFrequency = (typeof discountPaymentPlanFrequencies)[number];

export const earlyPaymentRuleCriteriaSchema = z.object({
  type: z.literal("early_payment"),
  appliesTo: discountAppliesToSchema,
  requiresPaymentAtEnrollment: z.boolean().default(true),
  paymentMethods: z.array(z.string()).optional(),
  notes: z.string().optional()
});

export const customRuleCriteriaSchema = z.object({
  type: z.literal("custom"),
  appliesTo: discountAppliesToSchema,
  paymentPlanFrequencies: z.array(z.enum(discountPaymentPlanFrequencies)).optional(),
  eligibilityMatchMode: z.enum(["all", "any"]).optional(),
  minEnrolledSiblings: z.number().int().min(0).optional(),
  siblingOrdinal: z.number().int().min(2).optional(),
  minEnrollmentYears: z.number().int().min(1).optional(),
  parentIsFullTimeStaff: z.boolean().optional(),
  topRankInGrade: z.number().int().min(1).optional(),
  newEnrollmentThisYear: z.boolean().optional(),
  requiresPaymentAtEnrollment: z.boolean().optional(),
  requiresDocumentation: z.boolean().optional(),
  prorateAcrossInstallments: z.boolean().optional(),
  priorityOrder: z.number().int().min(1).optional(),
  notes: z.string().optional()
});

export const discountRuleCriteriaSchema = z.discriminatedUnion("type", [
  siblingRuleCriteriaSchema,
  scholarshipRuleCriteriaSchema,
  staffChildRuleCriteriaSchema,
  earlyPaymentRuleCriteriaSchema,
  customRuleCriteriaSchema
]);

export type DiscountRuleCriteria = z.infer<typeof discountRuleCriteriaSchema>;

export const discountPolicySchema = z.object({
  maxCombinedPercent: z.number().min(0).max(100).default(60),
  ordinalMethod: z.literal("birth_date_then_id").default("birth_date_then_id")
});

export type DiscountPolicy = z.infer<typeof discountPolicySchema>;

export type DiscountFeeLine = {
  feeItemId: string;
  feeItemName?: string;
  feeType: string;
  lineTotal: number;
};

export const DEFAULT_DISCOUNT_POLICY: DiscountPolicy = {
  maxCombinedPercent: 60,
  ordinalMethod: "birth_date_then_id"
};

const discountRuleFieldsSchema = z.object({
  name: z.string().trim().min(1),
  discountType: z.enum([...discountRuleTypes, LEGACY_STAFF_DISCOUNT_TYPE]),
  valueType: z.enum(["percentage", "fixed"]),
  value: z.number().min(0),
  approvalThreshold: z.number().min(0).nullable().optional(),
  triggerMode: z.enum(discountTriggerModes).optional(),
  stackable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  criteria: discountRuleCriteriaSchema
});

function refineDiscountPercentValue(
  data: { valueType?: "percentage" | "fixed"; value?: number },
  ctx: z.RefinementCtx
) {
  if (data.valueType === "percentage" && data.value != null && data.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a percentage between 0 and 100.",
      path: ["value"]
    });
  }
}

export const createDiscountRuleSchema = discountRuleFieldsSchema.superRefine(refineDiscountPercentValue);

export type CreateDiscountRuleInput = z.infer<typeof createDiscountRuleSchema>;

export const updateDiscountRuleSchema = discountRuleFieldsSchema
  .partial()
  .superRefine(refineDiscountPercentValue);
export type UpdateDiscountRuleInput = z.infer<typeof updateDiscountRuleSchema>;

export type DiscountEvaluationContext = {
  billingContext: DiscountBillingContext;
  academicYearId: string;
  gradeId: string;
  feeLines: DiscountFeeLine[];
  siblingSummary: {
    eligible: boolean;
    enrolledSiblingCount: number;
    studentPosition: number;
  };
  collectPayment?: boolean;
  paymentMethod?: string;
  paymentPlanFrequency?: DiscountPaymentPlanFrequency;
  /** Consecutive academic years enrolled at the school. */
  enrollmentYears?: number;
  parentIsFullTimeStaff?: boolean;
  /** Student rank in grade by GPA (1 = top). */
  gradeRank?: number;
  isNewEnrollmentThisYear?: boolean;
};

export type DiscountCandidate = {
  id: string;
  ruleId: string;
  name: string;
  discountType: string;
  source: "student_discount" | "rule";
  stackable: boolean;
  sortOrder: number;
  valueType: string;
  value: number;
  approvalThreshold: number | null;
  criteria: DiscountRuleCriteria;
  status?: string;
};

export type AppliedDiscount = {
  id: string;
  ruleId: string;
  name: string;
  discountType: string;
  amount: number;
  source: "student_discount" | "rule";
  stackable: boolean;
  requiresApproval: boolean;
  status?: string;
  eligibilityReason?: string;
};

export function defaultAppliesTo(
  discountType: string,
  billingContexts: DiscountBillingContext[] = ["enrollment"]
): DiscountAppliesTo {
  const normalized = normalizeDiscountType(discountType);
  const feeTypes =
    normalized === "sibling" || normalized === "scholarship" || normalized === "staff_child"
      ? ["tuition"]
      : ["tuition"];

  return {
    billingContexts,
    feeTypes
  };
}

export function parseDiscountCriteria(
  discountType: string,
  raw: Record<string, unknown> | null | undefined
): DiscountRuleCriteria {
  const normalized = normalizeDiscountType(discountType);
  const legacyAppliesToFeeTypes = Array.isArray(raw?.appliesToFeeTypes)
    ? (raw.appliesToFeeTypes as string[])
    : undefined;
  const legacyAppliesTo = raw?.appliesTo as DiscountAppliesTo | undefined;

  const appliesTo =
    legacyAppliesTo ??
    discountAppliesToSchema.parse({
      billingContexts: Array.isArray(raw?.billingContexts)
        ? raw.billingContexts
        : ["enrollment", "recurring"],
      feeTypes: legacyAppliesToFeeTypes?.length ? legacyAppliesToFeeTypes : ["tuition"],
      feeItemIds: Array.isArray(raw?.feeItemIds) ? raw.feeItemIds : undefined,
      gradeIds: Array.isArray(raw?.gradeIds) ? raw.gradeIds : undefined,
      academicYearIds: Array.isArray(raw?.academicYearIds) ? raw.academicYearIds : undefined
    });

  if (normalized === "sibling") {
    return siblingRuleCriteriaSchema.parse({
      type: "sibling",
      appliesTo,
      minEnrolledSiblings:
        typeof raw?.minEnrolledSiblings === "number" ? raw.minEnrolledSiblings : 1,
      siblingOrdinal: typeof raw?.siblingOrdinal === "number" ? raw.siblingOrdinal : undefined,
      notes: typeof raw?.notes === "string" ? raw.notes : typeof raw?.description === "string" ? raw.description : undefined
    });
  }

  if (normalized === "early_payment") {
    return earlyPaymentRuleCriteriaSchema.parse({
      type: "early_payment",
      appliesTo,
      requiresPaymentAtEnrollment: raw?.requiresPaymentAtEnrollment !== false,
      paymentMethods: Array.isArray(raw?.paymentMethods) ? raw.paymentMethods : undefined,
      notes: typeof raw?.notes === "string" ? raw.notes : typeof raw?.description === "string" ? raw.description : undefined
    });
  }

  if (normalized === "staff_child") {
    return staffChildRuleCriteriaSchema.parse({
      type: "staff_child",
      appliesTo,
      requiresDocumentation: raw?.requiresDocumentation === true,
      notes: typeof raw?.notes === "string" ? raw.notes : typeof raw?.description === "string" ? raw.description : undefined
    });
  }

  if (normalized === "custom" || raw?.type === "custom") {
    return customRuleCriteriaSchema.parse({
      type: "custom",
      appliesTo,
      paymentPlanFrequencies: Array.isArray(raw?.paymentPlanFrequencies)
        ? raw.paymentPlanFrequencies
        : undefined,
      eligibilityMatchMode:
        raw?.eligibilityMatchMode === "any" || raw?.eligibilityMatchMode === "all"
          ? raw.eligibilityMatchMode
          : undefined,
      minEnrolledSiblings:
        typeof raw?.minEnrolledSiblings === "number" ? raw.minEnrolledSiblings : undefined,
      siblingOrdinal: typeof raw?.siblingOrdinal === "number" ? raw.siblingOrdinal : undefined,
      minEnrollmentYears:
        typeof raw?.minEnrollmentYears === "number" ? raw.minEnrollmentYears : undefined,
      parentIsFullTimeStaff: raw?.parentIsFullTimeStaff === true ? true : undefined,
      topRankInGrade: typeof raw?.topRankInGrade === "number" ? raw.topRankInGrade : undefined,
      newEnrollmentThisYear: raw?.newEnrollmentThisYear === true ? true : undefined,
      requiresPaymentAtEnrollment:
        raw?.requiresPaymentAtEnrollment === true ? true : undefined,
      requiresDocumentation: raw?.requiresDocumentation === true ? true : undefined,
      prorateAcrossInstallments: raw?.prorateAcrossInstallments === true ? true : undefined,
      priorityOrder: typeof raw?.priorityOrder === "number" ? raw.priorityOrder : undefined,
      notes:
        typeof raw?.notes === "string"
          ? raw.notes
          : typeof raw?.description === "string"
            ? raw.description
            : undefined
    });
  }

  return scholarshipRuleCriteriaSchema.parse({
    type: "scholarship",
    appliesTo,
    requiresDocumentation: raw?.requiresDocumentation === true,
    notes: typeof raw?.notes === "string" ? raw.notes : typeof raw?.description === "string" ? raw.description : undefined
  });
}

export function ruleMatchesContext(
  criteria: DiscountRuleCriteria,
  context: DiscountEvaluationContext
): boolean {
  const { appliesTo } = criteria;
  if (!appliesTo.billingContexts.includes(context.billingContext)) {
    return false;
  }
  if (appliesTo.academicYearIds?.length && !appliesTo.academicYearIds.includes(context.academicYearId)) {
    return false;
  }
  if (appliesTo.gradeIds?.length && !appliesTo.gradeIds.includes(context.gradeId)) {
    return false;
  }
  return true;
}

export function filterFeeLinesByAppliesTo(
  feeLines: DiscountFeeLine[],
  appliesTo: DiscountAppliesTo
): DiscountFeeLine[] {
  let lines = feeLines;

  if (appliesTo.feeTypes.length > 0) {
    lines = lines.filter((line) => appliesTo.feeTypes.includes(line.feeType));
  }

  if (appliesTo.feeItemIds?.length) {
    lines = lines.filter((line) => appliesTo.feeItemIds!.includes(line.feeItemId));
  }

  return lines;
}

export function computeDiscountAmount(
  feeLines: DiscountFeeLine[],
  appliesTo: DiscountAppliesTo,
  valueType: string,
  value: number
): number {
  const eligibleLines = filterFeeLinesByAppliesTo(feeLines, appliesTo);
  const base = eligibleLines.reduce((sum, line) => sum + line.lineTotal, 0);
  if (base <= 0) return 0;

  if (valueType === "percentage") {
    return Math.round((base * value) / 100);
  }

  return Math.min(value, base);
}

export function siblingRuleMatches(
  criteria: z.infer<typeof siblingRuleCriteriaSchema>,
  siblingSummary: DiscountEvaluationContext["siblingSummary"]
): boolean {
  if (!siblingSummary.eligible) return false;
  const minSiblings = criteria.minEnrolledSiblings ?? 1;
  if (siblingSummary.enrolledSiblingCount < minSiblings) return false;
  if (criteria.siblingOrdinal != null && siblingSummary.studentPosition !== criteria.siblingOrdinal) {
    return false;
  }
  return true;
}

export function earlyPaymentRuleMatches(
  criteria: z.infer<typeof earlyPaymentRuleCriteriaSchema>,
  context: DiscountEvaluationContext
): boolean {
  if (criteria.requiresPaymentAtEnrollment && !context.collectPayment) {
    return false;
  }
  if (
    criteria.paymentMethods?.length &&
    context.paymentMethod &&
    !criteria.paymentMethods.includes(context.paymentMethod)
  ) {
    return false;
  }
  return true;
}

export function customRuleMatches(
  criteria: z.infer<typeof customRuleCriteriaSchema>,
  context: DiscountEvaluationContext
): boolean {
  const checks: boolean[] = [];

  if (
    criteria.paymentPlanFrequencies?.length &&
    context.paymentPlanFrequency &&
    !criteria.paymentPlanFrequencies.includes(context.paymentPlanFrequency)
  ) {
    return false;
  }

  if (criteria.minEnrolledSiblings != null || criteria.siblingOrdinal != null) {
    checks.push(
      siblingRuleMatches(
        {
          type: "sibling",
          appliesTo: criteria.appliesTo,
          minEnrolledSiblings: criteria.minEnrolledSiblings ?? 1,
          siblingOrdinal: criteria.siblingOrdinal
        },
        context.siblingSummary
      )
    );
  }

  if (criteria.requiresPaymentAtEnrollment) {
    checks.push(
      earlyPaymentRuleMatches(
        {
          type: "early_payment",
          appliesTo: criteria.appliesTo,
          requiresPaymentAtEnrollment: true
        },
        context
      )
    );
  }

  if (criteria.minEnrollmentYears != null) {
    checks.push((context.enrollmentYears ?? 0) >= criteria.minEnrollmentYears);
  }

  if (criteria.parentIsFullTimeStaff) {
    checks.push(context.parentIsFullTimeStaff === true);
  }

  if (criteria.topRankInGrade != null) {
    checks.push((context.gradeRank ?? Number.MAX_SAFE_INTEGER) <= criteria.topRankInGrade);
  }

  if (criteria.newEnrollmentThisYear) {
    checks.push(context.isNewEnrollmentThisYear === true);
  }

  if (!checks.length) {
    return true;
  }

  const mode = criteria.eligibilityMatchMode ?? "all";
  return mode === "any" ? checks.some(Boolean) : checks.every(Boolean);
}

function exceedsThreshold(amount: number, threshold: number | null): boolean {
  if (threshold == null) return false;
  return amount > threshold;
}

export function applyDiscountStacking(
  candidates: Array<DiscountCandidate & { amount: number; eligibilityReason?: string }>,
  feeLines: DiscountFeeLine[],
  policy: DiscountPolicy = DEFAULT_DISCOUNT_POLICY
): { discounts: AppliedDiscount[]; discountTotal: number; discountApprovalRequired: boolean } {
  const stackable = candidates.filter((c) => c.stackable);
  const nonStackable = candidates.filter((c) => !c.stackable);

  const bestNonStackable =
    nonStackable.length > 0
      ? [...nonStackable].sort((a, b) => {
          if (b.amount !== a.amount) return b.amount - a.amount;
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          return a.ruleId.localeCompare(b.ruleId);
        })[0]
      : null;

  const winners = [...stackable, ...(bestNonStackable ? [bestNonStackable] : [])];

  const affectedLineIds = new Set<string>();
  for (const winner of winners) {
    for (const line of filterFeeLinesByAppliesTo(feeLines, winner.criteria.appliesTo)) {
      affectedLineIds.add(line.feeItemId);
    }
  }

  const capBase = feeLines
    .filter((line) => affectedLineIds.has(line.feeItemId))
    .reduce((sum, line) => sum + line.lineTotal, 0);
  const maxAllowed = Math.round((capBase * policy.maxCombinedPercent) / 100);

  let rawTotal = winners.reduce((sum, w) => sum + w.amount, 0);
  let scale = 1;
  if (rawTotal > maxAllowed && maxAllowed >= 0 && rawTotal > 0) {
    scale = maxAllowed / rawTotal;
    rawTotal = maxAllowed;
  }

  let discountApprovalRequired = false;
  const discounts: AppliedDiscount[] = winners.map((winner) => {
    const amount = Math.round(winner.amount * scale);
    const requiresApproval = exceedsThreshold(amount, winner.approvalThreshold);
    if (requiresApproval) discountApprovalRequired = true;
    return {
      id: winner.id,
      ruleId: winner.ruleId,
      name: winner.name,
      discountType: winner.discountType,
      amount,
      source: winner.source,
      stackable: winner.stackable,
      requiresApproval,
      status: winner.status,
      eligibilityReason: winner.eligibilityReason
    };
  });

  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);

  return { discounts, discountTotal, discountApprovalRequired };
}

export function deriveRuleScopeLabel(criteria: DiscountRuleCriteria): string {
  const parts: string[] = [];
  const { appliesTo } = criteria;

  if (appliesTo.billingContexts.length === 1) {
    parts.push(appliesTo.billingContexts[0] === "enrollment" ? "Enrollment" : "Recurring");
  } else if (appliesTo.billingContexts.length === 2) {
    parts.push("All billing");
  }

  if (appliesTo.feeTypes.length === 1) {
    parts.push(formatFeeTypeLabel(appliesTo.feeTypes[0]!));
  } else if (appliesTo.feeTypes.length > 1) {
    parts.push(`${appliesTo.feeTypes.length} fee types`);
  }

  if (appliesTo.feeItemIds?.length) {
    parts.push(`${appliesTo.feeItemIds.length} items`);
  }

  return parts.join(" · ") || "All fees";
}

function formatFeeTypeLabel(feeType: string): string {
  return feeType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function deriveRuleTags(input: {
  discountType: string;
  triggerMode: DiscountTriggerMode;
  stackable: boolean;
  criteria: DiscountRuleCriteria;
}): string[] {
  const tags: string[] = [];
  tags.push(
    input.triggerMode === "auto"
      ? "Auto"
      : input.triggerMode === "manual"
        ? "Manual"
        : "Request"
  );
  tags.push(deriveRuleScopeLabel(input.criteria));
  if (input.stackable) tags.push("Stackable");
  else tags.push("Best wins");
  return tags;
}
