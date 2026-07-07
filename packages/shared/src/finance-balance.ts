export type InvoicePaymentLedgerLine = {
  kind: "payment" | "refund";
  amount: number | string;
  verifiedAt?: string | Date | null;
};

/** Sum of unverified payment amounts (refunds excluded). */
export function sumPendingVerificationAmount(payments: InvoicePaymentLedgerLine[]): number {
  return payments.reduce((sum, payment) => {
    if (payment.kind !== "payment" || payment.verifiedAt) return sum;
    return sum + Number(payment.amount);
  }, 0);
}

/** Balance still available to record after pending verification is reserved. */
export function computeRecordablePaymentBalance(
  balanceDue: number,
  pendingVerificationAmount: number
): number {
  return Math.max(0, balanceDue - pendingVerificationAmount);
}

export function canRecordInvoicePayment(input: {
  balanceDue: number;
  pendingVerificationAmount: number;
  isClosed?: boolean;
}): boolean {
  if (input.isClosed) return false;
  return computeRecordablePaymentBalance(input.balanceDue, input.pendingVerificationAmount) > 0;
}

/** True when amount is positive and does not exceed recordable balance. */
export function isPaymentAmountWithinRecordableBalance(input: {
  amount: number;
  balanceDue: number;
  pendingVerificationAmount: number;
}): boolean {
  if (input.amount <= 0) return false;
  const recordable = computeRecordablePaymentBalance(
    input.balanceDue,
    input.pendingVerificationAmount
  );
  return recordable > 0 && input.amount <= recordable;
}
