import type { TenantPreferences } from "@sms/shared";
import { parseDayRangeValue, toDayValue } from "../../../components/pds/date-picker-utils";
import {
  formatPreferredDateTime,
  formatPreferredMonth
} from "../../lib/format-preferences";

export function appendIssueDateRangeParams(params: URLSearchParams, issueDateRange: string) {
  const parsed = parseDayRangeValue(issueDateRange);
  if (!parsed) return;
  params.set("dateFrom", toDayValue(parsed.start.year, parsed.start.month, parsed.start.day));
  params.set("dateTo", toDayValue(parsed.end.year, parsed.end.month, parsed.end.day));
}

export function formatCreatedAt(
  value: string | null | undefined,
  preferences?: Pick<TenantPreferences, "dateFormat" | "timeFormat"> | null
) {
  return formatPreferredDateTime(value, preferences);
}

export function formatBillingMonth(
  value: string | null | undefined,
  preferences?: Pick<TenantPreferences, "dateFormat"> | null
) {
  return formatPreferredMonth(value, preferences);
}
