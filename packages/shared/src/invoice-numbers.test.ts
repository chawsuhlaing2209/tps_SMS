import { describe, expect, it } from "vitest";
import {
  INVOICE_NUMBER_PATTERN,
  buildInvoiceNumber,
  formatInvoiceDatePart
} from "./invoice-numbers.js";

describe("invoice numbers", () => {
  it("formats the date as DDMMYYYY", () => {
    expect(formatInvoiceDatePart(new Date(2026, 5, 18))).toBe("18062026");
  });

  it("builds INV-DDMMYYYY-XXX numbers", () => {
    const value = buildInvoiceNumber(new Date(2026, 5, 18), "A7B");
    expect(value).toBe("INV-18062026-A7B");
    expect(INVOICE_NUMBER_PATTERN.test(value)).toBe(true);
  });
});
