/** Single source of truth for displaying money. Always full digits, grouped,
 *  with the MMK unit: e.g. 5300000 -> "5,300,000 MMK". No magnitude abbreviations.
 *  ponytail: one helper instead of ~30 ad-hoc per-screen formatters. */
export function formatMMK(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} MMK`;
}

/** Grouped digits without the unit — for slots that render their own "MMK"
 *  suffix (KPI cards, status cards) or i18n messages that include the unit. */
export function formatMoneyDigits(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
