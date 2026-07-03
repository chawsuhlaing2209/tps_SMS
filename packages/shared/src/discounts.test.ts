import { describe, expect, it } from "vitest";
import {
  applyDiscountStacking,
  computeDiscountAmount,
  customRuleMatches,
  defaultAppliesTo,
  earlyPaymentRuleMatches,
  siblingRuleMatches,
  type DiscountCandidate,
  type DiscountFeeLine
} from "./discounts.js";

const tuitionLine: DiscountFeeLine = {
  feeItemId: "fee-tuition",
  feeItemName: "Tuition",
  feeType: "tuition",
  lineTotal: 100_000
};

const transportLine: DiscountFeeLine = {
  feeItemId: "fee-transport",
  feeItemName: "Transport",
  feeType: "transport",
  lineTotal: 20_000
};

describe("computeDiscountAmount", () => {
  it("applies percentage only to configured fee types", () => {
    const amount = computeDiscountAmount(
      [tuitionLine, transportLine],
      defaultAppliesTo("sibling"),
      "percentage",
      10
    );
    expect(amount).toBe(10_000);
  });
});

describe("siblingRuleMatches", () => {
  it("matches ordinal when position equals siblingOrdinal", () => {
    const criteria = {
      type: "sibling" as const,
      appliesTo: defaultAppliesTo("sibling"),
      minEnrolledSiblings: 1,
      siblingOrdinal: 2
    };
    expect(
      siblingRuleMatches(criteria, {
        eligible: true,
        enrolledSiblingCount: 1,
        studentPosition: 2
      })
    ).toBe(true);
    expect(
      siblingRuleMatches(criteria, {
        eligible: true,
        enrolledSiblingCount: 2,
        studentPosition: 3
      })
    ).toBe(false);
  });
});

describe("applyDiscountStacking", () => {
  const baseCandidate = (
    overrides: Partial<DiscountCandidate & { amount: number }>
  ): DiscountCandidate & { amount: number } => ({
    id: "id-1",
    ruleId: "rule-1",
    name: "Rule",
    discountType: "sibling",
    source: "rule",
    stackable: true,
    sortOrder: 0,
    valueType: "percentage",
    value: 10,
    approvalThreshold: null,
    criteria: {
      type: "sibling",
      appliesTo: defaultAppliesTo("sibling"),
      minEnrolledSiblings: 1
    },
    amount: 10_000,
    ...overrides
  });

  it("sums stackable discounts", () => {
    const result = applyDiscountStacking(
      [
        baseCandidate({ id: "a", ruleId: "a", amount: 10_000, stackable: true }),
        baseCandidate({ id: "b", ruleId: "b", amount: 5_000, stackable: true })
      ],
      [tuitionLine],
      { maxCombinedPercent: 60, ordinalMethod: "birth_date_then_id" }
    );
    expect(result.discountTotal).toBe(15_000);
    expect(result.discounts).toHaveLength(2);
  });

  it("picks best non-stackable discount only", () => {
    const result = applyDiscountStacking(
      [
        baseCandidate({ id: "a", ruleId: "a", amount: 8_000, stackable: false }),
        baseCandidate({ id: "b", ruleId: "b", amount: 12_000, stackable: false })
      ],
      [tuitionLine],
      { maxCombinedPercent: 60, ordinalMethod: "birth_date_then_id" }
    );
    expect(result.discountTotal).toBe(12_000);
    expect(result.discounts).toHaveLength(1);
    expect(result.discounts[0]?.id).toBe("b");
  });

  it("combines stackable sum with best non-stackable", () => {
    const result = applyDiscountStacking(
      [
        baseCandidate({ id: "stack", ruleId: "stack", amount: 5_000, stackable: true }),
        baseCandidate({ id: "best", ruleId: "best", amount: 12_000, stackable: false }),
        baseCandidate({ id: "lose", ruleId: "lose", amount: 8_000, stackable: false })
      ],
      [tuitionLine],
      { maxCombinedPercent: 60, ordinalMethod: "birth_date_then_id" }
    );
    expect(result.discountTotal).toBe(17_000);
    expect(result.discounts.map((d) => d.id).sort()).toEqual(["best", "stack"]);
  });

  it("caps combined discount at tenant max percent", () => {
    const result = applyDiscountStacking(
      [
        baseCandidate({ id: "a", ruleId: "a", amount: 40_000, stackable: true }),
        baseCandidate({ id: "b", ruleId: "b", amount: 30_000, stackable: true })
      ],
      [tuitionLine],
      { maxCombinedPercent: 60, ordinalMethod: "birth_date_then_id" }
    );
    expect(result.discountTotal).toBe(60_000);
  });
});

