"use client";

import * as React from "react";
import "../date-picker.css";
import { cn } from "../../../lib/utils";
import { DatePickerTrigger } from "../subcomponents/date-picker-trigger";
import { DatePickerPosition } from "./date-picker-position";
import { MonthCalendar } from "./month-calendar";
import { DateCalendar } from "./date-calendar";
import { FilterRangeCalendar } from "./filter-range-calendar";
import {
  formatDayLabel,
  formatDayRangeLabel,
  formatMonthLabel,
  parseDayRangeValue,
  parseDayValue,
  parseMonthValue,
  toDayRangeValue,
  toDayValue,
  toMonthValue,
  type DateParts,
  type WeekStartsOn,
} from "../date-picker-utils";

export type PdsDatePickerVariant = "form" | "filter";
export type PdsDatePickerType = "day" | "month";
export type PdsDatePickerCalendarConfig = "static" | "dynamic";
export type PdsDatePickerSelectionMode = "single" | "range";
export type PdsDatePickerInputState = "enabled" | "error" | "disabled";

export type PdsDatePickerProps = {
  /** Form field (full width) or compact toolbar filter. */
  variant?: PdsDatePickerVariant;
  /** Day grid or month grid. */
  type?: PdsDatePickerType;
  /** Single date or inclusive range (`YYYY-MM-DD/YYYY-MM-DD`). Day type only. */
  selectionMode?: PdsDatePickerSelectionMode;
  /** Static month title or dynamic month/year selects in the calendar header. */
  calendarConfig?: PdsDatePickerCalendarConfig;
  weekStartsOn?: WeekStartsOn;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputState?: PdsDatePickerInputState;
  /** Show Today/Okay footer and commit on Okay (form day pickers). */
  confirmOnSelect?: boolean;
  ariaLabel?: string;
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
  todayLabel?: string;
  okayLabel?: string;
  /** Labels for filter range preset shortcuts. */
  presetLabels?: import("./filter-range-calendar").FilterRangeCalendarPresetLabels;
};

function defaultCalendarConfig(variant: PdsDatePickerVariant, type: PdsDatePickerType) {
  if (type === "month") return "static" as const;
  return variant === "form" ? "dynamic" : "static";
}

function defaultConfirmOnSelect(
  variant: PdsDatePickerVariant,
  type: PdsDatePickerType,
  selectionMode: PdsDatePickerSelectionMode
) {
  if (type === "month") return false;
  if (selectionMode === "range") return true;
  return false;
}

