import { parseDayRangeValue, toDayValue } from "../../../components/pds/date-picker-utils";

export function appendIssueDateRangeParams(params: URLSearchParams, issueDateRange: string) {
  const parsed = parseDayRangeValue(issueDateRange);
  if (!parsed) return;
  params.set("dateFrom", toDayValue(parsed.start.year, parsed.start.month, parsed.start.day));
  params.set("dateTo", toDayValue(parsed.end.year, parsed.end.month, parsed.end.day));
}

export function formatCreatedAt(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatBillingMonth(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return "—";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return "—";
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric"
  });
}
