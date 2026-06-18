import {
  applyDiscountStacking,
  computeDiscountAmount,
  customRuleMatches,
  DEFAULT_DISCOUNT_POLICY,
  earlyPaymentRuleMatches,
  normalizeDiscountType,
  parseDiscountCriteria,
  ruleMatchesContext,
  siblingRuleMatches,
  type AppliedDiscount,
  type DiscountEvaluationContext,
  type DiscountPolicy
} from "@sms/shared";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import type { Database } from "../db/db.module.js";
import { discountRules, invoiceDiscountLines, studentDiscounts } from "../db/schema.js";

type EvaluateInput = {
  tenantId: string;
  studentId: string;
  context: DiscountEvaluationContext;
  policy?: DiscountPolicy;
};

export async function evaluateDiscountsFromDb(
  db: Database,
  input: EvaluateInput
): Promise<{
  discounts: AppliedDiscount[];
  discountTotal: number;
  discountApprovalRequired: boolean;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const policy = input.policy ?? DEFAULT_DISCOUNT_POLICY;
  const candidates: Array<{
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
    criteria: ReturnType<typeof parseDiscountCriteria>;
    status?: string;
    amount: number;
    eligibilityReason?: string;
  }> = [];

  const approvedStudentDiscounts = await db
    .select({
      id: studentDiscounts.id,
      ruleId: discountRules.id,
      ruleName: discountRules.name,
      discountType: discountRules.discountType,
      valueType: discountRules.valueType,
      value: discountRules.value,
      approvalThreshold: discountRules.approvalThreshold,
      triggerMode: discountRules.triggerMode,
      stackable: discountRules.stackable,
      sortOrder: discountRules.sortOrder,
      criteria: discountRules.criteria,
      status: studentDiscounts.status
    })
    .from(studentDiscounts)
    .innerJoin(discountRules, eq(studentDiscounts.discountRuleId, discountRules.id))
    .where(
      and(
        eq(studentDiscounts.tenantId, input.tenantId),
        eq(studentDiscounts.studentId, input.studentId),
        eq(studentDiscounts.status, "approved"),
        eq(discountRules.status, "active"),
        lte(studentDiscounts.effectiveFrom, today),
        or(isNull(studentDiscounts.effectiveTo), gte(studentDiscounts.effectiveTo, today))
      )
    );

  for (const row of approvedStudentDiscounts) {
    const criteria = parseDiscountCriteria(row.discountType, row.criteria as Record<string, unknown>);
    if (!ruleMatchesContext(criteria, input.context)) continue;

    const amount = computeDiscountAmount(
      input.context.feeLines,
      criteria.appliesTo,
      row.valueType,
      Number(row.value)
    );
    if (amount <= 0) continue;

    candidates.push({
      id: row.id,
      ruleId: row.ruleId,
      name: row.ruleName,
      discountType: row.discountType,
      source: "student_discount",
      stackable: row.stackable,
      sortOrder: row.sortOrder,
      valueType: row.valueType,
      value: Number(row.value),
      approvalThreshold: row.approvalThreshold != null ? Number(row.approvalThreshold) : null,
      criteria,
      status: row.status,
      amount,
      eligibilityReason: "Approved student discount"
    });
  }

  const autoRules = await db
    .select()
    .from(discountRules)
    .where(
      and(
        eq(discountRules.tenantId, input.tenantId),
        eq(discountRules.status, "active"),
        eq(discountRules.triggerMode, "auto")
      )
    );

  for (const rule of autoRules) {
    const normalizedType = normalizeDiscountType(rule.discountType);
    const criteria = parseDiscountCriteria(rule.discountType, rule.criteria as Record<string, unknown>);

    if (!ruleMatchesContext(criteria, input.context)) continue;

    if (normalizedType === "sibling") {
      if (criteria.type !== "sibling" || !siblingRuleMatches(criteria, input.context.siblingSummary)) {
        continue;
      }
    } else if (normalizedType === "early_payment") {
      if (criteria.type !== "early_payment" || !earlyPaymentRuleMatches(criteria, input.context)) {
        continue;
      }
    } else if (normalizedType === "custom") {
      if (criteria.type !== "custom" || !customRuleMatches(criteria, input.context)) {
        continue;
      }
    } else {
      continue;
    }

    if (
      candidates.some(
        (candidate) =>
          candidate.source === "rule" &&
          normalizeDiscountType(candidate.discountType) === normalizedType
      )
    ) {
      continue;
    }

    const amount = computeDiscountAmount(
      input.context.feeLines,
      criteria.appliesTo,
      rule.valueType,
      Number(rule.value)
    );
    if (amount <= 0) continue;

    candidates.push({
      id: rule.id,
      ruleId: rule.id,
      name: rule.name,
      discountType: rule.discountType,
      source: "rule",
      stackable: rule.stackable,
      sortOrder: rule.sortOrder,
      valueType: rule.valueType,
      value: Number(rule.value),
      approvalThreshold: rule.approvalThreshold != null ? Number(rule.approvalThreshold) : null,
      criteria,
      amount,
      eligibilityReason:
        normalizedType === "sibling"
          ? `${input.context.siblingSummary.enrolledSiblingCount} enrolled sibling(s) — position ${input.context.siblingSummary.studentPosition}`
          : normalizedType === "custom"
            ? "Custom rule conditions met"
            : "Payment collected at enrollment"
    });
  }

  return applyDiscountStacking(candidates, input.context.feeLines, policy);
}

export async function persistInvoiceDiscountLines(
  db: Pick<Database, "insert">,
  tenantId: string,
  invoiceId: string,
  discounts: AppliedDiscount[],
  actorUserId: string
) {
  if (!discounts.length) return;

  await db.insert(invoiceDiscountLines).values(
    discounts.map((discount) => ({
      tenantId,
      invoiceId,
      discountRuleId: discount.ruleId,
      studentDiscountId: discount.source === "student_discount" ? discount.id : null,
      name: discount.name,
      discountType: discount.discountType,
      source: discount.source,
      stackable: discount.stackable,
      amount: String(discount.amount),
      eligibilityReason: discount.eligibilityReason ?? null,
      createdBy: actorUserId,
      updatedBy: actorUserId
    }))
  );
}

export function siblingSummaryMessage(
  summary: DiscountEvaluationContext["siblingSummary"],
  hasFamilyGroup: boolean
): string {
  if (!hasFamilyGroup) {
    return "No family group linked — sibling discount not evaluated.";
  }
  if (summary.eligible) {
    return `${summary.enrolledSiblingCount} enrolled sibling(s) in this family for the selected year (position ${summary.studentPosition}).`;
  }
  return "No enrolled siblings in this family for the selected year.";
}
