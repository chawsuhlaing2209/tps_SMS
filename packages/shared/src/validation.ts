import { z } from "zod";

export const tenantSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

export const myanmarPhoneSchema = z
  .string()
  .trim()
  .regex(/^(\+?95|0)9\d{7,10}$/, "Enter a valid Myanmar mobile number.");

export const emailOrPhoneSchema = z.union([
  z.string().email(),
  myanmarPhoneSchema
]);

export const tenantCreateSchema = z.object({
  name: z.string().min(1).max(160),
  slug: tenantSlugSchema,
  timezone: z.string().default("Asia/Yangon"),
  defaultLanguage: z.enum(["my", "en"]).default("en"),
  currency: z.literal("MMK").default("MMK")
});

export const auditEventSchema = z.object({
  tenantId: z.string().uuid().nullable(),
  actorUserId: z.string().uuid().nullable(),
  action: z.string().min(1),
  recordType: z.string().min(1),
  recordId: z.string().min(1),
  reason: z.string().optional()
});

/** Non-empty reason required for attendance, finance, and grading corrections. */
export const correctionReasonSchema = z
  .string()
  .trim()
  .min(1, "A correction reason is required.");

export const SENSITIVE_CORRECTION_ACTIONS = [
  "attendance.correct",
  "payment.refund",
  "payment.verify",
  "assessment.correct"
] as const;

export type SensitiveCorrectionAction = (typeof SENSITIVE_CORRECTION_ACTIONS)[number];

export function parseCorrectionReason(reason: unknown): string {
  return correctionReasonSchema.parse(reason);
}

/** Inclusive bounds for user-entered percentage amounts (0–100). */
export const PERCENT_MIN = 0;
export const PERCENT_MAX = 100;
export const PERCENT_RANGE_MESSAGE = "Enter a percentage between 0 and 100.";

export function parsePercentString(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function isPercentInRange(value: number): boolean {
  return Number.isFinite(value) && value >= PERCENT_MIN && value <= PERCENT_MAX;
}

export function clampPercentValue(value: number): number {
  if (!Number.isFinite(value)) return PERCENT_MIN;
  return Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, value));
}

export function clampPercentString(value: string): string {
  if (value === "" || value === "-") return value;
  const num = parsePercentString(value);
  if (num === null) return value;
  if (num > PERCENT_MAX) return String(PERCENT_MAX);
  if (num < PERCENT_MIN) return String(PERCENT_MIN);
  return value;
}

export function assertPercentInRange(
  value: number,
  message: string = PERCENT_RANGE_MESSAGE
): void {
  if (!isPercentInRange(value)) {
    throw new Error(message);
  }
}

export const percentAmountSchema = z
  .number()
  .min(PERCENT_MIN, PERCENT_RANGE_MESSAGE)
  .max(PERCENT_MAX, PERCENT_RANGE_MESSAGE);

export function addPercentStringIssue(
  ctx: z.RefinementCtx,
  value: string,
  path: (string | number)[],
  message: string = PERCENT_RANGE_MESSAGE
): boolean {
  const num = parsePercentString(value);
  if (num === null || !isPercentInRange(num)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    return false;
  }
  return true;
}

export const gradeChiefAssignmentItemSchema = z.object({
  academicYearId: z.string().uuid(),
  gradeId: z.string().uuid()
});

export const homeroomAssignmentItemSchema = z.object({
  classroomId: z.string().uuid()
});

export const subjectAssignmentItemSchema = z.object({
  classroomId: z.string().uuid(),
  subjectId: z.string().uuid()
});

export const updateTeacherAssignmentsSchema = z
  .object({
    gradeChief: z.array(gradeChiefAssignmentItemSchema).default([]),
    homeroom: z.array(homeroomAssignmentItemSchema).default([]),
    subjectTeaching: z.array(subjectAssignmentItemSchema).default([])
  })
  .superRefine((data, ctx) => {
    if (data.homeroom.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A teacher can only be homeroom teacher for one classroom.",
        path: ["homeroom"]
      });
    }
    if (data.gradeChief.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A teacher can only be grade chief for one grade.",
        path: ["gradeChief"]
      });
    }
  });

