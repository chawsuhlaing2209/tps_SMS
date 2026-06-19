"use client";

import { MONTH_LABELS_SHORT, monthTitle, yearOptions } from "../date-picker-utils";
import { DatePickerNavButton } from "./date-picker-nav-button";
import { cn } from "../../../lib/utils";

export type DateCalendarHeaderProps = {
  year: number;
  month: number;
  calendarConfig: "static" | "dynamic";
  prevLabel: string;
  nextLabel: string;
  onMonthChange: (year: number, month: number) => void;
  className?: string;
};

/** Calendar header — static title or dynamic month/year selects (Figma 67:14566). */
export function DateCalendarHeader({
  year,
  month,
  calendarConfig,
  prevLabel,
  nextLabel,
  onMonthChange,
  className,
}: DateCalendarHeaderProps) {
  const goMonth = (offset: number) => {
    const date = new Date(year, month - 1 + offset, 1);
    onMonthChange(date.getFullYear(), date.getMonth() + 1);
  };

  return (
    <div className={cn("pds-date-calendar__header", className)}>
      <DatePickerNavButton direction="prev" ariaLabel={prevLabel} onClick={() => goMonth(-1)} />
      {calendarConfig === "dynamic" ? (
        <div className="pds-date-calendar__header-selects">
          <select
            className="pds-type-body-m-medium pds-date-calendar__select"
            aria-label="Month"
            value={month}
            onChange={(event) => onMonthChange(year, Number(event.target.value))}
          >
            {MONTH_LABELS_SHORT.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="pds-type-body-m-medium pds-date-calendar__select"
            aria-label="Year"
            value={year}
            onChange={(event) => onMonthChange(Number(event.target.value), month)}
          >
            {yearOptions(year).map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <span className="pds-type-body-m-medium pds-date-calendar__title">{monthTitle(year, month)}</span>
      )}
      <DatePickerNavButton direction="next" ariaLabel={nextLabel} onClick={() => goMonth(1)} />
    </div>
  );
}
