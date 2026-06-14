export const productModules = [
  "tenant_school_configuration",
  "authentication_rbac_security",
  "school_calendar",
  "leads_enquiries",
  "student_management",
  "hr_management",
  "salary_management",
  "academic_year_subjects",
  "classroom_management",
  "timetable_management",
  "attendance",
  "learning_management",
  "exam_management",
  "grading",
  "report_cards",
  "enrollment_fees",
  "discounts",
  "financial_management",
  "email_notifications"
] as const;

export type ProductModule = (typeof productModules)[number];

export const featureFlags = [
  "parent_portal",
  "student_portal",
  "multi_branch",
  "payment_gateway",
  "biometric_attendance",
  "sms_notifications",
  "viber_notifications",
  "messenger_notifications",
  "advanced_analytics",
  "staff_attendance_salary_inputs",
  "student_file_submissions",
  "family_level_invoices"
] as const;

export type FeatureFlag = (typeof featureFlags)[number];
