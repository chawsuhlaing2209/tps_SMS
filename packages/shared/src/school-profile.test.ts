import { describe, expect, it } from "vitest";
import {
  normalizeSchoolProfileInput,
  schoolProfileSchema,
  tenantPreferencesSchema
} from "./school-profile.js";

describe("schoolProfileSchema", () => {
  it("accepts a minimal profile (name only)", () => {
    const parsed = schoolProfileSchema.safeParse({ schoolName: "Aung Myint Myat Private School" });
    expect(parsed.success).toBe(true);
  });

  it("accepts empty-string email (form binding) but rejects malformed email", () => {
    expect(
      schoolProfileSchema.safeParse({ schoolName: "S", contactEmail: "" }).success
    ).toBe(true);
    expect(
      schoolProfileSchema.safeParse({ schoolName: "S", contactEmail: "not-an-email" }).success
    ).toBe(false);
  });

  it("rejects a blank name and an implausible established year", () => {
    expect(schoolProfileSchema.safeParse({ schoolName: "   " }).success).toBe(false);
    expect(
      schoolProfileSchema.safeParse({ schoolName: "S", establishedYear: 1500 }).success
    ).toBe(false);
  });

  it("rejects unknown school types", () => {
    expect(
      schoolProfileSchema.safeParse({ schoolName: "S", schoolType: "hogwarts" }).success
    ).toBe(false);
  });
});

describe("normalizeSchoolProfileInput", () => {
  it("collapses empty strings and whitespace to null and trims the name", () => {
    const normalized = normalizeSchoolProfileInput({
      schoolName: "  My School  ",
      schoolType: undefined,
      motto: "",
      address: "  ",
      contactEmail: "",
      contactPhone: "09-777",
      principalName: undefined,
      registrationNumber: null,
      establishedYear: undefined
    });

    expect(normalized).toEqual({
      schoolName: "My School",
      schoolType: null,
      motto: null,
      address: null,
      contactEmail: null,
      contactPhone: "09-777",
      principalName: null,
      registrationNumber: null,
      establishedYear: null
    });
  });
});

describe("tenantPreferencesSchema", () => {
  const valid = {
    defaultLanguage: "en",
    currency: "MMK",
    timezone: "Asia/Yangon",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h"
  };

  it("accepts a valid preferences payload", () => {
    expect(tenantPreferencesSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unsupported language, date format, and time format", () => {
    expect(tenantPreferencesSchema.safeParse({ ...valid, defaultLanguage: "fr" }).success).toBe(false);
    expect(tenantPreferencesSchema.safeParse({ ...valid, dateFormat: "YYYY/DD/MM" }).success).toBe(false);
    expect(tenantPreferencesSchema.safeParse({ ...valid, timeFormat: "24hr" }).success).toBe(false);
  });
});