export type UpdateTeacherAssignmentsInput = z.infer<typeof updateTeacherAssignmentsSchema>;

export const teacherProfileCapabilitySchema = z.object({
  sectorIds: z.array(z.string().uuid()).default([]),
  competentSubjectIds: z.array(z.string().uuid()).default([]),
  eligibleGradeIds: z.array(z.string().uuid()).default([])
});

export type TeacherProfileCapabilityInput = z.infer<typeof teacherProfileCapabilitySchema>;

export const updateTeacherTeachingSetupSchema = z.object({
  capability: teacherProfileCapabilitySchema,
  assignments: updateTeacherAssignmentsSchema
});

export type UpdateTeacherTeachingSetupInput = z.infer<typeof updateTeacherTeachingSetupSchema>;

export const personTypes = ["teacher", "admin_staff", "accountant", "other"] as const;
export type PersonType = (typeof personTypes)[number];

export const personTypeToRoleKey: Record<PersonType, string> = {
  teacher: "teacher",
  admin_staff: "school_admin",
  accountant: "accountant",
  other: "hr_staff"
};

export const staffQualificationSchema = z.object({
  title: z.string().trim().min(1),
  institution: z.string().trim().optional(),
  year: z.string().trim().optional()
});

export type StaffQualification = z.infer<typeof staffQualificationSchema>;

export const provisionStaffSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.string().email(),
  phone: myanmarPhoneSchema,
  roleKey: z.string().trim().min(1),
  /** @deprecated Use roleKey — kept for backward-compatible API clients. */
  personType: z.enum(personTypes).optional(),
  createLogin: z.boolean().default(true),
  rbacRoleKey: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  department: z.string().optional(),
  joinDate: z.string().optional(),
  promotionTitle: z.string().trim().optional(),
  qualifications: z.array(staffQualificationSchema).optional(),
  teacherAssignments: updateTeacherAssignmentsSchema.optional()
});

export type ProvisionStaffInput = z.infer<typeof provisionStaffSchema>;

export const provisionTeacherSchema = provisionStaffSchema.extend({
  roleKey: z.literal("teacher").default("teacher")
});

export type ProvisionTeacherInput = z.infer<typeof provisionTeacherSchema>;

export const provisionStaffUpdateSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  phone: myanmarPhoneSchema.optional(),
  roleKey: z.string().trim().min(1).optional(),
  /** @deprecated Use roleKey — kept for backward-compatible API clients. */
  personType: z.enum(personTypes).optional(),
  departmentId: z.string().uuid().optional(),
  department: z.string().optional(),
  joinDate: z.string().optional(),
  employmentStatus: z.string().optional(),
  rbacRoleKey: z.string().optional(),
  promotionTitle: z.string().trim().optional(),
  qualifications: z.array(staffQualificationSchema).optional(),
  teacherAssignments: updateTeacherAssignmentsSchema.optional()
});

export type ProvisionStaffUpdateInput = z.infer<typeof provisionStaffUpdateSchema>;

/** Fee types always included on enrollment preview (from fee plans). */
export const mandatoryEnrollmentFeeTypes = ["tuition", "registration"] as const;

export const enrollmentFeeLineSchema = z.object({
  planId: z.string().uuid().optional(),
  feeItemId: z.string().uuid(),
  feeItemName: z.string(),
  description: z.string(),
  unitAmount: z.number(),
  quantity: z.number().default(1),
  lineTotal: z.number(),
  source: z.enum(["fee_plan", "optional"]),
  feeType: z.string(),
  billingType: z.string(),
  mandatory: z.boolean()
});

export type EnrollmentFeeLine = z.infer<typeof enrollmentFeeLineSchema>;

export const discountCriteriaSchema = z.object({ type: z.string() });

export const enrollmentPreviewInputSchema = z.object({
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  gradeId: z.string().uuid(),
  classroomId: z.string().uuid().optional(),
  optionalFeeItemIds: z.array(z.string().uuid()).default([]),
  excludedDiscountRuleIds: z.array(z.string().uuid()).optional(),
  forcedDiscountRuleIds: z.array(z.string().uuid()).optional(),
  collectPayment: z.boolean().optional(),
  paymentMethod: z.string().optional()
});

