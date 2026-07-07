import { buildInvoiceNumber } from '@sms/shared'
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { recordAuditEvent } from '../audit/audit.logic.js'
import { persistInvoiceDiscountLines } from '../discounts/discount-evaluation.logic.js'
import type { Database } from '../db/db.module.js'
import {
  enrollments,
  feeItems,
  invoiceItems,
  invoices,
  studentServices,
  students,
} from '../db/schema.js'
import { previewRecurringBilling } from '../enrollments/enrollment-billing.logic.js'

export type GenerateMonthlyInvoicesResult = {
  billingMonth: string
  academicYearId: string
  studentsProcessed: number
  invoicesCreated: number
  studentsSkipped: number
  invoiceIds: string[]
}

export type GenerateMonthlyInvoicesInput = {
  tenantId: string
  academicYearId: string
  billingMonth: string
  actorUserId: string | null
  gradeId?: string | null
}

type RecurringEnrollmentContext = {
  id: string
  studentId: string
  gradeId: string
  familyGroupId: string | null
}

/**
 * Create the recurring invoice for one enrollment/month if it does not already
 * exist. Returns the new invoice id, or null when there is nothing to bill (no
 * active monthly services, or an invoice for the month already exists). Shared
 * by the bulk monthly run and the on-demand single-student path so the billing
 * logic — including the duplicate guard — lives in one place.
 */
async function createRecurringInvoiceForEnrollment(
  db: Database,
  params: {
    tenantId: string
    enrollment: RecurringEnrollmentContext
    academicYearId: string
    billingMonth: string
    monthStart: string
    monthEnd: string
    actorUserId: string | null
  },
): Promise<string | null> {
  const { tenantId, enrollment, academicYearId, billingMonth, monthStart, monthEnd, actorUserId } =
    params

  const existingInvoice = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, enrollment.studentId),
        eq(invoices.source, 'recurring'),
        gte(invoices.issueDate, monthStart),
        lte(invoices.issueDate, monthEnd),
      ),
    )
    .limit(1)

  if (existingInvoice.length > 0) return null

  const activeServices = await db
    .select({
      feeItemId: studentServices.feeItemId,
      billingType: feeItems.billingType,
    })
    .from(studentServices)
    .innerJoin(feeItems, eq(studentServices.feeItemId, feeItems.id))
    .where(
      and(
        eq(studentServices.tenantId, tenantId),
        eq(studentServices.studentId, enrollment.studentId),
        eq(feeItems.status, 'active'),
        lte(studentServices.effectiveFrom, monthEnd),
        or(isNull(studentServices.effectiveTo), gte(studentServices.effectiveTo, monthStart)),
      ),
    )

  const billableFeeItemIds = activeServices
    .filter((service) => service.billingType === 'monthly')
    .map((service) => service.feeItemId)

  if (billableFeeItemIds.length === 0) return null

  const preview = await previewRecurringBilling(db, tenantId, {
    studentId: enrollment.studentId,
    academicYearId,
    gradeId: enrollment.gradeId,
    feeItemIds: billableFeeItemIds,
  })

  if (preview.feeLines.length === 0) return null

  const invoiceNumber = buildInvoiceNumber(new Date(monthStart))

  const invoiceId = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoices)
      .values({
        tenantId,
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        familyGroupId: enrollment.familyGroupId,
        invoiceNumber,
        issueDate: monthStart,
        dueDate: monthEnd,
        subtotal: String(preview.subtotal),
        discountTotal: String(preview.discountTotal),
        total: String(preview.total),
        status: 'unpaid',
        source: 'recurring',
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning({ id: invoices.id })

    await tx.insert(invoiceItems).values(
      preview.feeLines.map((line) => ({
        tenantId,
        invoiceId: invoice!.id,
        feeItemId: line.feeItemId,
        description: `${line.description} (${billingMonth})`,
        quantity: String(line.quantity),
        unitAmount: String(line.unitAmount),
        total: String(line.lineTotal),
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })),
    )

    if (actorUserId) {
      await persistInvoiceDiscountLines(
        tx,
        tenantId,
        invoice!.id,
        preview.discounts.map((discount) => ({
          id: discount.id,
          ruleId: discount.ruleId ?? discount.id,
          name: discount.name,
          discountType: discount.discountType,
          amount: discount.amount,
          source: discount.source,
          stackable: discount.stackable ?? false,
          requiresApproval: discount.requiresApproval ?? false,
          status: discount.status,
          eligibilityReason: discount.eligibilityReason,
        })),
        actorUserId,
      )
    }

    return invoice!.id
  })

  if (actorUserId) {
    await recordAuditEvent(db, {
      tenantId,
      actorUserId,
      action: 'invoice.create',
      recordType: 'invoice',
      recordId: invoiceId,
      after: {
        source: 'recurring',
        billingMonth,
        academicYearId,
        total: preview.total,
      },
    })
  }

  return invoiceId
}

