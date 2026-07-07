import type { TenantPreferences } from "@sms/shared";
import { formatMMK } from "./money";

/** Used before the workspace bootstrap resolves (and for platform sessions). */
export const DEFAULT_TENANT_PREFERENCES: TenantPreferences = {
  defaultLanguage: "en",
  currency: "MMK",
  timezone: "Asia/Yangon",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h"
};

export type DateInput = string | number | Date | null | undefined;

type DatePrefs = Pick<TenantPreferences, "dateFormat"> | null | undefined;
type TimePrefs = Pick<TenantPreferences, "timeFormat"> | null | undefined;
type MoneyPrefs = Pick<TenantPreferences, "currency"> | null | undefined;

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Date-only strings become local dates so "2026-07-03" never shifts a day in UTC+ zones. */
function toDate(value: DateInput): Date | null {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number) as [number, number, number];
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a date per the tenant's dateFormat preference; "—" for empty/invalid input. */
export function formatPreferredDate(value: DateInput, preferences?: DatePrefs): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }
  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = String(date.getFullYear());
  switch (preferences?.dateFormat ?? DEFAULT_TENANT_PREFERENCES.dateFormat) {
    case "MM/DD/YYYY":
      return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    case "DD MMM YYYY":
      return `${dd} ${MONTHS_SHORT[date.getMonth()]} ${yyyy}`;
    case "DD/MM/YYYY":
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

/** Format a time per the tenant's 12h/24h preference; "—" for empty/invalid input. */
export function formatPreferredTime(value: DateInput, preferences?: TimePrefs): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  if ((preferences?.timeFormat ?? DEFAULT_TENANT_PREFERENCES.timeFormat) === "24h") {
    return `${pad2(hours)}:${minutes}`;
  }
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/** Date + time on one line, e.g. "03/07/2026, 2:05 PM". */
export function formatPreferredDateTime(
  value: DateInput,
  preferences?: (DatePrefs & TimePrefs) | null
): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }
  return `${formatPreferredDate(date, preferences)}, ${formatPreferredTime(date, preferences)}`;
}

/** Billing-month label from "YYYY-MM"; numeric formats keep "2026-07", others read "Jul 2026". */
export function formatPreferredMonth(
  value: string | null | undefined,
  preferences?: DatePrefs
): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return "—";
  }
  const [year, month] = value.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    return "—";
  }
  if ((preferences?.dateFormat ?? DEFAULT_TENANT_PREFERENCES.dateFormat) === "YYYY-MM-DD") {
    return `${year}-${pad2(month)}`;
  }
  return `${MONTHS_SHORT[month - 1]} ${year}`;
}

/**
 * Money per the tenant's currency preference. MMK keeps the formatMMK contract
 * (whole kyats, full digits); other currencies show up to two decimals.
 */
export function formatPreferredMoney(value: number, preferences?: MoneyPrefs): string {
  const currency = preferences?.currency ?? DEFAULT_TENANT_PREFERENCES.currency;
  if (currency === "MMK") {
    return formatMMK(value);
  }
  const amount = value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${amount} ${currency}`;
}
