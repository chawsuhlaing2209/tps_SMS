import { describe, expect, it } from "vitest";
import { buildPaymentNumber, PAYMENT_NUMBER_PATTERN } from "./payment-numbers.js";
import {
  billingMonthFromIssueDate,
  paymentPlanKeyFromInvoiceSource
} from "./finance-display.js";

describe("buildPaymentNumber", () => {
  it("builds PREFIX-DDMMYYYY-XXX and matches the shared pattern", () => {
    const number = buildPaymentNumber("PMT", new Date("2026-07-04T00:00:00Z"), "AB1");
    expect(number).toMatch(PAYMENT_NUMBER_PATTERN);
    expect(number.startsWith("PMT-")).toBe(true);
    expect(number.endsWith("-AB1")).toBe(true);
  });

  it("normalizes a messy prefix and falls back when empty", () => {
    expect(buildPaymentNumber(" rcpt ", new Date(), "XY9").startsWith("RCPT-")).toBe(true);
    expect(buildPaymentNumber("   ", new Date(), "XY9").startsWith("PMT-")).toBe(true);
  });

  it("generates pattern-valid numbers with the default random suffix", () => {
    expect(buildPaymentNumber()).toMatch(PAYMENT_NUMBER_PATTERN);
  });
});

describe("finance display helpers", () => {
  it("derives the billing month from an issue date", () => {
    expect(billingMonthFromIssueDate("2026-07-04")).toBe("2026-07");
    expect(billingMonthFromIssueDate(null)).toBeNull();
    expect(billingMonthFromIssueDate("2026")).toBeNull();
  });

  it("maps invoice sources to payment-plan label keys", () => {
    expect(paymentPlanKeyFromInvoiceSource("recurring")).toBe("monthly");
    expect(paymentPlanKeyFromInvoiceSource("enrollment")).toBe("enrollment");
    expect(paymentPlanKeyFromInvoiceSource("ad_hoc")).toBe("one_off");
    expect(paymentPlanKeyFromInvoiceSource(null)).toBe("one_off");
  });
});
