import {
  mandatoryEnrollmentFeeTypes,
  type EnrollmentPreviewResult,
  siblingDiscountCriteriaSchema,
} from '@sms/shared'
import { and, eq, gte, isNull, lte, ne, or } from 'drizzle-orm'
import type { Database } from '../db/db.module.js'
import {
  discountRules,
  enrollmentFeePlans,
  enrollmentFeePlanGrades,
  enrollments,
  feeItems,
  studentDiscounts,
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
      message: 'No family group linked — sibling discount not evaluated.',
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
  const eligible = count >= 1

  return {
    eligible,
    enrolledSiblingCount: count,
    message: eligible
      ? `${count} enrolled sibling(s) in this family for the selected year.`
      : 'No enrolled siblings in this family for the selected year.',
  }
}

function exceedsThreshold(amount: number, threshold: string | null): boolean {
  if (threshold == null) return false
  return amount > Number(threshold)
}

function computeDiscountAmount(
  feeLines: EnrollmentPreviewResult['feeLines'],
  valueType: string,
  value: number,
  discountType: string,
  criteria: Record<string, unknown> | null,
): number {
  const parsed = siblingDiscountCriteriaSchema.safeParse(criteria)
  const appliesToFeeTypes =
    parsed.success && parsed.data.appliesToFeeTypes?.length
      ? parsed.data.appliesToFeeTypes
      : discountType === 'sibling'
        ? [...mandatoryEnrollmentFeeTypes]
        : null

  const eligibleLines =
    appliesToFeeTypes != null
      ? feeLines.filter((line) => appliesToFeeTypes.includes(line.feeType))
      : feeLines

  const base = eligibleLines.reduce((sum, line) => sum + line.lineTotal, 0)
  if (base <= 0) return 0

  if (valueType === 'percentage') {
    return Math.round((base * value) / 100)
  }

  return Math.min(value, base)
}

async function evaluateDiscounts(
  db: Database,
  tenantId: string,
  studentId: string,
  feeLines: EnrollmentPreviewResult['feeLines'],
  siblingSummary: EnrollmentPreviewResult['siblingSummary'],
): Promise<{
  discounts: EnrollmentPreviewResult['discounts']
  discountTotal: number
  discountApprovalRequired: boolean
}> {
  const today = new Date().toISOString().slice(0, 10)
  const discounts: EnrollmentPreviewResult['discounts'] = []
  let discountTotal = 0
  let discountApprovalRequired = false

  const approvedStudentDiscounts = await db
    .select({
      id: studentDiscounts.id,
      ruleName: discountRules.name,
      discountType: discountRules.discountType,
      valueType: discountRules.valueType,
      value: discountRules.value,
      approvalThreshold: discountRules.approvalThreshold,
      criteria: discountRules.criteria,
    })
    .from(studentDiscounts)
    .innerJoin(discountRules, eq(studentDiscounts.discountRuleId, discountRules.id))
    .where(
      and(
        eq(studentDiscounts.tenantId, tenantId),
        eq(studentDiscounts.studentId, studentId),
        eq(studentDiscounts.status, 'approved'),
        eq(discountRules.status, 'active'),
        lte(studentDiscounts.effectiveFrom, today),
        or(isNull(studentDiscounts.effectiveTo), gte(studentDiscounts.effectiveTo, today)),
      ),
    )

  for (const row of approvedStudentDiscounts) {
    const amount = computeDiscountAmount(
      feeLines,
      row.valueType,
      Number(row.value),
      row.discountType,
      row.criteria,
    )
    if (amount <= 0) continue

    const requiresApproval = exceedsThreshold(amount, row.approvalThreshold)
    if (requiresApproval) discountApprovalRequired = true

    discounts.push({
      id: row.id,
      name: row.ruleName,
      discountType: row.discountType,
      amount,
      source: 'student_discount',
      status: 'approved',
      requiresApproval,
    })
    discountTotal += amount
  }

  if (siblingSummary.eligible) {
    const siblingRules = await db
      .select()
      .from(discountRules)
      .where(
        and(
          eq(discountRules.tenantId, tenantId),
          eq(discountRules.discountType, 'sibling'),
          eq(discountRules.status, 'active'),
        ),
      )

    for (const rule of siblingRules) {
      if (discounts.some((d) => d.source === 'rule' && d.discountType === 'sibling')) {
        continue
      }

      const parsed = siblingDiscountCriteriaSchema.safeParse(rule.criteria)
      const criteria = parsed.success ? parsed.data : { type: 'sibling' as const }
      const minSiblings = criteria.minEnrolledSiblings ?? 1
      if (siblingSummary.enrolledSiblingCount < minSiblings) {
        continue
      }

      const amount = computeDiscountAmount(
        feeLines,
        rule.valueType,
        Number(rule.value),
        rule.discountType,
        rule.criteria,
      )
      if (amount <= 0) continue

      const requiresApproval = exceedsThreshold(amount, rule.approvalThreshold)
      if (requiresApproval) discountApprovalRequired = true

      discounts.push({
        id: rule.id,
        name: rule.name,
        discountType: rule.discountType,
        amount,
        source: 'rule',
        requiresApproval,
      })
      discountTotal += amount
    }
  }

  return { discounts, discountTotal, discountApprovalRequired }
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
  const { discounts, discountTotal, discountApprovalRequired } = await evaluateDiscounts(
    db,
    tenantId,
    student.id,
    feeLines,
    siblingSummary,
  )

  return {
    feeLines,
    subtotal,
    discountTotal,
    total: Math.max(0, subtotal - discountTotal),
    discounts,
    siblingSummary,
    discountApprovalRequired,
  }
}
