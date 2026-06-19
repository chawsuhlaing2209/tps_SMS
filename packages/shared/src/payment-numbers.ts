import { formatInvoiceDatePart, randomInvoiceSuffix } from "./invoice-numbers.js";

/** Human-readable payment / receipt number aligned with invoice format. */
export function buildPaymentNumber(
  prefix = "PMT",
  date = new Date(),
  suffix = randomInvoiceSuffix(3)
): string {
  const safePrefix = prefix.trim().toUpperCase() || "PMT";
  return `${safePrefix}-${formatInvoiceDatePart(date)}-${suffix}`;
}

export const PAYMENT_NUMBER_PATTERN = /^[A-Z0-9]+-\d{8}-[A-Z0-9]{3}$/;
