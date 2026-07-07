"use client";

import { DateCalendar, type DateCalendarProps } from "./date-calendar";

/** @deprecated Use {@link DateCalendar} with variant="default". */
export type DayCalendarProps = Omit<
  DateCalendarProps,
  "variant" | "selectedDay" | "range" | "onRangeChange"
> & {
  selectedDay?: number;
  onDaySelect: (day: number) => void;
  prevMonthLabel: string;
  nextMonthLabel: string;
};

/** Back-compat wrapper around {@link DateCalendar}. */
export function DayCalendar({
  year,
  month,
  selectedDay,
  onMonthChange,
  onDaySelect,
  prevMonthLabel,
  nextMonthLabel,
  calendarConfig = "static",
}: DayCalendarProps) {
  return (
    <DateCalendar
      variant="default"
      calendarConfig={calendarConfig}
      year={year}
      month={month}
      selectedDay={
        selectedDay != null ? { year, month, day: selectedDay } : undefined
      }
      onMonthChange={onMonthChange}
      onDaySelect={(date) => onDaySelect(date.day)}
      prevLabel={prevMonthLabel}
      nextLabel={nextMonthLabel}
    />
  );
}
