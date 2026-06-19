export const MONTH_LABELS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type DateParts = { year: number; month: number; day: number };

export type DayGridCell = {
  year: number;
  month: number;
  day: number;
  muted: boolean;
};

export type WeekStartsOn = "monday" | "sunday";

export function parseMonthValue(value: string | undefined): { year: number; month: number } | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export function parseDayValue(value: string | undefined): DateParts | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

export function parseDayRangeValue(
  value: string | undefined
): { start: DateParts; end: DateParts } | null {
  if (!value || !value.includes("/")) return null;
  const [startRaw, endRaw] = value.split("/");
  const start = parseDayValue(startRaw);
  const end = parseDayValue(endRaw);
  if (!start || !end) return null;
  return { start, end };
}

export function toMonthValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function toDayValue(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function toDayRangeValue(start: DateParts, end: DateParts) {
  return `${toDayValue(start.year, start.month, start.day)}/${toDayValue(end.year, end.month, end.day)}`;
}

export function formatMonthLabel(value: string | undefined, style: "long" | "short" = "long") {
  const parsed = parseMonthValue(value);
  if (!parsed) return "";
  return new Date(parsed.year, parsed.month - 1, 1).toLocaleDateString("en-GB", {
    month: style,
    year: "numeric",
  });
}

export function formatDayLabel(value: string | undefined, variant: "form" | "filter" = "form") {
  const parsed = parseDayValue(value);
  if (!parsed) return "";
  if (variant === "filter") {
    return new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDayRangeLabel(value: string | undefined) {
  const parsed = parseDayRangeValue(value);
  if (!parsed) return "";
  const fmt = (parts: DateParts) =>
    new Date(parts.year, parts.month - 1, parts.day).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(parsed.start)} – ${fmt(parsed.end)}`;
}

export function weekIndex(date: Date, weekStartsOn: WeekStartsOn) {
  const day = date.getDay();
  if (weekStartsOn === "sunday") return day;
  return day === 0 ? 6 : day - 1;
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function compareDateParts(a: DateParts, b: DateParts) {
  const aKey = a.year * 10000 + a.month * 100 + a.day;
  const bKey = b.year * 10000 + b.month * 100 + b.day;
  return aKey - bKey;
}

export function normalizeDayRange(start: DateParts, end: DateParts) {
  return compareDateParts(start, end) <= 0 ? { start, end } : { start: end, end: start };
}

export function isDateInRange(date: DateParts, start: DateParts, end: DateParts) {
  const { start: from, end: to } = normalizeDayRange(start, end);
  return compareDateParts(date, from) >= 0 && compareDateParts(date, to) <= 0;
}

export function isSameDate(a: DateParts, b: DateParts) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isToday(year: number, month: number, day: number) {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
}

export function buildDayGrid(year: number, month: number, weekStartsOn: WeekStartsOn = "monday") {
  const totalDays = daysInMonth(year, month);
  const first = new Date(year, month - 1, 1);
  const leading = weekIndex(first, weekStartsOn);
  const cells: DayGridCell[] = [];

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthDays = daysInMonth(prevYear, prevMonth);

  for (let i = leading - 1; i >= 0; i -= 1) {
    cells.push({
      year: prevYear,
      month: prevMonth,
      day: prevMonthDays - i,
      muted: true,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({ year, month, day, muted: false });
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let trailingDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      year: nextYear,
      month: nextMonth,
      day: trailingDay,
      muted: true,
    });
    trailingDay += 1;
  }

  return cells;
}

export function monthTitle(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function weekdayLabels(weekStartsOn: WeekStartsOn) {
  const labels =
    weekStartsOn === "sunday"
      ? (["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const)
      : (["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const);
  return [...labels];
}

export function yearOptions(anchor: number, span = 10) {
  const years: number[] = [];
  for (let year = anchor - span; year <= anchor + span; year += 1) {
    years.push(year);
  }
  return years;
}

export type DateRangePresetId =
  | "today"
  | "this-week"
  | "last-7-days"
  | "this-month"
  | "last-month";

export const DATE_RANGE_PRESET_ORDER: DateRangePresetId[] = [
  "today",
  "this-week",
  "last-7-days",
  "this-month",
  "last-month",
];

export function dateFromParts(parts: DateParts) {
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function partsFromDate(date: Date): DateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function todayParts(): DateParts {
  return partsFromDate(new Date());
}

export function addMonths(year: number, month: number, offset: number) {
  const date = new Date(year, month - 1 + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function getDateRangePreset(
  id: DateRangePresetId,
  weekStartsOn: WeekStartsOn = "sunday"
): { start: DateParts; end: DateParts } {
  const now = new Date();
  const today = partsFromDate(now);

  if (id === "today") {
    return { start: today, end: today };
  }

  if (id === "last-7-days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: partsFromDate(start), end: today };
  }

  if (id === "this-month") {
    const start = { year: today.year, month: today.month, day: 1 };
    const end = {
      year: today.year,
      month: today.month,
      day: daysInMonth(today.year, today.month),
    };
    return { start, end };
  }

  if (id === "last-month") {
    const prev = addMonths(today.year, today.month, -1);
    const start = { year: prev.year, month: prev.month, day: 1 };
    const end = {
      year: prev.year,
      month: prev.month,
      day: daysInMonth(prev.year, prev.month),
    };
    return { start, end };
  }

  // this-week
  const dayIndex = weekIndex(now, weekStartsOn);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - dayIndex);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  return { start: partsFromDate(startDate), end: partsFromDate(endDate) };
}

export function rangesMatch(
  a: { start: DateParts; end: DateParts },
  b: { start: DateParts; end: DateParts }
) {
  const left = normalizeDayRange(a.start, a.end);
  const right = normalizeDayRange(b.start, b.end);
  return isSameDate(left.start, right.start) && isSameDate(left.end, right.end);
}

export function matchDateRangePreset(
  range: { start?: DateParts; end?: DateParts } | undefined,
  weekStartsOn: WeekStartsOn = "sunday"
): DateRangePresetId | undefined {
  if (!range?.start || !range?.end) return undefined;
  const normalized = normalizeDayRange(range.start, range.end);
  for (const id of DATE_RANGE_PRESET_ORDER) {
    if (rangesMatch(normalized, getDateRangePreset(id, weekStartsOn))) {
      return id;
    }
  }
  return undefined;
}
