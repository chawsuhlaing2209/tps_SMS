"use client";

import * as React from "react";
import {
  buildDayGrid,
  isDateInRange,
  isSameDate,
  isToday,
  normalizeDayRange,
  weekdayLabels,
  type DateParts,
  type WeekStartsOn,
} from "../date-picker-utils";
import { DateCalendarHeader } from "./date-calendar-header";
import {
  DayCalendarCell,
  type DayCalendarCellAccent,
  type DayCalendarCellState,
} from "./day-calendar-cell";

export type DateCalendarMonthGridVariant = "default" | "range";

export type DateCalendarMonthGridProps = {
  year: number;
  month: number;
  variant?: DateCalendarMonthGridVariant;
  accent?: DayCalendarCellAccent;
  calendarConfig?: "static" | "dynamic";
  weekStartsOn?: WeekStartsOn;
  selectedDay?: DateParts;
  range?: { start?: DateParts; end?: DateParts };
  onMonthChange: (year: number, month: number) => void;
  onDaySelect?: (date: DateParts) => void;
  onRangeChange?: (range: { start: DateParts; end?: DateParts }) => void;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
};

function resolveCellState(
  cell: DateParts,
  variant: DateCalendarMonthGridVariant,
  selectedDay?: DateParts,
  range?: { start?: DateParts; end?: DateParts }
): DayCalendarCellState {
  const today = isToday(cell.year, cell.month, cell.day);

  if (variant === "range" && range?.start && range?.end) {
    const normalized = normalizeDayRange(range.start, range.end);
    if (isSameDate(cell, normalized.start)) return "range-start";
    if (isSameDate(cell, normalized.end)) return "range-end";
    if (isDateInRange(cell, normalized.start, normalized.end)) return "range";
    return today ? "today" : "idle";
  }

  if (variant === "range" && range?.start && !range.end) {
    if (isSameDate(cell, range.start)) return "range-start";
    return today ? "today" : "idle";
  }

  if (selectedDay && isSameDate(cell, selectedDay)) return "selected";
  return today ? "today" : "idle";
}

/** Single month header + weekday row + day grid. */
export function DateCalendarMonthGrid({
  year,
  month,
  variant = "default",
  accent = "lime",
  calendarConfig = "static",
  weekStartsOn = "sunday",
  selectedDay,
  range,
  onMonthChange,
  onDaySelect,
  onRangeChange,
  prevLabel = "Previous month",
  nextLabel = "Next month",
  className,
}: DateCalendarMonthGridProps) {
  const cells = React.useMemo(
    () => buildDayGrid(year, month, weekStartsOn),
    [month, weekStartsOn, year]
  );

  const handleSelect = (cell: DateParts, muted: boolean) => {
    if (muted) {
      onMonthChange(cell.year, cell.month);
      return;
    }

    if (variant === "range") {
      const currentStart = range?.start;
      const currentEnd = range?.end;
      // First click (or restart after a complete range) sets the start only, with
      // no end yet — so the next click extends it into a real range. Setting end
      // here would make every click look "complete" and never extend.
      if (!currentStart || currentEnd) {
        onRangeChange?.({ start: cell });
        return;
      }
      onRangeChange?.(normalizeDayRange(currentStart, cell));
      return;
    }

    onDaySelect?.(cell);
  };

  return (
    <div className={className}>
      <DateCalendarHeader
        year={year}
        month={month}
        calendarConfig={calendarConfig}
        prevLabel={prevLabel}
        nextLabel={nextLabel}
        onMonthChange={onMonthChange}
      />
      <div className="pds-day-calendar">
        <div className="pds-type-body-m-medium pds-day-calendar__weekdays">
          {weekdayLabels(weekStartsOn).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="pds-day-calendar__grid">
          {cells.map((cell) => {
            const parts = { year: cell.year, month: cell.month, day: cell.day };
            const state = cell.muted
              ? "muted"
              : resolveCellState(parts, variant, selectedDay, range);
            return (
              <DayCalendarCell
                key={`${cell.year}-${cell.month}-${cell.day}-${cell.muted ? "m" : "c"}`}
                label={String(cell.day)}
                state={state}
                accent={accent}
                onSelect={() => handleSelect(parts, cell.muted)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
