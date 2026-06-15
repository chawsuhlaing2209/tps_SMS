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

export const updateTeacherAssignmentsSchema = z.object({
  gradeChief: z.array(gradeChiefAssignmentItemSchema).default([]),
  homeroom: z.array(homeroomAssignmentItemSchema).default([]),
  subjectTeaching: z.array(subjectAssignmentItemSchema).default([])
});

export type UpdateTeacherAssignmentsInput = z.infer<typeof updateTeacherAssignmentsSchema>;
