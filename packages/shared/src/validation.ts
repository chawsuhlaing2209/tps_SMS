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
