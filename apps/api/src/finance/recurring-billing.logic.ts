import { and, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { recordAuditEvent } from '../audit/audit.logic.js'
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

export async function generateMonthlyInvoices(
  db: Database,
  input: GenerateMonthlyInvoicesInput,
): Promise<GenerateMonthlyInvoicesResult> {
  const { tenantId, actorUserId } = input
  const billingMonth = input.billingMonth.trim()
  if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
    throw new Error('billingMonth must be in YYYY-MM format')
  }

  const [year, month] = billingMonth.split('-').map(Number)
  const monthStart = `${billingMonth}-01`
  const monthEnd = new Date(year!, month!, 0).toISOString().slice(0, 10)

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

    if (existingInvoice.length > 0) {
      studentsSkipped += 1
      continue
    }

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

    if (billableFeeItemIds.length === 0) {
      studentsSkipped += 1
      continue
    }

    const preview = await previewRecurringBilling(db, tenantId, {
      studentId: enrollment.studentId,
      academicYearId: input.academicYearId,
      gradeId: enrollment.gradeId,
      feeItemIds: billableFeeItemIds,
    })

    if (preview.feeLines.length === 0) {
      studentsSkipped += 1
      continue
    }

    const invoiceNumber = `INV-R-${billingMonth.replace('-', '')}-${Date.now()}-${enrollment.studentId.slice(0, 8)}`

    const invoiceId = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          tenantId,
          studentId: enrollment.studentId,
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

      return invoice!.id
    })

    invoiceIds.push(invoiceId)
    invoicesCreated += 1

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
          academicYearId: input.academicYearId,
          total: preview.total,
        },
      })
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