export type EnrollmentPreviewInput = z.infer<typeof enrollmentPreviewInputSchema>;

export const enrollmentPreviewDiscountSchema = z.object({
  id: z.string(),
  ruleId: z.string().optional(),
  name: z.string(),
  discountType: z.string(),
  amount: z.number(),
  source: z.enum(["student_discount", "rule"]),
  stackable: z.boolean().optional(),
  eligibilityReason: z.string().optional(),
  status: z.string().optional(),
  requiresApproval: z.boolean().optional()
});

export const enrollmentPreviewPendingDiscountSchema = z.object({
  id: z.string().uuid(),
  ruleName: z.string(),
  status: z.string(),
  reason: z.string()
});

export const enrollmentPreviewDiscountOptionSchema = z.object({
  ruleId: z.string().uuid(),
  name: z.string(),
  subtitle: z.string().optional(),
  amount: z.number(),
  applied: z.boolean(),
  eligibility: z.enum(["auto_applied", "eligible", "not_eligible"]),
  canToggle: z.boolean()
});

export type EnrollmentPreviewDiscountOption = z.infer<typeof enrollmentPreviewDiscountOptionSchema>;

export const enrollmentPreviewResultSchema = z.object({
  feeLines: z.array(enrollmentFeeLineSchema),
  availableOptionalFees: z.array(
    z.object({
      feeItemId: z.string().uuid(),
      name: z.string(),
      feeType: z.string(),
      billingType: z.string(),
      unitAmount: z.number(),
      selected: z.boolean()
    })
  ),
  discounts: z.array(enrollmentPreviewDiscountSchema),
  discountOptions: z.array(enrollmentPreviewDiscountOptionSchema).default([]),
  pendingDiscounts: z.array(enrollmentPreviewPendingDiscountSchema).default([]),
  siblingSummary: z.object({
    eligible: z.boolean(),
    enrolledSiblingCount: z.number().int(),
    studentPosition: z.number().int().optional(),
    message: z.string()
  }),
  subtotal: z.number(),
  discountTotal: z.number(),
  total: z.number(),
  warnings: z.array(z.string()),
  discountApprovalRequired: z.boolean().default(false),
  confirmBlockers: z.array(z.string()).default([]),
  canConfirm: z.boolean().default(true)
});

export type EnrollmentPreviewResult = z.infer<typeof enrollmentPreviewResultSchema>;

export const enrollmentBillingSnapshotSchema = z.object({
  optionalFeeItemIds: z.array(z.string().uuid()).optional(),
  lastPreviewAt: z.string().optional()
});

export type EnrollmentBillingSnapshot = z.infer<typeof enrollmentBillingSnapshotSchema>;

export const createEnrollmentSchema = enrollmentPreviewInputSchema.extend({
  classroomId: z.string().uuid()
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

/** Supported payment methods — must match Postgres `payment_method` enum. */
export const paymentMethods = [
  "cash",
  "bank_transfer",
  "kbzpay",
  "wavepay",
  "aya_pay",
  "cb_pay",
  "other"
] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

export const enrollmentPaymentMethods = paymentMethods;

export const enrollmentConfirmSchema = z.object({
  dueDate: z.string().optional(),
  optionalFeeItemIds: z.array(z.string().uuid()).optional(),
  excludedDiscountRuleIds: z.array(z.string().uuid()).optional(),
  forcedDiscountRuleIds: z.array(z.string().uuid()).optional(),
  collectPayment: z.boolean().default(false),
  paymentMethod: z.enum(paymentMethods).optional(),
  paymentAmount: z.number().positive().optional(),
  paymentReference: z.string().optional(),
  paymentNotes: z.string().optional()
});

export type EnrollmentConfirmInput = z.infer<typeof enrollmentConfirmSchema>;

export const enrollmentConfirmResultSchema = z.object({
  enrollmentId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  invoiceNumber: z.string(),
  paymentId: z.string().uuid().optional(),
  preview: enrollmentPreviewResultSchema
});

export type EnrollmentConfirmResult = z.infer<typeof enrollmentConfirmResultSchema>;
