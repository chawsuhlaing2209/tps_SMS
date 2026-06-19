"use client";

import {
  DATE_RANGE_PRESET_ORDER,
  type DateRangePresetId,
} from "../date-picker-utils";
import { DateCalendarShortcutButton } from "./date-calendar-shortcut-button";

export type DateCalendarPresetsProps = {
  activePreset?: DateRangePresetId;
  labels: Record<DateRangePresetId, string>;
  presets?: DateRangePresetId[];
  onSelect: (preset: DateRangePresetId) => void;
};

/** Preset sidebar for filter range calendar (Figma 67:14723). */
export function DateCalendarPresets({
  activePreset,
  labels,
  presets = DATE_RANGE_PRESET_ORDER,
  onSelect,
}: DateCalendarPresetsProps) {
  return (
    <aside className="pds-date-calendar-presets">
      <div className="pds-date-calendar-presets__list">
        {presets.map((preset) => (
          <DateCalendarShortcutButton
            key={preset}
            label={labels[preset]}
            selected={activePreset === preset}
            onClick={() => onSelect(preset)}
          />
        ))}
      </div>
    </aside>
  );
}
