import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const schoolOperatingHourBlockSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(80).optional().nullable(),
  startsAt: z.string().regex(timePattern),
  endsAt: z.string().regex(timePattern),
  isPrimary: z.boolean(),
  sortOrder: z.number().int().min(0)
});

export const schoolScheduleSettingsSchema = z.object({
  shortBreakStartsAt: z.string().regex(timePattern).nullable().optional(),
  shortBreakEndsAt: z.string().regex(timePattern).nullable().optional(),
  lunchBreakStartsAt: z.string().regex(timePattern).nullable().optional(),
  lunchBreakEndsAt: z.string().regex(timePattern).nullable().optional(),
  periodDurationMinutes: z.number().int().min(15).max(120),
  workingDays: z.array(z.number().int().min(1).max(7)).min(1),
  operatingHourBlocks: z.array(schoolOperatingHourBlockSchema).min(1)
});

export type SchoolOperatingHourBlock = z.infer<typeof schoolOperatingHourBlockSchema>;
export type SchoolScheduleSettings = z.infer<typeof schoolScheduleSettingsSchema>;

export const PERIOD_TYPES = ["lesson", "short_break", "lunch_break"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];
