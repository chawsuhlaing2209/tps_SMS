import { describe, expect, it } from "vitest";
import {
  applyDiscountStacking,
  computeDiscountAmount,
  defaultAppliesTo,
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
