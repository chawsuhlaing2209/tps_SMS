import {
  computeDiscountAmount,
  customRuleMatches,
  earlyPaymentRuleMatches,
  siblingRuleMatches,
  type DiscountRuleCriteria
} from "@sms/shared";
import { formToPayload, type DiscountRuleFormValues } from "./discount-form";

export type DiscountPreviewSample = {
  studentName: string;
  gradeName: string;
  invoiceLabel: string;
  feeLines: import("@sms/shared").DiscountFeeLine[];
  siblingSummary: {
    eligible: boolean;
    enrolledSiblingCount: number;
    studentPosition: number;
  };
};

const SAMPLE_AMOUNTS: Record<string, number> = {
  tuition: 1_200_000,
  registration: 150_000,
  lab: 90_000,
  transport: 160_000,
  lunch: 120_000,
  activities: 70_000,
  other: 100_000
};

export function sampleAmountForFeeType(feeType: string): number {
  return SAMPLE_AMOUNTS[feeType] ?? 100_000;
}

export function buildSampleFeeLines(
  items: Array<{ id: string; name: string; feeType: string; amount?: number }>
) {
  return items.map((item) => ({
    feeItemId: item.id,
    feeItemName: item.name,
    feeType: item.feeType,
    lineTotal: item.amount ?? sampleAmountForFeeType(item.feeType)
  }));
}

export function buildDiscountPreview(
  form: DiscountRuleFormValues,
  sample: DiscountPreviewSample,
  feeTypesByItemId: Record<string, string>,
  options?: { collectPayment?: boolean }
) {
  const collectPayment = options?.collectPayment ?? true;
  const payload = formToPayload(form, feeTypesByItemId);
  const criteria = payload.criteria as DiscountRuleCriteria;
  const appliesTo = criteria.appliesTo;
  const subtotal = sample.feeLines.reduce((sum, line) => sum + line.lineTotal, 0);

  let eligible = true;
  let eligibilityReason = "Matches configured scope";

  if (criteria.type === "sibling") {
    eligible = siblingRuleMatches(criteria, sample.siblingSummary);
    eligibilityReason = eligible
      ? "Sample student qualifies as 2nd enrolled sibling"
      : "Sample student does not meet sibling criteria";
  } else if (criteria.type === "early_payment") {
    eligible = earlyPaymentRuleMatches(criteria, {
      billingContext: form.billingContexts.includes("enrollment") ? "enrollment" : "recurring",
      academicYearId: "preview",
      gradeId: "preview",
      feeLines: sample.feeLines,
      siblingSummary: sample.siblingSummary,
      collectPayment
    });
    eligibilityReason = eligible
      ? "Payment collected at enrollment confirm"
      : "Requires payment at enrollment confirm";
  } else if (criteria.type === "custom") {
    eligible = customRuleMatches(criteria, {
      billingContext: form.billingContexts.includes("enrollment") ? "enrollment" : "recurring",
      academicYearId: "preview",
      gradeId: "preview",
      feeLines: sample.feeLines,
      siblingSummary: sample.siblingSummary,
      collectPayment
    });
    eligibilityReason = eligible
      ? "Custom rule conditions met for sample student"
      : "Sample student does not meet configured conditions";
  } else {
    eligible = false;
    eligibilityReason = "Applied only after staff request and approval";
  }

  const amount =
    eligible && Number(form.value) > 0
      ? computeDiscountAmount(
          sample.feeLines,
          appliesTo,
          payload.valueType,
          Number(form.value)
        )
      : 0;

  return {
    eligible,
    eligibilityReason,
    amount,
    subtotal,
    net: Math.max(subtotal - amount, 0),
    appliesTo,
    ruleName: form.name.trim() || "Discount",
    valueType: payload.valueType
  };
}
