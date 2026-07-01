import { describe, expect, it } from "vitest";
import {
  canRecordInvoicePayment,
  computeRecordablePaymentBalance,
  isPaymentAmountWithinRecordableBalance,
  sumPendingVerificationAmount
} from "./finance-balance.js";

describe("finance-balance", () => {
  it("sums only unverified payments", () => {
    const pending = sumPendingVerificationAmount([
      { kind: "payment", amount: "425000", verifiedAt: null },
      { kind: "payment", amount: "50000", verifiedAt: "2026-06-01T00:00:00Z" },
      { kind: "refund", amount: "10000", verifiedAt: null }
    ]);
    expect(pending).toBe(425000);
  });

  it("computes recordable balance after pending verification", () => {
    expect(computeRecordablePaymentBalance(425000, 425000)).toBe(0);
    expect(computeRecordablePaymentBalance(425000, 200000)).toBe(225000);
    expect(computeRecordablePaymentBalance(100000, 150000)).toBe(0);
  });

  it("rejects amounts above recordable balance", () => {
    expect(
      isPaymentAmountWithinRecordableBalance({
        amount: 426000,
        balanceDue: 425000,
        pendingVerificationAmount: 0
      })
    ).toBe(false);
    expect(
      isPaymentAmountWithinRecordableBalance({
        amount: 225000,
        balanceDue: 425000,
        pendingVerificationAmount: 200000
      })
    ).toBe(true);
    expect(
      isPaymentAmountWithinRecordableBalance({
        amount: 1,
        balanceDue: 425000,
        pendingVerificationAmount: 425000
      })
    ).toBe(false);
  });

  it("blocks record payment when pending covers balance due", () => {
    expect(
      canRecordInvoicePayment({
        balanceDue: 425000,
        pendingVerificationAmount: 425000
      })
    ).toBe(false);
    expect(
      canRecordInvoicePayment({
        balanceDue: 425000,
        pendingVerificationAmount: 200000
      })
    ).toBe(true);
    expect(
      canRecordInvoicePayment({
        balanceDue: 425000,
        pendingVerificationAmount: 0,
        isClosed: true
      })
    ).toBe(false);
  });
});
