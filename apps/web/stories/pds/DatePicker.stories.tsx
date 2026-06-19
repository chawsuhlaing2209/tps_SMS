import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DateCalendar } from "../../components/pds/composites/date-calendar";
import { FilterRangeCalendar } from "../../components/pds/composites/filter-range-calendar";
import { PdsDatePicker } from "../../components/pds/composites/date-picker";
import { pdsCanvasDecorator } from "./decorators";

const meta: Meta<typeof PdsDatePicker> = {
  title: "PDS/DatePicker",
  component: PdsDatePicker,
  tags: ["autodocs"],
  decorators: [pdsCanvasDecorator],
  args: {
    placeholder: "Pick a date",
    variant: "form",
    type: "day",
    selectionMode: "single",
  },
  argTypes: {
    variant: { control: "select", options: ["form", "filter"] },
    type: { control: "select", options: ["day", "month"] },
    selectionMode: { control: "select", options: ["single", "range"] },
    calendarConfig: { control: "select", options: ["static", "dynamic"] },
    inputState: { control: "select", options: ["enabled", "error", "disabled"] },
  },
};

export default meta;
type Story = StoryObj<typeof PdsDatePicker>;

export const DayFormDynamic: Story = {
  render: function DayFormDynamicDemo() {
    const [value, setValue] = useState("");
    return (
      <div style={{ width: 280 }}>
        <PdsDatePicker
          type="day"
          variant="form"
          calendarConfig="dynamic"
          value={value}
          onValueChange={setValue}
        />
      </div>
    );
  },
};

export const DayFilterStatic: Story = {
  render: function DayFilterStaticDemo() {
    const [value, setValue] = useState("2026-06-03");
    return (
      <div style={{ width: 420 }}>
        <PdsDatePicker
          type="day"
          variant="filter"
          calendarConfig="static"
          value={value}
          onValueChange={setValue}
          placeholder="Date"
        />
      </div>
    );
  },
};

export const DayRangeForm: Story = {
  render: function DayRangeDemo() {
    const [value, setValue] = useState("2026-06-11/2026-06-17");
    return (
      <div style={{ width: 280 }}>
        <PdsDatePicker
          type="day"
          variant="form"
          selectionMode="range"
          calendarConfig="static"
          value={value}
          onValueChange={setValue}
        />
      </div>
    );
  },
};

export const DayRangeFilter: Story = {
  render: function DayRangeFilterDemo() {
    const [value, setValue] = useState("2026-06-11/2026-06-17");
    return (
      <div style={{ width: 420 }}>
        <PdsDatePicker
          type="day"
          variant="filter"
          selectionMode="range"
          value={value}
          onValueChange={setValue}
          placeholder="Date range"
        />
      </div>
    );
  },
};

export const FilterRangeCalendarStandalone: StoryObj<typeof FilterRangeCalendar> = {
  render: function FilterRangeCalendarDemo() {
    const [range, setRange] = useState({
      start: { year: 2026, month: 1, day: 10 },
      end: { year: 2026, month: 2, day: 17 },
    });
    return (
      <FilterRangeCalendar
        range={range}
        onRangeChange={setRange}
        onConfirm={() => undefined}
      />
    );
  },
};

export const MonthFilter: Story = {
  render: function MonthFilterDemo() {
    const [value, setValue] = useState("2026-06");
    return (
      <div style={{ width: 420 }}>
        <PdsDatePicker
          type="month"
          variant="filter"
          value={value}
          onValueChange={setValue}
          placeholder="Month"
        />
      </div>
    );
  },
};

export const CalendarSingle: StoryObj<typeof DateCalendar> = {
  render: function CalendarSingleDemo() {
    const [value, setValue] = useState<{ year: number; month: number; day: number } | undefined>({
      year: 2026,
      month: 6,
      day: 3,
    });
    const [year, setYear] = useState(2026);
    const [month, setMonth] = useState(6);
    return (
      <DateCalendar
        variant="default"
        accent="shell"
        calendarConfig="static"
        year={year}
        month={month}
        selectedDay={value}
        showFooter
        onMonthChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
        onDaySelect={setValue}
        onToday={() => {
          const now = new Date();
          setYear(now.getFullYear());
          setMonth(now.getMonth() + 1);
          setValue({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
        }}
        onConfirm={() => undefined}
      />
    );
  },
};

export const CalendarRange: StoryObj<typeof DateCalendar> = {
  render: function CalendarRangeDemo() {
    const [range, setRange] = useState({
      start: { year: 2026, month: 6, day: 11 },
      end: { year: 2026, month: 6, day: 17 },
    });
    return (
      <DateCalendar
        variant="range"
        accent="lime"
        calendarConfig="static"
        year={2026}
        month={6}
        range={range}
        showFooter
        onMonthChange={() => undefined}
        onRangeChange={setRange}
        onConfirm={() => undefined}
      />
    );
  },
};