describe("earlyPaymentRuleMatches (early bird)", () => {
  const baseCriteria = {
    type: "early_payment" as const,
    appliesTo: defaultAppliesTo("early_payment"),
    requiresPaymentAtEnrollment: true
  };
  const baseContext = {
    billingContext: "enrollment" as const,
    academicYearId: "year-1",
    gradeId: "grade-1",
    feeLines: [tuitionLine],
    siblingSummary: { eligible: false, enrolledSiblingCount: 0, studentPosition: 1 },
    collectPayment: true
  };

  it("qualifies on/before the cutoff date and fails after it", () => {
    const criteria = { ...baseCriteria, cutoffDate: "2026-05-01" };
    expect(
      earlyPaymentRuleMatches(criteria, { ...baseContext, evaluationDate: "2026-05-01" })
    ).toBe(true);
    expect(
      earlyPaymentRuleMatches(criteria, { ...baseContext, evaluationDate: "2026-04-15" })
    ).toBe(true);
    expect(
      earlyPaymentRuleMatches(criteria, { ...baseContext, evaluationDate: "2026-05-02" })
    ).toBe(false);
  });

  it("enforces the recipient limit", () => {
    const criteria = { ...baseCriteria, maxRecipients: 10 };
    expect(earlyPaymentRuleMatches(criteria, baseContext, { grantedCount: 9 })).toBe(true);
    expect(earlyPaymentRuleMatches(criteria, baseContext, { grantedCount: 10 })).toBe(false);
    expect(earlyPaymentRuleMatches(criteria, baseContext)).toBe(true);
  });

  it("applies both cutoff and limit together", () => {
    const criteria = { ...baseCriteria, cutoffDate: "2026-05-01", maxRecipients: 2 };
    expect(
      earlyPaymentRuleMatches(
        criteria,
        { ...baseContext, evaluationDate: "2026-04-01" },
        { grantedCount: 1 }
      )
    ).toBe(true);
    expect(
      earlyPaymentRuleMatches(
        criteria,
        { ...baseContext, evaluationDate: "2026-04-01" },
        { grantedCount: 2 }
      )
    ).toBe(false);
    expect(
      earlyPaymentRuleMatches(
        criteria,
        { ...baseContext, evaluationDate: "2026-06-01" },
        { grantedCount: 0 }
      )
    ).toBe(false);
  });

  it("still requires payment at enrollment when explicitly configured", () => {
    const criteria = { ...baseCriteria, cutoffDate: "2099-01-01" };
    expect(
      earlyPaymentRuleMatches(criteria, { ...baseContext, collectPayment: false })
    ).toBe(false);
  });
});

describe("customRuleMatches (early bird gates)", () => {
  const baseContext = {
    billingContext: "enrollment" as const,
    academicYearId: "year-1",
    gradeId: "grade-1",
    feeLines: [tuitionLine],
    siblingSummary: { eligible: false, enrolledSiblingCount: 0, studentPosition: 1 }
  };
  const baseCriteria = {
    type: "custom" as const,
    appliesTo: defaultAppliesTo("custom")
  };

  it("gates on the cutoff date", () => {
    const criteria = { ...baseCriteria, cutoffDate: "2026-05-01" };
    expect(
      customRuleMatches(criteria, { ...baseContext, evaluationDate: "2026-05-01" })
    ).toBe(true);
    expect(
      customRuleMatches(criteria, { ...baseContext, evaluationDate: "2026-05-02" })
    ).toBe(false);
  });

  it("gates on the recipient limit", () => {
    const criteria = { ...baseCriteria, maxRecipients: 3 };
    expect(customRuleMatches(criteria, baseContext, { grantedCount: 2 })).toBe(true);
    expect(customRuleMatches(criteria, baseContext, { grantedCount: 3 })).toBe(false);
    expect(customRuleMatches(criteria, baseContext)).toBe(true);
  });

  it("early-bird gates are hard even with eligibilityMatchMode any", () => {
    const criteria = {
      ...baseCriteria,
      eligibilityMatchMode: "any" as const,
      newEnrollmentThisYear: true,
      cutoffDate: "2026-05-01"
    };
    // Criterion satisfied, but past the cutoff — must NOT match.
    expect(
      customRuleMatches(criteria, {
        ...baseContext,
        isNewEnrollmentThisYear: true,
        evaluationDate: "2026-06-01"
      })
    ).toBe(false);
  });
});
