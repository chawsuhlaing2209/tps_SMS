import { type EnrollmentPreviewResult } from '@sms/shared'
import { and, eq, ne } from 'drizzle-orm'
import type { Database } from '../db/db.module.js'
import {
  evaluateDiscountsFromDb,
  siblingSummaryMessage,
} from '../discounts/discount-evaluation.logic.js'
import {
  enrollmentFeePlans,
  enrollmentFeePlanGrades,
  enrollments,
  feeItems,
  students,
} from '../db/schema.js'

type PlanRow = {
  planId: string
  feeItemId: string
  amount: string
  feeItemName: string
  feeType: string
  billingType: string
}

const RECURRING_BILLING_TYPES = new Set(['monthly', 'term', 'annual'])

async function loadFeePlans(
  db: Database,
  tenantId: string,
  academicYearId: string,
  gradeId: string,
): Promise<PlanRow[]> {
  const rows = await db
    .select({
      planId: enrollmentFeePlans.id,
      feeItemId: enrollmentFeePlans.feeItemId,
      amount: enrollmentFeePlans.amount,
      feeItemName: feeItems.name,
      feeType: feeItems.feeType,
      billingType: feeItems.billingType,
    })
    .from(enrollmentFeePlans)
    .innerJoin(enrollmentFeePlanGrades, eq(enrollmentFeePlanGrades.planId, enrollmentFeePlans.id))
    .innerJoin(feeItems, eq(enrollmentFeePlans.feeItemId, feeItems.id))
    .where(
      and(
        eq(enrollmentFeePlans.tenantId, tenantId),
        eq(enrollmentFeePlans.academicYearId, academicYearId),
        eq(enrollmentFeePlanGrades.gradeId, gradeId),
        eq(feeItems.status, 'active'),
      ),
    )

  const byFeeItem = new Map<string, PlanRow>()
  for (const row of rows) {
    const existing = byFeeItem.get(row.feeItemId)
    if (!existing || Number(row.amount) >= Number(existing.amount)) {
      byFeeItem.set(row.feeItemId, row)
    }
  }

  return [...byFeeItem.values()]
}

async function buildSiblingSummary(
  db: Database,
  tenantId: string,
  familyGroupId: string | null,
  studentId: string,
  academicYearId: string,
): Promise<EnrollmentPreviewResult['siblingSummary']> {
  if (!familyGroupId) {
    return {
      eligible: false,
      enrolledSiblingCount: 0,
      studentPosition: 1,
      message: siblingSummaryMessage(
        { eligible: false, enrolledSiblingCount: 0, studentPosition: 1 },
        false,
      ),
    }
  }

  const siblingRows = await db
    .select({ id: students.id })
    .from(students)
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.studentId, students.id),
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.status, 'approved'),
      ),
    )
    .where(
      and(
        eq(students.tenantId, tenantId),
        eq(students.familyGroupId, familyGroupId),
        ne(students.id, studentId),
        eq(students.status, 'enrolled'),
      ),
    )

  const count = siblingRows.length
  const summary = {
    eligible: count >= 1,
    enrolledSiblingCount: count,
    studentPosition: count + 1,
  }

  return {
    ...summary,
    message: siblingSummaryMessage(summary, true),
  }
}

export async function previewRecurringBilling(
  db: Database,
  tenantId: string,
  input: {
    studentId: string
    academicYearId: string
    gradeId: string
    feeItemIds: string[]
  },
): Promise<
  Pick<
    EnrollmentPreviewResult,
    'feeLines' | 'subtotal' | 'discountTotal' | 'total' | 'discounts' | 'siblingSummary' | 'discountApprovalRequired'
  >
> {
  const feeItemIdSet = new Set(input.feeItemIds)
  const plans = await loadFeePlans(db, tenantId, input.academicYearId, input.gradeId)
  const feeLines: EnrollmentPreviewResult['feeLines'] = []

  for (const plan of plans) {
    if (!feeItemIdSet.has(plan.feeItemId)) {
      continue
    }

    if (!RECURRING_BILLING_TYPES.has(plan.billingType) || plan.billingType === 'one_time') {
      continue
    }

    if (feeLines.some((line) => line.feeItemId === plan.feeItemId)) {
      continue
    }

    const unitAmount = Number(plan.amount)
    feeLines.push({
      planId: plan.planId,
      feeItemId: plan.feeItemId,
      feeItemName: plan.feeItemName,
      description: plan.feeItemName,
      unitAmount,
      quantity: 1,
      lineTotal: unitAmount,
      source: 'fee_plan',
      feeType: plan.feeType,
      billingType: plan.billingType,
      mandatory: false,
    })
  }

  const [student] = await db
    .select({
      id: students.id,
      familyGroupId: students.familyGroupId,
    })
    .from(students)
    .where(and(eq(students.tenantId, tenantId), eq(students.id, input.studentId)))

  if (!student) {
    throw new Error('Student not found.')
  }

  const subtotal = feeLines.reduce((sum, line) => sum + line.lineTotal, 0)
  const siblingSummary = await buildSiblingSummary(
    db,
    tenantId,
    student.familyGroupId,
    input.studentId,
    input.academicYearId,
  )

  const result = await evaluateDiscountsFromDb(db, {
    tenantId,
    studentId: student.id,
    context: {
      billingContext: 'recurring',
      academicYearId: input.academicYearId,
      gradeId: input.gradeId,
      feeLines,
      siblingSummary: {
        eligible: siblingSummary.eligible,
        enrolledSiblingCount: siblingSummary.enrolledSiblingCount,
        studentPosition: siblingSummary.studentPosition ?? siblingSummary.enrolledSiblingCount + 1,
      },
    },
  })

  return {
    feeLines,
    subtotal,
    discountTotal: result.discountTotal,
    total: Math.max(0, subtotal - result.discountTotal),
    discounts: result.discounts.map((discount) => ({
      id: discount.id,
      ruleId: discount.ruleId,
      name: discount.name,
      discountType: discount.discountType,
      amount: discount.amount,
      source: discount.source,
      stackable: discount.stackable,
      eligibilityReason: discount.eligibilityReason,
      status: discount.status,
      requiresApproval: discount.requiresApproval,
    })),
    siblingSummary,
    discountApprovalRequired: result.discountApprovalRequired,
  }
}
