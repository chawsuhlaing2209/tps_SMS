import { describe, expect, it } from "vitest";
import { featureFlags, productDecisionDefaults } from "./index.js";

describe("product decision defaults", () => {
  it("keeps first tenant rollout focused on staff workflows", () => {
    expect(productDecisionDefaults.parentPortalInFirstGoLive).toBe(false);
    expect(productDecisionDefaults.studentPortalInFirstGoLive).toBe(false);
    expect(productDecisionDefaults.paymentGatewayInFirstGoLive).toBe(false);
  });

  it("keeps deferred capabilities behind feature flags", () => {
    expect(featureFlags).toContain("staff_attendance_salary_inputs");
    expect(featureFlags).toContain("student_file_submissions");
    expect(featureFlags).toContain("family_level_invoices");
  });
});