function monthBounds(billingMonth: string) {
  const trimmed = billingMonth.trim()
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    throw new Error('billingMonth must be in YYYY-MM format')
  }
  const [year, month] = trimmed.split('-').map(Number)
  return {
    billingMonth: trimmed,
    monthStart: `${trimmed}-01`,
    monthEnd: new Date(year!, month!, 0).toISOString().slice(0, 10),
  }
}

export async function generateMonthlyInvoices(
  db: Database,
  input: GenerateMonthlyInvoicesInput,
): Promise<GenerateMonthlyInvoicesResult> {
  const { tenantId, actorUserId } = input
  const { billingMonth, monthStart, monthEnd } = monthBounds(input.billingMonth)

  const enrollmentFilters = [
    eq(enrollments.tenantId, tenantId),
    eq(enrollments.academicYearId, input.academicYearId),
    eq(enrollments.status, 'approved'),
  ]

  if (input.gradeId) {
    enrollmentFilters.push(eq(enrollments.gradeId, input.gradeId))
  }

  const approvedEnrollments = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      gradeId: enrollments.gradeId,
      familyGroupId: students.familyGroupId,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(and(...enrollmentFilters))

  const invoiceIds: string[] = []
  let invoicesCreated = 0
  let studentsSkipped = 0

  for (const enrollment of approvedEnrollments) {
    const invoiceId = await createRecurringInvoiceForEnrollment(db, {
      tenantId,
      enrollment,
      academicYearId: input.academicYearId,
      billingMonth,
      monthStart,
      monthEnd,
      actorUserId,
    })
    if (invoiceId) {
      invoiceIds.push(invoiceId)
      invoicesCreated += 1
    } else {
      studentsSkipped += 1
    }
  }

  return {
    billingMonth,
    academicYearId: input.academicYearId,
    studentsProcessed: approvedEnrollments.length,
    invoicesCreated,
    studentsSkipped,
    invoiceIds,
  }
}

/**
 * Ensure the current (or given) month's recurring invoice exists for a single
 * student, generating it on demand. Idempotent. Returns the invoice id (new or
 * pre-existing) so callers can collect against it, or null when nothing is due.
 */
export async function ensureRecurringInvoiceForStudent(
  db: Database,
  input: {
    tenantId: string
    studentId: string
    academicYearId: string
    billingMonth: string
    actorUserId: string | null
  },
): Promise<string | null> {
  const { tenantId, studentId, academicYearId } = input
  const { billingMonth, monthStart, monthEnd } = monthBounds(input.billingMonth)

  const [enrollment] = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      gradeId: enrollments.gradeId,
      familyGroupId: students.familyGroupId,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.status, 'approved'),
      ),
    )
    .limit(1)

  if (!enrollment) return null

  // If a recurring invoice already exists for the month, return it so the caller
  // can collect against it rather than creating a duplicate.
  const created = await createRecurringInvoiceForEnrollment(db, {
    tenantId,
    enrollment,
    academicYearId,
    billingMonth,
    monthStart,
    monthEnd,
    actorUserId: input.actorUserId,
  })
  if (created) return created

  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, studentId),
        eq(invoices.source, 'recurring'),
        gte(invoices.issueDate, monthStart),
        lte(invoices.issueDate, monthEnd),
      ),
    )
    .limit(1)

  return existing?.id ?? null
}
