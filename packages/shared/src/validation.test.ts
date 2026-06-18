import { describe, expect, it } from "vitest";
import { correctionReasonSchema, parseCorrectionReason } from "./validation.js";

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
