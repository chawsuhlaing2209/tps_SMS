export const productDecisionDefaults = {
  firstTenantSalaryScope: "salary_payment_records_only",
  lmsSubmissionScope: "teacher_completion_tracking_first",
  financeInvoiceScope: "per_student_invoices_with_family_balance_grouping",
  parentPortalInFirstGoLive: false,
  studentPortalInFirstGoLive: false,
  paymentGatewayInFirstGoLive: false,
  activeMultiBranchInFirstGoLive: false,
  reportCardRankingDefaultEnabled: false,
  officialDocumentDateSystem: "gregorian_with_burmese_english_labels",
  nextNonEmailChannelDecisionPoint: "after_first_tenant_feedback"
} as const;

export type ProductDecisionKey = keyof typeof productDecisionDefaults;
