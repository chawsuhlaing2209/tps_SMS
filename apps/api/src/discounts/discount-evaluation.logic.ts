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
  type DiscountPolicy,
  type DiscountRuleCriteria
} from "@sms/shared";
import type { EnrollmentPreviewDiscountOption } from "@sms/shared";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "../db/db.module.js";
import { discountRules, invoiceDiscountLines, studentDiscounts } from "../db/schema.js";

type EvaluateInput = {
  tenantId: string;
  studentId: string;
  context: DiscountEvaluationContext;
  policy?: DiscountPolicy;
  excludedDiscountRuleIds?: string[];
  forcedDiscountRuleIds?: string[];
};

function autoRuleTypeMatches(
  normalizedType: string,
  criteria: DiscountRuleCriteria,
  context: DiscountEvaluationContext,
  ruleId?: string
): boolean {
  if (normalizedType === "sibling") {
    return criteria.type === "sibling" && siblingRuleMatches(criteria, context.siblingSummary);
  }
  if (normalizedType === "early_payment") {
    return (
      criteria.type === "early_payment" &&
      earlyPaymentRuleMatches(criteria, context, {
        grantedCount: ruleId ? context.grantedCountByRuleId?.[ruleId] : undefined
      })
    );
  }
  if (normalizedType === "custom") {
    return criteria.type === "custom" && customRuleMatches(criteria, context);
  }
  return false;
}

function discountOptionSubtitle(
  criteria: DiscountRuleCriteria,
  normalizedType: string,
  context: DiscountEvaluationContext
): string | undefined {
  const notes =
    "notes" in criteria && typeof criteria.notes === "string"
      ? criteria.notes
      : undefined;
  if (notes) return notes;

  if (normalizedType === "sibling") {
    if (!context.siblingSummary.eligible) return undefined;
    const position = context.siblingSummary.studentPosition ?? context.siblingSummary.enrolledSiblingCount + 1;
    return `${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"} child in same family`;
  }
  if (normalizedType === "early_payment") {
    return "Full fees paid before term start";
  }
  if (normalizedType === "staff_child") {
    return "Parent employed at the school";
  }
  return undefined;
}

function formatDiscountName(name: string, valueType: string, value: number): string {
  if (valueType === "percentage") {
    return `${name} (${value}%)`;
  }
  return name;
}

export async function evaluateDiscountsFromDb(
  db: Database,
  input: EvaluateInput
): Promise<{
  discounts: AppliedDiscount[];
  discountTotal: number;
  discountApprovalRequired: boolean;
  discountOptions: EnrollmentPreviewDiscountOption[];
}> {
  const today = new Date().toISOString().slice(0, 10);
  const policy = input.policy ?? DEFAULT_DISCOUNT_POLICY;
  const excluded = new Set(input.excludedDiscountRuleIds ?? []);
  const forced = new Set(input.forcedDiscountRuleIds ?? []);
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
    if (excluded.has(row.ruleId)) continue;

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

  // Early-bird recipient limits: count invoices already granted per limited
  // rule so maxRecipients can be enforced. Callers may pre-populate
  // grantedCountByRuleId (e.g. inside a confirm transaction) to narrow races.
  if (!input.context.grantedCountByRuleId) {
    const limitedRuleIds = autoRules
      .filter((rule) => {
        const criteria = parseDiscountCriteria(
          rule.discountType,
          rule.criteria as Record<string, unknown>
        );
        return criteria.type === "early_payment" && criteria.maxRecipients != null;
      })
      .map((rule) => rule.id);

    if (limitedRuleIds.length) {
      const rows = await db
        .select({
          ruleId: invoiceDiscountLines.discountRuleId,
          n: sql<number>`count(distinct ${invoiceDiscountLines.invoiceId})::int`
        })
        .from(invoiceDiscountLines)
        .where(
          and(
            eq(invoiceDiscountLines.tenantId, input.tenantId),
            inArray(invoiceDiscountLines.discountRuleId, limitedRuleIds)
          )
        )
        .groupBy(invoiceDiscountLines.discountRuleId);

      input = {
        ...input,
        context: {
          ...input.context,
          grantedCountByRuleId: Object.fromEntries(
            rows.filter((row) => row.ruleId).map((row) => [row.ruleId as string, row.n])
          )
        }
      };
    }
  }

  for (const rule of autoRules) {
    if (excluded.has(rule.id)) continue;

    const normalizedType = normalizeDiscountType(rule.discountType);
    const criteria = parseDiscountCriteria(rule.discountType, rule.criteria as Record<string, unknown>);

    if (!ruleMatchesContext(criteria, input.context)) continue;

    const forcedRule = forced.has(rule.id);
    if (!forcedRule) {
      if (normalizedType === "sibling") {
        if (criteria.type !== "sibling" || !siblingRuleMatches(criteria, input.context.siblingSummary)) {
          continue;
        }
      } else if (normalizedType === "early_payment") {
        if (
          criteria.type !== "early_payment" ||
          !earlyPaymentRuleMatches(criteria, input.context, {
            grantedCount: input.context.grantedCountByRuleId?.[rule.id]
          })
        ) {
          continue;
        }
      } else if (normalizedType === "custom") {
        if (criteria.type !== "custom" || !customRuleMatches(criteria, input.context)) {
          continue;
        }
      } else {
        continue;
      }
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

  for (const ruleId of forced) {
    if (candidates.some((candidate) => candidate.ruleId === ruleId) || excluded.has(ruleId)) {
      continue;
    }

    const [rule] = await db
      .select()
      .from(discountRules)
      .where(and(eq(discountRules.tenantId, input.tenantId), eq(discountRules.id, ruleId)));

    if (!rule || rule.status !== "active") continue;

    const criteria = parseDiscountCriteria(rule.discountType, rule.criteria as Record<string, unknown>);
    if (!ruleMatchesContext(criteria, input.context)) continue;

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
      eligibilityReason: "Manually added at enrollment"
    });
  }

  const stacking = applyDiscountStacking(candidates, input.context.feeLines, policy);
  const appliedRuleIds = new Set(
    stacking.discounts.map((discount) => discount.ruleId).filter(Boolean) as string[]
  );

  const discountOptions: EnrollmentPreviewDiscountOption[] = [];

  for (const rule of autoRules) {
    const normalizedType = normalizeDiscountType(rule.discountType);
    const criteria = parseDiscountCriteria(rule.discountType, rule.criteria as Record<string, unknown>);
    const contextMatches = ruleMatchesContext(criteria, input.context);
    const typeMatches = autoRuleTypeMatches(normalizedType, criteria, input.context, rule.id);
    const amount = computeDiscountAmount(
      input.context.feeLines,
      criteria.appliesTo,
      rule.valueType,
      Number(rule.value)
    );
    const applied = appliedRuleIds.has(rule.id);
    const eligible = contextMatches && (typeMatches || forced.has(rule.id)) && amount > 0;

    let eligibility: EnrollmentPreviewDiscountOption["eligibility"];
    if (applied) {
      eligibility = "auto_applied";
    } else if (eligible) {
      eligibility = "eligible";
    } else {
      eligibility = "not_eligible";
    }

    discountOptions.push({
      ruleId: rule.id,
      name: formatDiscountName(rule.name, rule.valueType, Number(rule.value)),
      subtitle: discountOptionSubtitle(criteria, normalizedType, input.context),
      amount,
      applied,
      eligibility,
      canToggle: applied || eligible
    });
  }

  return {
    ...stacking,
    discountOptions
  };
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
