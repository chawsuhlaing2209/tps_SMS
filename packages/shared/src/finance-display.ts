export type InvoiceSource = "enrollment" | "recurring" | "ad_hoc";

export type PaymentPlanDisplayKey = "enrollment" | "monthly" | "one_off";

/** Billing period as YYYY-MM from an invoice issue date. */
export function billingMonthFromIssueDate(issueDate: string | null | undefined): string | null {
  if (!issueDate || issueDate.length < 7) return null;
  return issueDate.slice(0, 7);
}

/** Maps invoice source to a payment-plan label key for i18n. */
export function paymentPlanKeyFromInvoiceSource(
  source: InvoiceSource | string | null | undefined
): PaymentPlanDisplayKey {
  if (source === "recurring") return "monthly";
  if (source === "enrollment") return "enrollment";
  return "one_off";
}
