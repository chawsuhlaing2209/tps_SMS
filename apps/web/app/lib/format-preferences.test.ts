import { describe, expect, it } from "vitest";
import {
  formatPreferredDate,
  formatPreferredDateTime,
  formatPreferredMoney,
  formatPreferredMonth,
  formatPreferredTime
} from "./format-preferences";

describe("formatPreferredDate", () => {
  const sample = "2026-07-03";

  it("defaults to DD/MM/YYYY", () => {
    expect(formatPreferredDate(sample)).toBe("03/07/2026");
  });

  it("honors every supported dateFormat", () => {
    expect(formatPreferredDate(sample, { dateFormat: "DD/MM/YYYY" })).toBe("03/07/2026");
    expect(formatPreferredDate(sample, { dateFormat: "MM/DD/YYYY" })).toBe("07/03/2026");
    expect(formatPreferredDate(sample, { dateFormat: "YYYY-MM-DD" })).toBe("2026-07-03");
    expect(formatPreferredDate(sample, { dateFormat: "DD MMM YYYY" })).toBe("03 Jul 2026");
  });

  it("keeps date-only strings on their calendar day regardless of timezone", () => {
    expect(formatPreferredDate("2026-01-01", { dateFormat: "YYYY-MM-DD" })).toBe("2026-01-01");
  });

  it("accepts Date objects and full ISO timestamps", () => {
    expect(formatPreferredDate(new Date(2026, 11, 25), { dateFormat: "DD MMM YYYY" })).toBe(
      "25 Dec 2026"
    );
  });

  it("returns an em dash for empty or invalid input", () => {
    expect(formatPreferredDate(null)).toBe("—");
    expect(formatPreferredDate(undefined)).toBe("—");
    expect(formatPreferredDate("")).toBe("—");
    expect(formatPreferredDate("not-a-date")).toBe("—");
  });
});

describe("formatPreferredTime", () => {
  const afternoon = new Date(2026, 6, 3, 14, 5);
  const morning = new Date(2026, 6, 3, 9, 30);
  const midnight = new Date(2026, 6, 3, 0, 0);
  const noon = new Date(2026, 6, 3, 12, 0);

  it("formats 12h by default", () => {
    expect(formatPreferredTime(afternoon)).toBe("2:05 PM");
    expect(formatPreferredTime(morning)).toBe("9:30 AM");
  });

  it("handles midnight and noon in 12h mode", () => {
    expect(formatPreferredTime(midnight, { timeFormat: "12h" })).toBe("12:00 AM");
    expect(formatPreferredTime(noon, { timeFormat: "12h" })).toBe("12:00 PM");
  });

  it("formats 24h with zero padding", () => {
    expect(formatPreferredTime(afternoon, { timeFormat: "24h" })).toBe("14:05");
    expect(formatPreferredTime(morning, { timeFormat: "24h" })).toBe("09:30");
    expect(formatPreferredTime(midnight, { timeFormat: "24h" })).toBe("00:00");
  });

  it("returns an em dash for invalid input", () => {
    expect(formatPreferredTime(null)).toBe("—");
  });
});

describe("formatPreferredDateTime", () => {
  it("joins date and time with the shared preferences", () => {
    const value = new Date(2026, 6, 3, 14, 5);
    expect(
      formatPreferredDateTime(value, { dateFormat: "DD MMM YYYY", timeFormat: "24h" })
    ).toBe("03 Jul 2026, 14:05");
  });

  it("returns an em dash for invalid input", () => {
    expect(formatPreferredDateTime("nope")).toBe("—");
  });
});

describe("formatPreferredMonth", () => {
  it("renders a month name by default", () => {
    expect(formatPreferredMonth("2026-07")).toBe("Jul 2026");
  });

  it("stays numeric for YYYY-MM-DD tenants", () => {
    expect(formatPreferredMonth("2026-07", { dateFormat: "YYYY-MM-DD" })).toBe("2026-07");
  });

  it("returns an em dash for malformed input", () => {
    expect(formatPreferredMonth(null)).toBe("—");
    expect(formatPreferredMonth("2026")).toBe("—");
    expect(formatPreferredMonth("2026-13")).toBe("—");
  });
});

describe("formatPreferredMoney", () => {
  it("keeps the formatMMK contract for MMK", () => {
    expect(formatPreferredMoney(5300000)).toBe("5,300,000 MMK");
    expect(formatPreferredMoney(5300000, { currency: "MMK" })).toBe("5,300,000 MMK");
  });

  it("formats other currencies with up to two decimals", () => {
    expect(formatPreferredMoney(1250.5, { currency: "USD" })).toBe("1,250.5 USD");
    expect(formatPreferredMoney(90000, { currency: "THB" })).toBe("90,000 THB");
  });
});