/** Full date picker — trigger + calendar panel (Figma 67:14870). */
export function PdsDatePicker({
  variant = "form",
  type = "day",
  selectionMode = "single",
  calendarConfig,
  value,
  onValueChange,
  placeholder = "Pick a date",
  disabled,
  inputState = "enabled",
  confirmOnSelect,
  weekStartsOn,
  ariaLabel,
  className,
  prevLabel = "Previous",
  nextLabel = "Next",
  todayLabel = "Today",
  okayLabel = "Okay",
  presetLabels,
}: PdsDatePickerProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const isDisabled = disabled || inputState === "disabled";
  const [open, setOpen] = React.useState(false);

  const resolvedCalendarConfig =
    calendarConfig ?? defaultCalendarConfig(variant, type);
  const resolvedConfirmOnSelect =
    confirmOnSelect ?? defaultConfirmOnSelect(variant, type, selectionMode);

  const parsedMonth = parseMonthValue(type === "month" ? value : undefined);
  const parsedDay = parseDayValue(
    type === "day" && selectionMode === "single" ? value : undefined
  );
  const parsedRange = parseDayRangeValue(
    type === "day" && selectionMode === "range" ? value : undefined
  );

  const anchor = parsedDay ?? parsedRange?.start ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: 1 };

  const [viewYear, setViewYear] = React.useState(anchor.year);
  const [viewMonth, setViewMonth] = React.useState(anchor.month);
  const [draftDay, setDraftDay] = React.useState<DateParts | undefined>(parsedDay ?? undefined);
  const [draftRange, setDraftRange] = React.useState<{ start?: DateParts; end?: DateParts }>(
    parsedRange ?? {}
  );

  React.useEffect(() => {
    if (type === "month") {
      const month = parseMonthValue(value);
      if (!month) return;
      setViewYear((current) => (current === month.year ? current : month.year));
      setViewMonth((current) => (current === month.month ? current : month.month));
      return;
    }

    if (selectionMode === "range") {
      const range = parseDayRangeValue(value);
      if (!range) return;
      setViewYear((current) => (current === range.start.year ? current : range.start.year));
      setViewMonth((current) => (current === range.start.month ? current : range.start.month));
      setDraftRange((current) => {
        const sameStart =
          current.start?.year === range.start.year &&
          current.start?.month === range.start.month &&
          current.start?.day === range.start.day;
        const sameEnd =
          current.end?.year === range.end.year &&
          current.end?.month === range.end.month &&
          current.end?.day === range.end.day;
        return sameStart && sameEnd ? current : range;
      });
      return;
    }

    const day = parseDayValue(value);
    if (!day) return;
    setViewYear((current) => (current === day.year ? current : day.year));
    setViewMonth((current) => (current === day.month ? current : day.month));
    setDraftDay((current) =>
      current?.year === day.year && current?.month === day.month && current?.day === day.day
        ? current
        : day
    );
  }, [selectionMode, type, value]);

  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const displayValue = React.useMemo(() => {
    if (type === "month") return formatMonthLabel(value, "long");
    if (selectionMode === "range") return formatDayRangeLabel(value);
    return formatDayLabel(value, variant);
  }, [selectionMode, type, value, variant]);

  const commitMonth = (month: number) => {
    onValueChange?.(toMonthValue(viewYear, month));
    setOpen(false);
  };

  const commitDay = (date: DateParts) => {
    onValueChange?.(toDayValue(date.year, date.month, date.day));
    if (!resolvedConfirmOnSelect) setOpen(false);
  };

  const commitRange = (range: { start: DateParts; end: DateParts }) => {
    onValueChange?.(toDayRangeValue(range.start, range.end));
    if (!resolvedConfirmOnSelect) setOpen(false);
  };

  const handleDaySelect = (date: DateParts) => {
    setDraftDay(date);
    if (!resolvedConfirmOnSelect) {
      commitDay(date);
    }
  };

  const handleRangeChange = (range: { start: DateParts; end: DateParts }) => {
    setDraftRange(range);
    if (!resolvedConfirmOnSelect && range.start && range.end) {
      commitRange(range);
    }
  };

  const jumpToToday = () => {
    const now = new Date();
    const today = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
    setViewYear(today.year);
    setViewMonth(today.month);
    if (selectionMode === "range") {
      setDraftRange({ start: today, end: today });
      return;
    }
    setDraftDay(today);
    if (!resolvedConfirmOnSelect) {
      commitDay(today);
    }
  };

  const confirmSelection = () => {
    if (type === "month") return;
    if (selectionMode === "range" && draftRange.start && draftRange.end) {
      commitRange({ start: draftRange.start, end: draftRange.end });
      setOpen(false);
      return;
    }
    if (draftDay) {
      commitDay(draftDay);
      setOpen(false);
    }
  };

  const useFilterRangeCalendar =
    variant === "filter" && type === "day" && selectionMode === "range";

  const panelClassName = cn(
    type === "day" && !useFilterRangeCalendar && "pds-date-picker-position__panel--day",
    useFilterRangeCalendar && "pds-date-picker-position__panel--filter-range"
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "pds-date-picker",
        variant === "form" && "pds-date-picker--form",
        variant === "filter" && "pds-date-picker--filter",
        type === "day" && "pds-date-picker--day",
        className
      )}
      data-figma-node="67:14870"
      data-variant={variant}
      data-type={type}
      data-selection-mode={selectionMode}
      data-calendar-config={resolvedCalendarConfig}
    >
      <DatePickerTrigger
        variant={variant}
        open={open}
        disabled={isDisabled}
        error={inputState === "error"}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        valueLabel={displayValue}
        showingPlaceholder={!displayValue}
        onClick={() => {
          if (isDisabled) return;
          setOpen((current) => !current);
        }}
      />
      <DatePickerPosition open={open} panelClassName={panelClassName}>
        {type === "month" ? (
          <MonthCalendar
            year={viewYear}
            selectedMonth={parsedMonth?.year === viewYear ? parsedMonth.month : undefined}
            onYearChange={setViewYear}
            onMonthSelect={commitMonth}
            prevYearLabel={prevLabel}
            nextYearLabel={nextLabel}
          />
        ) : useFilterRangeCalendar ? (
          <FilterRangeCalendar
            range={draftRange}
            weekStartsOn={weekStartsOn ?? "sunday"}
            presetLabels={presetLabels}
            onRangeChange={handleRangeChange}
            onConfirm={confirmSelection}
            prevLabel={prevLabel}
            nextLabel={nextLabel}
            okayLabel={okayLabel}
          />
        ) : (
          <DateCalendar
            variant={selectionMode === "range" ? "range" : "default"}
            accent={variant === "filter" ? "shell" : "lime"}
            calendarConfig={resolvedCalendarConfig}
            weekStartsOn={weekStartsOn}
            year={viewYear}
            month={viewMonth}
            selectedDay={draftDay}
            range={draftRange}
            showFooter={resolvedConfirmOnSelect}
            onMonthChange={(year, month) => {
              setViewYear(year);
              setViewMonth(month);
            }}
            onDaySelect={handleDaySelect}
            onRangeChange={handleRangeChange}
            onToday={jumpToToday}
            onConfirm={confirmSelection}
            prevLabel={prevLabel}
            nextLabel={nextLabel}
            todayLabel={todayLabel}
            okayLabel={okayLabel}
          />
        )}
      </DatePickerPosition>
    </div>
  );
}
