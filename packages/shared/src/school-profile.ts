import { z } from "zod";

/** School classification shown on the profile and official documents. */
export const SCHOOL_TYPES = [
  "private",
  "international",
  "monastic",
  "public",
  "tutoring",
  "other"
] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

/** Display formats offered in tenant preferences. Tokens follow dayjs/Luxon style. */
export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const TIME_FORMATS = ["12h", "24h"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const SUPPORTED_LANGUAGES = ["en", "my"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Common currencies for Myanmar schools; the API accepts any ISO-like code. */
export const COMMON_CURRENCIES = ["MMK", "USD", "THB", "SGD"] as const;

/** Common timezones offered in preferences; the API accepts any IANA zone. */
export const COMMON_TIMEZONES = [
  "Asia/Yangon",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "UTC"
] as const;

const optionalTrimmed = (max: number) => z.string().trim().max(max).nullable().optional();

/**
 * Empty strings are accepted so the form can bind text inputs directly; callers
 * normalize "" to null before persisting (see normalizeSchoolProfileInput).
 */
export const schoolProfileSchema = z.object({
  schoolName: z.string().trim().min(1).max(160),
  schoolType: z.enum(SCHOOL_TYPES).nullable().optional(),
  motto: optionalTrimmed(240),
  address: optionalTrimmed(400),
  contactEmail: z.literal("").or(z.string().trim().email()).nullable().optional(),
  contactPhone: optionalTrimmed(40),
  principalName: optionalTrimmed(120),
  registrationNumber: optionalTrimmed(80),
  establishedYear: z.number().int().min(1800).max(2200).nullable().optional()
});

export type SchoolProfileInput = z.infer<typeof schoolProfileSchema>;

/** Collapse empty-string form values to null for persistence. */
export function normalizeSchoolProfileInput(input: SchoolProfileInput): SchoolProfileInput {
  const nullIfEmpty = <T extends string>(value: T | null | undefined): T | null =>
    value == null || value.trim() === "" ? null : value;

  return {
    schoolName: input.schoolName.trim(),
    schoolType: input.schoolType ?? null,
    motto: nullIfEmpty(input.motto),
    address: nullIfEmpty(input.address),
    contactEmail: nullIfEmpty(input.contactEmail),
    contactPhone: nullIfEmpty(input.contactPhone),
    principalName: nullIfEmpty(input.principalName),
    registrationNumber: nullIfEmpty(input.registrationNumber),
    establishedYear: input.establishedYear ?? null
  };
}

export const tenantPreferencesSchema = z.object({
  defaultLanguage: z.enum(SUPPORTED_LANGUAGES),
  currency: z.string().trim().min(3).max(8),
  timezone: z.string().trim().min(1).max(64),
  dateFormat: z.enum(DATE_FORMATS),
  timeFormat: z.enum(TIME_FORMATS)
});

export type TenantPreferences = z.infer<typeof tenantPreferencesSchema>;
