import { describe, expect, it } from "vitest";
import {
  addPercentStringIssue,
  assertPercentInRange,
  clampPercentString,
  clampPercentValue,
  correctionReasonSchema,
  isPercentInRange,
  parseCorrectionReason,
  parsePercentString
} from "./validation.js";
import { z } from "zod";

describe("correctionReasonSchema", () => {
  it("accepts a trimmed non-empty reason", () => {
    expect(parseCorrectionReason("  Matched bank statement  ")).toBe("Matched bank statement");
  });

  it("rejects blank reasons", () => {
    expect(() => parseCorrectionReason("   ")).toThrow();
    expect(() => parseCorrectionReason("")).toThrow();
  });
});

describe("correctionReasonSchema export", () => {
  it("parses via schema directly", () => {
    expect(correctionReasonSchema.parse("Teacher verified with parent call.")).toBe(
      "Teacher verified with parent call."
    );
  });
});

describe("percent validation", () => {
  it("accepts values within 0–100", () => {
    expect(isPercentInRange(0)).toBe(true);
    expect(isPercentInRange(100)).toBe(true);
    expect(isPercentInRange(42.5)).toBe(true);
  });

  it("rejects values outside 0–100", () => {
    expect(isPercentInRange(-1)).toBe(false);
    expect(isPercentInRange(100.1)).toBe(false);
    expect(isPercentInRange(Number.NaN)).toBe(false);
  });

  it("clamps numeric and string inputs", () => {
    expect(clampPercentValue(150)).toBe(100);
    expect(clampPercentString("150")).toBe("100");
    expect(parsePercentString(" 25 ")).toBe(25);
  });

  it("assertPercentInRange throws for invalid values", () => {
    expect(() => assertPercentInRange(101)).toThrow();
  });

  it("addPercentStringIssue validates form strings", () => {
    const schema = z
      .object({ value: z.string() })
      .superRefine((data, ctx) => {
        addPercentStringIssue(ctx, data.value, ["value"]);
      });

    expect(schema.safeParse({ value: "50" }).success).toBe(true);
    expect(schema.safeParse({ value: "101" }).success).toBe(false);
  });
});
