"use client";

import * as React from "react";
import { toDayValue, type DateParts, type WeekStartsOn } from "../date-picker-utils";
import { DateCalendarFooter } from "../subcomponents/date-calendar-footer";
import { DateCalendarMonthGrid } from "../subcomponents/date-calendar-month-grid";

export type DateCalendarVariant = "default" | "range";
export type DateCalendarAccent = "lime" | "shell";

export type DateCalendarProps = {
  variant?: DateCalendarVariant;
  /** Lime (form) or shell ink-green (filter) selection styling. */
  accent?: DateCalendarAccent;
  calendarConfig?: "static" | "dynamic";
  weekStartsOn?: WeekStartsOn;
  year: number;
  month: number;
  /** Single-day selection (variant=default). */
  selectedDay?: DateParts;
  /** Range selection (variant=range). */
  range?: { start?: DateParts; end?: DateParts };
  showFooter?: boolean;
  onMonthChange: (year: number, month: number) => void;
  onDaySelect?: (date: DateParts) => void;
  onRangeChange?: (range: { start: DateParts; end?: DateParts }) => void;
  onToday?: () => void;
  onConfirm?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  todayLabel?: string;
  okayLabel?: string;
};

/** Day grid calendar — single or range (Figma 67:14512). */
export function DateCalendar({
  variant = "default",
  accent = "lime",
  calendarConfig = "static",
  weekStartsOn,
  year,
  month,
  selectedDay,
  range,
  showFooter = false,
  onMonthChange,
  onDaySelect,
  onRangeChange,
  onToday,
  onConfirm,
  prevLabel = "Previous month",
  nextLabel = "Next month",
  todayLabel = "Today",
  okayLabel = "Okay",
}: DateCalendarProps) {
  const resolvedWeekStartsOn = weekStartsOn ?? (accent === "shell" ? "monday" : "sunday");

  return (
    <div
      className="pds-date-calendar"
      data-variant={variant}
      data-accent={accent}
      data-figma-node="67:14512"
    >
      <DateCalendarMonthGrid
        year={year}
        month={month}
        variant={variant}
        accent={accent}
        calendarConfig={calendarConfig}
        weekStartsOn={resolvedWeekStartsOn}
        selectedDay={selectedDay}
        range={range}
        onMonthChange={onMonthChange}
        onDaySelect={onDaySelect}
        onRangeChange={onRangeChange}
        prevLabel={prevLabel}
        nextLabel={nextLabel}
      />
      {showFooter ? (
        <DateCalendarFooter
          todayLabel={todayLabel}
          okayLabel={okayLabel}
          onToday={onToday}
          onOkay={onConfirm}
        />
      ) : null}
    </div>
  );
}

export { toDayValue, type DateParts };
