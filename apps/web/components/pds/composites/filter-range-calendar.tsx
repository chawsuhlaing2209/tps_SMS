"use client";

import * as React from "react";
import {
  addMonths,
  DATE_RANGE_PRESET_ORDER,
  getDateRangePreset,
  matchDateRangePreset,
  type DateParts,
  type DateRangePresetId,
  type WeekStartsOn,
} from "../date-picker-utils";
import { DateCalendarFilterFooter } from "../subcomponents/date-calendar-filter-footer";
import { DateCalendarMonthGrid } from "../subcomponents/date-calendar-month-grid";
import { DateCalendarPresets } from "../subcomponents/date-calendar-presets";

export type FilterRangeCalendarPresetLabels = Record<DateRangePresetId, string>;

export const DEFAULT_FILTER_RANGE_PRESET_LABELS: FilterRangeCalendarPresetLabels = {
  today: "Today",
  "this-week": "This week",
  "last-7-days": "Last 7 days",
  "this-month": "This month",
  "last-month": "Last month",
  "all-time": "All time",
};

export type FilterRangeCalendarProps = {
  range?: { start?: DateParts; end?: DateParts };
  weekStartsOn?: WeekStartsOn;
  presetLabels?: FilterRangeCalendarPresetLabels;
  presets?: DateRangePresetId[];
  onRangeChange: (range: { start: DateParts; end?: DateParts }) => void;
  onConfirm?: () => void;
  /** Clears the range entirely ("All time"). The preset is hidden when omitted. */
  onClear?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  okayLabel?: string;
};

/** Filter range calendar — presets + two months (Figma 67:14722). */
export function FilterRangeCalendar({
  range,
  weekStartsOn = "sunday",
  presetLabels = DEFAULT_FILTER_RANGE_PRESET_LABELS,
  presets,
  onRangeChange,
  onConfirm,
  onClear,
  prevLabel = "Previous month",
  nextLabel = "Next month",
  okayLabel = "Okay",
}: FilterRangeCalendarProps) {
  const anchor = range?.start ?? getDateRangePreset("today", weekStartsOn).start;
  const [leftYear, setLeftYear] = React.useState(anchor.year);
  const [leftMonth, setLeftMonth] = React.useState(anchor.month);

  React.useEffect(() => {
    if (range?.start) {
      setLeftYear(range.start.year);
      setLeftMonth(range.start.month);
    }
  }, [range?.start?.day, range?.start?.month, range?.start?.year]);

  const rightMonth = React.useMemo(() => addMonths(leftYear, leftMonth, 1), [leftMonth, leftYear]);

  const activePreset = React.useMemo(() => {
    // An empty range means the filter is off — that's the "All time" state.
    if (onClear && !range?.start && !range?.end) return "all-time" as const;
    return matchDateRangePreset(range, weekStartsOn);
  }, [onClear, range, weekStartsOn]);

  const resolvedPresets = React.useMemo(() => {
    const base = presets ?? DATE_RANGE_PRESET_ORDER;
    return onClear ? base : base.filter((preset) => preset !== "all-time");
  }, [onClear, presets]);

  const handlePreset = (preset: DateRangePresetId) => {
    if (preset === "all-time") {
      onClear?.();
      return;
    }
    const next = getDateRangePreset(preset, weekStartsOn);
    onRangeChange(next);
    setLeftYear(next.start.year);
    setLeftMonth(next.start.month);
  };

  return (
    <div className="pds-filter-range-calendar" data-accent="lime" data-figma-node="67:14722">
      <DateCalendarPresets
        activePreset={activePreset}
        labels={presetLabels}
        presets={resolvedPresets}
        onSelect={handlePreset}
      />
      <div className="pds-filter-range-calendar__body">
        <div className="pds-filter-range-calendar__months">
          <DateCalendarMonthGrid
            className="pds-filter-range-calendar__month"
            year={leftYear}
            month={leftMonth}
            variant="range"
            accent="lime"
            calendarConfig="static"
            weekStartsOn={weekStartsOn}
            range={range}
            onMonthChange={(year, month) => {
              setLeftYear(year);
              setLeftMonth(month);
            }}
            onRangeChange={onRangeChange}
            prevLabel={prevLabel}
            nextLabel={nextLabel}
          />
          <DateCalendarMonthGrid
            className="pds-filter-range-calendar__month"
            year={rightMonth.year}
            month={rightMonth.month}
            variant="range"
            accent="lime"
            calendarConfig="static"
            weekStartsOn={weekStartsOn}
            range={range}
            onMonthChange={(year, month) => {
              const shifted = addMonths(year, month, -1);
              setLeftYear(shifted.year);
              setLeftMonth(shifted.month);
            }}
            onRangeChange={onRangeChange}
            prevLabel={prevLabel}
            nextLabel={nextLabel}
          />
        </div>
        <DateCalendarFilterFooter okayLabel={okayLabel} onOkay={onConfirm} />
      </div>
    </div>
  );
}
