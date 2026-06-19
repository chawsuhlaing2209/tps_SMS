"use client";

import { DatePickerNavButton } from "../subcomponents/date-picker-nav-button";
import { MonthCalendarCell } from "../subcomponents/month-calendar-cell";
import { MONTH_LABELS_SHORT } from "../date-picker-utils";

export type MonthCalendarProps = {
  year: number;
  selectedMonth?: number;
  onYearChange: (year: number) => void;
  onMonthSelect: (month: number) => void;
  prevYearLabel: string;
  nextYearLabel: string;
};

/** 3×4 month grid with year navigation — Figma 67:14364. */
export function MonthCalendar({
  year,
  selectedMonth,
  onYearChange,
  onMonthSelect,
  prevYearLabel,
  nextYearLabel,
}: MonthCalendarProps) {
  const now = new Date();

  return (
    <div className="pds-date-calendar">
      <div className="pds-date-calendar__header">
        <DatePickerNavButton
          direction="prev"
          ariaLabel={prevYearLabel}
          onClick={() => onYearChange(year - 1)}
        />
        <span className="pds-type-body-m-medium pds-date-calendar__title">{year}</span>
        <DatePickerNavButton
          direction="next"
          ariaLabel={nextYearLabel}
          onClick={() => onYearChange(year + 1)}
        />
      </div>
      <div className="pds-month-calendar">
        {MONTH_LABELS_SHORT.map((label, index) => {
          const month = index + 1;
          const selected = selectedMonth === month;
          const current =
            now.getFullYear() === year && now.getMonth() + 1 === month;
          return (
            <MonthCalendarCell
              key={label}
              label={label}
              selected={selected}
              current={current}
              onSelect={() => onMonthSelect(month)}
            />
          );
        })}
      </div>
    </div>
  );
}
