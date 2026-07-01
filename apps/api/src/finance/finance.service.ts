import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { buildInvoiceNumber, buildPaymentNumber, billingMonthFromIssueDate, computeRecordablePaymentBalance, paymentPlanKeyFromInvoiceSource } from '@sms/shared'
import { and, eq, gte, lte, inArray, isNotNull, isNull, ne, sql, sum, count, asc, desc, exists, ilike, or } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service.js'
import { DB, type Database } from '../db/db.module.js'
import {
  academicYears, auditLogs, classrooms, discountRules, enrollmentFeePlans, enrollmentFeePlanGrades, enrollments, familyGroups, feeItems, grades, guardians, invoices, invoiceDiscountLines, invoiceItems,
  payments, paymentPlanInstallments, paymentPlans, payrollRecords, receipts, studentDiscounts, studentServices, students, tenants, tenantSettings, terms, users,
} from '../db/schema.js'
import type {
  BillingRosterQueryDto, CollectPaymentDto,
  CreateFeeItemDto, CreateEnrollmentFeePlanDto, CreateInvoiceDto,
  CreatePaymentPlanDto, GenerateMonthlyInvoicesDto, RecordPaymentDto, RefundPaymentDto,
  UpdatePaymentPlanInstallmentsDto, UpdatePaymentPlanDto,
  VerifyPaymentDto, ListInvoicesQueryDto, ListPaymentsQueryDto,
  FinanceOverviewQueryDto,
  MonthlyReportQueryDto, ReceivablesQueryDto, UpdateFeeItemDto,
  UpdateEnrollmentFeePlanDto, InvoiceMetricsQueryDto, PaymentMetricsQueryDto,
  ReconcileFeeItemGradeAmountsDto,
} from './dto.js'
import { InvoicesQueueService } from './invoices-queue.service.js'
import { RecurringBillingService } from './recurring-billing.service.js'
import { ensureRecurringInvoiceForStudent } from './recurring-billing.logic.js'
import { NotificationsService } from '../notifications/notifications.service.js'

@Injectable()
export class FinanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly recurringBillingService: RecurringBillingService,
    private readonly invoicesQueueService: InvoicesQueueService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Fee Items ──────────────────────────────────────────────────────────────

  async listFeeItems(tenantId: string) {
    return this.db.select().from(feeItems).where(eq(feeItems.tenantId, tenantId)).limit(200)
  }

  async createFeeItem(tenantId: string, actorUserId: string, dto: CreateFeeItemDto) {
    const [item] = await this.db.insert(feeItems).values({
      tenantId, createdBy: actorUserId, updatedBy: actorUserId,
      name: dto.name.trim(), feeType: dto.feeType.trim(), billingType: dto.billingType.trim(),
    }).returning()
    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'fee_item.create', recordType: 'fee_item', recordId: item!.id, after: item })
    )
    return item
  }

  private async getFeeItemOrThrow(tenantId: string, feeItemId: string) {
    const [item] = await this.db
      .select()
      .from(feeItems)
      .where(and(eq(feeItems.id, feeItemId), eq(feeItems.tenantId, tenantId)))
    if (!item) throw new NotFoundException('Fee item not found')
    return item
  }

  async updateFeeItem(tenantId: string, feeItemId: string, actorUserId: string, dto: UpdateFeeItemDto) {
    const previous = await this.getFeeItemOrThrow(tenantId, feeItemId)
    const [item] = await this.db.update(feeItems).set({
      name: dto.name?.trim() ?? previous.name,
      feeType: dto.feeType?.trim() ?? previous.feeType,
      billingType: dto.billingType?.trim() ?? previous.billingType,
      updatedBy: actorUserId,
      updatedAt: new Date(),
    }).where(and(eq(feeItems.id, feeItemId), eq(feeItems.tenantId, tenantId))).returning()
    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'fee_item.update', recordType: 'fee_item', recordId: feeItemId, before: previous, after: item })
    )
    return item
  }

  async archiveFeeItem(tenantId: string, feeItemId: string, actorUserId: string) {
    const previous = await this.getFeeItemOrThrow(tenantId, feeItemId)
    if (previous.status === 'archived') return previous
    const [item] = await this.db.update(feeItems).set({
      status: 'archived', updatedBy: actorUserId, updatedAt: new Date(),
    }).where(and(eq(feeItems.id, feeItemId), eq(feeItems.tenantId, tenantId))).returning()
    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'fee_item.archive', recordType: 'fee_item', recordId: feeItemId, before: { status: previous.status }, after: { status: 'archived' } })
    )
    return item
  }

  async reactivateFeeItem(tenantId: string, feeItemId: string, actorUserId: string) {
    const previous = await this.getFeeItemOrThrow(tenantId, feeItemId)
    if (previous.status === 'active') return previous
    const [item] = await this.db.update(feeItems).set({
      status: 'active', updatedBy: actorUserId, updatedAt: new Date(),
    }).where(and(eq(feeItems.id, feeItemId), eq(feeItems.tenantId, tenantId))).returning()
    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'fee_item.reactivate', recordType: 'fee_item', recordId: feeItemId, before: { status: previous.status }, after: { status: 'active' } })
    )
    return item
  }

  /**
   * Hard-delete a fee component. Blocked when the component still has active
   * recurring services (deleting would strand live billing). Historical invoice
   * lines keep their text but lose the link; ended services, fee plans, and
   * discount references are cleaned up.
   */
  async deleteFeeItem(tenantId: string, feeItemId: string, actorUserId: string) {
    const previous = await this.getFeeItemOrThrow(tenantId, feeItemId)

    const today = new Date().toISOString().slice(0, 10)
    const [activeRow] = await this.db
      .select({ value: count() })
      .from(studentServices)
      .where(and(
        eq(studentServices.tenantId, tenantId),
        eq(studentServices.feeItemId, feeItemId),
        or(isNull(studentServices.effectiveTo), gte(studentServices.effectiveTo, today)),
      ))
    const activeServices = Number(activeRow?.value ?? 0)
    if (activeServices > 0) {
      throw new BadRequestException(
        `This component has ${activeServices} active recurring service(s). End them before deleting.`,
      )
    }

    await this.db.transaction(async (tx) => {
      // Preserve historical invoice lines — keep the description, drop the link.
      await tx.update(invoiceItems)
        .set({ feeItemId: null })
        .where(and(eq(invoiceItems.tenantId, tenantId), eq(invoiceItems.feeItemId, feeItemId)))

      // Remove ended recurring services (feeItemId is NOT NULL, so they can't be kept).
      await tx.delete(studentServices)
        .where(and(eq(studentServices.tenantId, tenantId), eq(studentServices.feeItemId, feeItemId)))

      // Drop enrollment fee plans (grade links cascade via the junction FK).
      await tx.delete(enrollmentFeePlans)
        .where(and(eq(enrollmentFeePlans.tenantId, tenantId), eq(enrollmentFeePlans.feeItemId, feeItemId)))

      // Scrub the fee item from any discount criteria that reference it.
      const rules = await tx
        .select({ id: discountRules.id, criteria: discountRules.criteria })
        .from(discountRules)
        .where(eq(discountRules.tenantId, tenantId))
      for (const rule of rules) {
        const criteria = (rule.criteria ?? {}) as { appliesTo?: { feeItemIds?: string[] } }
        const ids = criteria.appliesTo?.feeItemIds
        if (!Array.isArray(ids) || !ids.includes(feeItemId)) continue
        await tx.update(discountRules)
          .set({ criteria: { ...criteria, appliesTo: { ...criteria.appliesTo, feeItemIds: ids.filter((id) => id !== feeItemId) } } })
          .where(eq(discountRules.id, rule.id))
      }

      await tx.delete(feeItems)
        .where(and(eq(feeItems.id, feeItemId), eq(feeItems.tenantId, tenantId)))
    })

    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'fee_item.delete', recordType: 'fee_item', recordId: feeItemId, before: { name: previous.name, feeType: previous.feeType, status: previous.status }, after: { deleted: true } })
    )
    return { deleted: true, feeItemId }
  }

  // ── Enrollment Fee Plans ───────────────────────────────────────────────────

  private async listPlanGradeMap(tenantId: string) {
    const rows = await this.db
      .select({
        planId: enrollmentFeePlanGrades.planId,
        gradeId: enrollmentFeePlanGrades.gradeId,
      })
      .from(enrollmentFeePlanGrades)
      .where(eq(enrollmentFeePlanGrades.tenantId, tenantId));

    const byPlan = new Map<string, string[]>();
    for (const row of rows) {
      const grades = byPlan.get(row.planId) ?? [];
      grades.push(row.gradeId);
      byPlan.set(row.planId, grades);
    }
    return byPlan;
  }

  private async assertGradeAvailability(
    tenantId: string,
    academicYearId: string,
    feeItemId: string,
    gradeIds: string[],
    excludePlanId?: string,
  ) {
    if (!gradeIds.length) {
      throw new BadRequestException('Select at least one grade.');
    }

    const conditions = [
      eq(enrollmentFeePlanGrades.tenantId, tenantId),
      eq(enrollmentFeePlans.academicYearId, academicYearId),
      eq(enrollmentFeePlans.feeItemId, feeItemId),
      inArray(enrollmentFeePlanGrades.gradeId, gradeIds),
    ];

    if (excludePlanId) {
      conditions.push(ne(enrollmentFeePlans.id, excludePlanId));
    }

    const [conflict] = await this.db
      .select({ gradeId: enrollmentFeePlanGrades.gradeId })
      .from(enrollmentFeePlanGrades)
      .innerJoin(enrollmentFeePlans, eq(enrollmentFeePlanGrades.planId, enrollmentFeePlans.id))
      .where(and(...conditions))
      .limit(1);

    if (conflict) {
      throw new BadRequestException(
        'One or more selected grades already belong to another plan for this fee item.',
      );
    }
  }

  private async replacePlanGrades(
    tenantId: string,
    actorUserId: string,
    planId: string,
    gradeIds: string[],
  ) {
    await this.db
      .delete(enrollmentFeePlanGrades)
      .where(
        and(
          eq(enrollmentFeePlanGrades.tenantId, tenantId),
          eq(enrollmentFeePlanGrades.planId, planId),
        ),
      );

    if (!gradeIds.length) {
      return;
    }

    await this.db.insert(enrollmentFeePlanGrades).values(
      gradeIds.map((gradeId) => ({
        tenantId,
        planId,
        gradeId,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })),
    );
  }

  async listEnrollmentFeePlans(tenantId: string) {
    const plans = await this.db
      .select()
      .from(enrollmentFeePlans)
      .where(eq(enrollmentFeePlans.tenantId, tenantId));

    const gradeMap = await this.listPlanGradeMap(tenantId);
    return plans.map((plan) => ({
      ...plan,
      gradeIds: gradeMap.get(plan.id) ?? [],
    }));
  }

  async createEnrollmentFeePlan(tenantId: string, actorUserId: string, dto: CreateEnrollmentFeePlanDto) {
    const [year] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(
        and(
          eq(academicYears.tenantId, tenantId),
          eq(academicYears.id, dto.academicYearId),
          eq(academicYears.status, "active")
        )
      );

    if (!year) {
      throw new BadRequestException("Enrollment fee plans must use the current academic year.");
    }

    await this.assertGradeAvailability(
      tenantId,
      dto.academicYearId,
      dto.feeItemId,
      dto.gradeIds,
    );

    const [plan] = await this.db.insert(enrollmentFeePlans).values({
      tenantId, createdBy: actorUserId, updatedBy: actorUserId,
      academicYearId: dto.academicYearId,
      feeItemId: dto.feeItemId, amount: String(dto.amount),
    }).returning();

    await this.replacePlanGrades(tenantId, actorUserId, plan!.id, dto.gradeIds);

    const gradeIds = dto.gradeIds;
    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'enrollment_fee_plan.create',
        recordType: 'enrollment_fee_plan',
        recordId: plan!.id,
        after: { ...plan, gradeIds },
      })
    );

    return { ...plan, gradeIds };
  }

  private async getEnrollmentFeePlanOrThrow(tenantId: string, planId: string) {
    const [plan] = await this.db
      .select()
      .from(enrollmentFeePlans)
      .where(and(eq(enrollmentFeePlans.id, planId), eq(enrollmentFeePlans.tenantId, tenantId)))
    if (!plan) throw new NotFoundException('Enrollment fee plan not found')

    const gradeMap = await this.listPlanGradeMap(tenantId);
    return { ...plan, gradeIds: gradeMap.get(plan.id) ?? [] };
  }

  async updateEnrollmentFeePlan(
    tenantId: string,
    planId: string,
    actorUserId: string,
    dto: UpdateEnrollmentFeePlanDto,
  ) {
    const previous = await this.getEnrollmentFeePlanOrThrow(tenantId, planId);

    if (dto.gradeIds) {
      await this.assertGradeAvailability(
        tenantId,
        previous.academicYearId,
        previous.feeItemId,
        dto.gradeIds,
        planId,
      );
    }

    const patch: {
      amount?: string;
      updatedBy: string;
      updatedAt: Date;
    } = {
      updatedBy: actorUserId,
      updatedAt: new Date(),
    };

    if (dto.amount !== undefined) {
      patch.amount = String(dto.amount);
    }

    const [plan] = await this.db.update(enrollmentFeePlans).set(patch)
      .where(and(eq(enrollmentFeePlans.id, planId), eq(enrollmentFeePlans.tenantId, tenantId)))
      .returning();

    if (dto.gradeIds) {
      await this.replacePlanGrades(tenantId, actorUserId, planId, dto.gradeIds);
    }

    const gradeIds = dto.gradeIds ?? previous.gradeIds;
    const after = { ...plan, gradeIds };

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'enrollment_fee_plan.update',
        recordType: 'enrollment_fee_plan',
        recordId: planId,
        before: previous,
        after,
      })
    );
    return after;
  }

  async deleteEnrollmentFeePlan(tenantId: string, planId: string, actorUserId: string) {
    const previous = await this.getEnrollmentFeePlanOrThrow(tenantId, planId)
    await this.db
      .delete(enrollmentFeePlans)
      .where(and(eq(enrollmentFeePlans.id, planId), eq(enrollmentFeePlans.tenantId, tenantId)))
    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'enrollment_fee_plan.delete', recordType: 'enrollment_fee_plan', recordId: planId, before: previous })
    )
    return { removed: true }
  }

  /**
   * Component-centric save: set the per-grade amounts for one fee component in
   * one atomic call. Each entry is { gradeId, amount }; grades not listed are
   * removed. Plans are grouped by amount (one plan per distinct amount spanning
   * its grades), so "same amount for all grades" stays a single plan.
   */
  async reconcileFeeItemGradeAmounts(
    tenantId: string,
    feeItemId: string,
    actorUserId: string,
    dto: ReconcileFeeItemGradeAmountsDto,
  ) {
    const [item] = await this.db
      .select({ id: feeItems.id })
      .from(feeItems)
      .where(and(eq(feeItems.id, feeItemId), eq(feeItems.tenantId, tenantId)))
    if (!item) throw new NotFoundException('Fee component not found')

    const [year] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(
        and(
          eq(academicYears.tenantId, tenantId),
          eq(academicYears.id, dto.academicYearId),
          eq(academicYears.status, 'active'),
        ),
      )
    if (!year) {
      throw new BadRequestException('Fee structures must use the current academic year.')
    }

    // Validate grades belong to the tenant; dedupe (last entry wins per grade).
    const amountByGrade = new Map<string, number>()
    for (const entry of dto.entries) {
      if (entry.amount <= 0) {
        throw new BadRequestException('Each applied grade needs an amount greater than zero.')
      }
      amountByGrade.set(entry.gradeId, entry.amount)
    }
    const gradeIds = [...amountByGrade.keys()]
    if (gradeIds.length) {
      const validGrades = await this.db
        .select({ id: grades.id })
        .from(grades)
        .where(and(eq(grades.tenantId, tenantId), inArray(grades.id, gradeIds)))
      if (validGrades.length !== gradeIds.length) {
        throw new BadRequestException('One or more grades are invalid.')
      }
    }

    // Group grades by amount → one plan per distinct amount.
    const gradesByAmount = new Map<string, string[]>()
    for (const [gradeId, amount] of amountByGrade) {
      const key = String(amount)
      const list = gradesByAmount.get(key) ?? []
      list.push(gradeId)
      gradesByAmount.set(key, list)
    }

    await this.db.transaction(async (tx) => {
      // Drop all current plans for this component + year (cascade clears their
      // grade links), then re-create from the desired amount groups.
      const existing = await tx
        .select({ id: enrollmentFeePlans.id })
        .from(enrollmentFeePlans)
        .where(
          and(
            eq(enrollmentFeePlans.tenantId, tenantId),
            eq(enrollmentFeePlans.feeItemId, feeItemId),
            eq(enrollmentFeePlans.academicYearId, dto.academicYearId),
          ),
        )
      if (existing.length) {
        await tx.delete(enrollmentFeePlans).where(
          inArray(
            enrollmentFeePlans.id,
            existing.map((p) => p.id),
          ),
        )
      }

      for (const [amount, planGradeIds] of gradesByAmount) {
        const [plan] = await tx
          .insert(enrollmentFeePlans)
          .values({
            tenantId,
            createdBy: actorUserId,
            updatedBy: actorUserId,
            academicYearId: dto.academicYearId,
            feeItemId,
            amount,
          })
          .returning({ id: enrollmentFeePlans.id })
        await tx.insert(enrollmentFeePlanGrades).values(
          planGradeIds.map((gradeId) => ({
            tenantId,
            createdBy: actorUserId,
            updatedBy: actorUserId,
            planId: plan!.id,
            gradeId,
          })),
        )
      }
    })

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'enrollment_fee_plan.reconcile',
        recordType: 'fee_item',
        recordId: feeItemId,
        after: {
          academicYearId: dto.academicYearId,
          gradeCount: gradeIds.length,
          planCount: gradesByAmount.size,
        },
      }),
    )

    return { feeItemId, gradeCount: gradeIds.length, planCount: gradesByAmount.size }
  }

  private annualizeFeeAmount(amount: string, billingType: string): number {
    const base = Number(amount);
    if (!Number.isFinite(base)) return 0;
    switch (billingType) {
      case 'monthly':
        return base * 12;
      case 'term':
        return base * 3;
      default:
        return base;
    }
  }

  async getFeeStructureSummary(tenantId: string, academicYearId: string) {
    const [year] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)));

    if (!year) {
      throw new NotFoundException('Academic year not found');
    }

    const gradeRows = await this.db
      .select({
        id: grades.id,
        name: grades.name,
        sortOrder: grades.sortOrder,
      })
      .from(grades)
      .where(and(eq(grades.tenantId, tenantId), ne(grades.status, 'archived')))
      .orderBy(grades.sortOrder, grades.name);

    const items = await this.db
      .select()
      .from(feeItems)
      .where(and(eq(feeItems.tenantId, tenantId), eq(feeItems.status, 'active')));

    const plans = await this.listEnrollmentFeePlans(tenantId);
    const yearPlans = plans.filter((plan) => plan.academicYearId === academicYearId);
    const itemById = new Map(items.map((item) => [item.id, item]));

    const gradeSummaries = gradeRows.map((grade) => {
      let totalAnnual = 0;
      let componentCount = 0;

      for (const plan of yearPlans) {
        if (!plan.gradeIds.includes(grade.id)) continue;
        const item = itemById.get(plan.feeItemId);
        if (!item) continue;
        totalAnnual += this.annualizeFeeAmount(plan.amount, item.billingType);
        componentCount += 1;
      }

      return {
        gradeId: grade.id,
        gradeName: grade.name,
        totalAnnual,
        componentCount,
        studentCount: 0,
      };
    });

    const enrollmentCounts = await this.db
      .select({
        gradeId: enrollments.gradeId,
        count: count(),
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.academicYearId, academicYearId),
          eq(enrollments.status, 'approved'),
        ),
      )
      .groupBy(enrollments.gradeId);

    const countByGrade = new Map(enrollmentCounts.map((row) => [row.gradeId, Number(row.count)]));

    const gradesWithCounts = gradeSummaries.map((row) => ({
      ...row,
      studentCount: countByGrade.get(row.gradeId) ?? 0,
    }));

    const maxTotal = gradesWithCounts.reduce((max, row) => Math.max(max, row.totalAnnual), 0);

    return {
      academicYearId,
      grades: gradesWithCounts,
      maxTotal,
    };
  }

  // ── Payment Plans ──────────────────────────────────────────────────────────

  private async listInstallmentsByPlan(tenantId: string, planIds: string[]) {
    if (!planIds.length) return new Map<string, Array<typeof paymentPlanInstallments.$inferSelect>>();

    const rows = await this.db
      .select()
      .from(paymentPlanInstallments)
      .where(
        and(
          eq(paymentPlanInstallments.tenantId, tenantId),
          inArray(paymentPlanInstallments.planId, planIds),
        ),
      )
      .orderBy(paymentPlanInstallments.sortOrder);

    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      const bucket = map.get(row.planId) ?? [];
      bucket.push(row);
      map.set(row.planId, bucket);
    }
    return map;
  }

  async listPaymentPlans(tenantId: string) {
    const plans = await this.db
      .select()
      .from(paymentPlans)
      .where(eq(paymentPlans.tenantId, tenantId))
      .orderBy(paymentPlans.sortOrder, paymentPlans.name);

    const installmentMap = await this.listInstallmentsByPlan(
      tenantId,
      plans.map((plan) => plan.id),
    );

    return plans.map((plan) => ({
      ...plan,
      installments: installmentMap.get(plan.id) ?? [],
    }));
  }

  async createPaymentPlan(tenantId: string, actorUserId: string, dto: CreatePaymentPlanDto) {
    const [plan] = await this.db
      .insert(paymentPlans)
      .values({
        tenantId,
        createdBy: actorUserId,
        updatedBy: actorUserId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        frequency: dto.frequency.trim(),
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'active',
      })
      .returning();

    if (dto.installments?.length) {
      await this.replacePaymentPlanInstallments(tenantId, actorUserId, plan!.id, dto.installments);
    }

    const [created] = await this.listPaymentPlans(tenantId).then((rows) =>
      rows.filter((row) => row.id === plan!.id),
    );

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'payment_plan.create',
        recordType: 'payment_plan',
        recordId: plan!.id,
        after: created,
      }),
    );

    return created;
  }

  private async getPaymentPlanOrThrow(tenantId: string, planId: string) {
    const rows = await this.listPaymentPlans(tenantId);
    const plan = rows.find((row) => row.id === planId);
    if (!plan) throw new NotFoundException('Payment plan not found');
    return plan;
  }

  async updatePaymentPlan(
    tenantId: string,
    planId: string,
    actorUserId: string,
    dto: UpdatePaymentPlanDto,
  ) {
    const previous = await this.getPaymentPlanOrThrow(tenantId, planId);

    const patch: Partial<typeof paymentPlans.$inferInsert> = {
      updatedBy: actorUserId,
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.description !== undefined) patch.description = dto.description?.trim() || null;
    if (dto.frequency !== undefined) patch.frequency = dto.frequency.trim();
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) patch.status = dto.status;

    await this.db
      .update(paymentPlans)
      .set(patch)
      .where(and(eq(paymentPlans.id, planId), eq(paymentPlans.tenantId, tenantId)));

    const after = await this.getPaymentPlanOrThrow(tenantId, planId);

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'payment_plan.update',
        recordType: 'payment_plan',
        recordId: planId,
        before: previous,
        after,
      }),
    );

    return after;
  }

  async togglePaymentPlanStatus(tenantId: string, planId: string, actorUserId: string) {
    const previous = await this.getPaymentPlanOrThrow(tenantId, planId);
    const nextStatus = previous.status === 'active' ? 'inactive' : 'active';

    await this.db
      .update(paymentPlans)
      .set({ status: nextStatus, updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(paymentPlans.id, planId), eq(paymentPlans.tenantId, tenantId)));

    const after = await this.getPaymentPlanOrThrow(tenantId, planId);

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'payment_plan.toggle_status',
        recordType: 'payment_plan',
        recordId: planId,
        before: previous,
        after,
      }),
    );

    return after;
  }

  async replacePaymentPlanInstallments(
    tenantId: string,
    actorUserId: string,
    planId: string,
    installments: UpdatePaymentPlanInstallmentsDto['installments'],
  ) {
    await this.getPaymentPlanOrThrow(tenantId, planId);

    await this.db
      .delete(paymentPlanInstallments)
      .where(
        and(
          eq(paymentPlanInstallments.tenantId, tenantId),
          eq(paymentPlanInstallments.planId, planId),
        ),
      );

    if (!installments.length) {
      return [];
    }

    const rows = await this.db
      .insert(paymentPlanInstallments)
      .values(
        installments.map((item, index) => ({
          tenantId,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          planId,
          label: item.label.trim(),
          dueDate: item.dueDate.trim(),
          installmentCount: item.installmentCount ?? null,
          sortOrder: item.sortOrder ?? index,
        })),
      )
      .returning();

    return rows;
  }

  async updatePaymentPlanInstallments(
    tenantId: string,
    planId: string,
    actorUserId: string,
    dto: UpdatePaymentPlanInstallmentsDto,
  ) {
    const previous = await this.getPaymentPlanOrThrow(tenantId, planId);
    await this.replacePaymentPlanInstallments(tenantId, actorUserId, planId, dto.installments);
    const after = await this.getPaymentPlanOrThrow(tenantId, planId);

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'payment_plan.update_installments',
        recordType: 'payment_plan',
        recordId: planId,
        before: previous,
        after,
      }),
    );

    return after;
  }

  async deletePaymentPlan(tenantId: string, planId: string, actorUserId: string) {
    const previous = await this.getPaymentPlanOrThrow(tenantId, planId);
    await this.db
      .delete(paymentPlans)
      .where(and(eq(paymentPlans.id, planId), eq(paymentPlans.tenantId, tenantId)));

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'payment_plan.delete',
        recordType: 'payment_plan',
        recordId: planId,
        before: previous,
      }),
    );

    return { removed: true };
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  /** Resolve enrollment for invoice rows when enrollmentId was not persisted (legacy seed). */
  private enrollmentJoinCondition(tenantId: string, academicYearId?: string) {
    const fallbackEnrollmentId = sql<string>`(
      SELECT e.id
      FROM enrollments e
      WHERE e.tenant_id = ${tenantId}
        AND e.student_id = ${invoices.studentId}
        AND e.status = 'approved'
        ${academicYearId ? sql`AND e.academic_year_id = ${academicYearId}` : sql``}
      ORDER BY e.created_at DESC
      LIMIT 1
    )`

    return and(
      eq(enrollments.tenantId, tenantId),
      or(
        eq(invoices.enrollmentId, enrollments.id),
        and(isNull(invoices.enrollmentId), eq(enrollments.id, fallbackEnrollmentId)),
      ),
    )
  }

  private paymentAcademicYearFilter(tenantId: string, academicYearId: string) {
    return exists(
      this.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, payments.invoiceId),
            eq(invoices.tenantId, tenantId),
            exists(
              this.db
                .select({ id: enrollments.id })
                .from(enrollments)
                .where(
                  and(
                    eq(enrollments.tenantId, tenantId),
                    eq(enrollments.studentId, invoices.studentId),
                    eq(enrollments.academicYearId, academicYearId),
                    eq(enrollments.status, 'approved'),
                  ),
                ),
            ),
          ),
        ),
    )
  }

  async listInvoices(tenantId: string, query: ListInvoicesQueryDto) {
    const conditions = [eq(invoices.tenantId, tenantId)]
    const statusFilter = query.status === 'due' ? 'unpaid' : query.status
    if (statusFilter) conditions.push(eq(invoices.status, statusFilter as any))
    if (query.studentId) conditions.push(eq(invoices.studentId, query.studentId))
    if (query.source) conditions.push(eq(invoices.source, query.source as 'enrollment' | 'recurring' | 'ad_hoc'))

    if (query.gradeId) {
      if (!query.academicYearId) {
        throw new BadRequestException('academicYearId is required when filtering invoices by grade')
      }

      conditions.push(
        exists(
          this.db
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.tenantId, tenantId),
                eq(enrollments.studentId, invoices.studentId),
                eq(enrollments.academicYearId, query.academicYearId),
                eq(enrollments.gradeId, query.gradeId),
                eq(enrollments.status, 'approved'),
              ),
            ),
        ),
      )
    } else if (query.academicYearId) {
      conditions.push(
        exists(
          this.db
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.tenantId, tenantId),
                eq(enrollments.studentId, invoices.studentId),
                eq(enrollments.academicYearId, query.academicYearId),
                eq(enrollments.status, 'approved'),
              ),
            ),
        ),
      )
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`
      conditions.push(
        or(
          ilike(invoices.invoiceNumber, term),
          ilike(students.fullName, term),
          exists(
            this.db
              .select({ id: students.id })
              .from(students)
              .leftJoin(familyGroups, eq(students.familyGroupId, familyGroups.id))
              .leftJoin(guardians, eq(familyGroups.primaryGuardianId, guardians.id))
              .where(
                and(
                  eq(students.id, invoices.studentId),
                  eq(students.tenantId, tenantId),
                  ilike(guardians.fullName, term),
                ),
              ),
          ),
        )!,
      )
    }

    const issueDateRange = this.resolveIssueDateFilter(query)
    if (issueDateRange) {
      conditions.push(gte(invoices.issueDate, issueDateRange.start))
      conditions.push(lte(invoices.issueDate, issueDateRange.end))
    }

    const limit = Math.min(query.limit ?? 50, 200)
    const offset = query.offset ?? 0
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc'
    const createdAtOrder = sortDir === 'asc' ? asc(invoices.createdAt) : desc(invoices.createdAt)

    const verifiedPaidSql = sql<string>`(
      SELECT COALESCE(SUM(
        CASE
          WHEN ${payments.kind} = 'payment' THEN ${payments.amount}::numeric
          WHEN ${payments.kind} = 'refund' THEN -${payments.amount}::numeric
          ELSE 0
        END
      ), 0)
      FROM ${payments}
      WHERE ${payments.invoiceId} = ${invoices.id}
        AND ${payments.tenantId} = ${tenantId}
        AND ${payments.verifiedAt} IS NOT NULL
    )`

    const rows = await this.db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        studentId: invoices.studentId,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        subtotal: invoices.subtotal,
        discountTotal: invoices.discountTotal,
        total: invoices.total,
        status: invoices.status,
        source: invoices.source,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        enrollmentId: invoices.enrollmentId,
        studentFullName: students.fullName,
        gradeName: grades.name,
        classroomName: classrooms.name,
        verifiedPaid: verifiedPaidSql,
      })
      .from(invoices)
      .leftJoin(students, and(eq(invoices.studentId, students.id), eq(students.tenantId, tenantId)))
      .leftJoin(enrollments, this.enrollmentJoinCondition(tenantId, query.academicYearId))
      .leftJoin(grades, eq(enrollments.gradeId, grades.id))
      .leftJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .where(and(...conditions))
      .orderBy(createdAtOrder)
      .limit(limit)
      .offset(offset)

    const countResult = await this.db
      .select({ total: count() })
      .from(invoices)
      .leftJoin(students, and(eq(invoices.studentId, students.id), eq(students.tenantId, tenantId)))
      .where(and(...conditions))
    const totalCount = countResult[0]?.total ?? 0

    const data = rows.map((row) => {
      const total = Number(row.total)
      const paid = Number(row.verifiedPaid ?? 0)
      return {
        ...row,
        balanceDue: Math.max(0, total - paid),
        verifiedPaid: paid,
        billingMonth: billingMonthFromIssueDate(row.issueDate),
        paymentPlan: paymentPlanKeyFromInvoiceSource(row.source),
      }
    })

    return { data, total: Number(totalCount), limit, offset }
  }

  async getInvoiceMetrics(tenantId: string, query: InvoiceMetricsQueryDto) {
    if (!query.academicYearId) {
      return {
        billed: 0,
        collected: 0,
        outstanding: 0,
        overdue: 0,
        owingStudents: 0,
        overdueStudents: 0,
        collectionRate: 0,
        termName: null as string | null,
      }
    }

    const roster = await this.getBillingRoster(tenantId, {
      academicYearId: query.academicYearId,
      metricsOnly: true,
    })

    return {
      billed: roster.metrics.billed,
      collected: roster.metrics.collected,
      outstanding: roster.metrics.outstanding,
      overdue: roster.metrics.overdue,
      owingStudents: roster.metrics.owingStudents,
      overdueStudents: roster.metrics.overdueStudents,
      collectionRate: roster.metrics.collectionRate,
      termName: roster.term?.name ?? null,
    }
  }

  private async resolveCurrentTerm(tenantId: string, academicYearId?: string) {
    if (!academicYearId) return { term: null as { name: string } | null }
    const { currentTerm } = await this.resolveBillingPeriod(tenantId, academicYearId)
    return { term: currentTerm }
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    const [invoice] = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    if (!invoice) throw new NotFoundException('Invoice not found')

    const items = await this.db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId))

    const discountLines = await this.db
      .select()
      .from(invoiceDiscountLines)
      .where(
        and(eq(invoiceDiscountLines.invoiceId, invoiceId), eq(invoiceDiscountLines.tenantId, tenantId))
      )

    const invoicePayments = await this.db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        kind: payments.kind,
        refundedPaymentId: payments.refundedPaymentId,
        amount: payments.amount,
        method: payments.method,
        referenceNumber: payments.referenceNumber,
        paidAt: payments.paidAt,
        verifiedAt: payments.verifiedAt,
        notes: payments.notes,
        createdAt: payments.createdAt,
        createdBy: payments.createdBy,
        receiptNumber: receipts.receiptNumber,
      })
      .from(payments)
      .leftJoin(receipts, and(eq(receipts.paymentId, payments.id), eq(receipts.tenantId, tenantId)))
      .where(and(eq(payments.invoiceId, invoiceId), eq(payments.tenantId, tenantId)))
      .orderBy(desc(payments.paidAt), desc(payments.createdAt))

    const context = await this.resolveStudentBillingContext(
      tenantId,
      invoice.studentId,
      invoice.enrollmentId,
    )

    return { ...invoice, items, discountLines, payments: invoicePayments, ...context }
  }

  async getInvoiceActivity(tenantId: string, invoiceId: string) {
    const [invoice] = await this.db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    if (!invoice) throw new NotFoundException('Invoice not found')

    const paymentRows = await this.db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), eq(payments.tenantId, tenantId)))

    const paymentIds = paymentRows.map((row) => row.id)
    const recordFilters = [
      and(eq(auditLogs.recordType, 'invoice'), eq(auditLogs.recordId, invoiceId)),
    ]
    if (paymentIds.length) {
      recordFilters.push(
        and(eq(auditLogs.recordType, 'payment'), inArray(auditLogs.recordId, paymentIds)),
      )
    }

    const rows = await this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        recordType: auditLogs.recordType,
        recordId: auditLogs.recordId,
        actorUserId: auditLogs.actorUserId,
        actorName: users.displayName,
        reason: auditLogs.reason,
        before: auditLogs.before,
        after: auditLogs.after,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(and(eq(auditLogs.tenantId, tenantId), or(...recordFilters)!))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100)

    return { data: rows }
  }

  async createInvoice(tenantId: string, actorUserId: string, dto: CreateInvoiceDto) {
    const invoiceNumber = buildInvoiceNumber(new Date())
    const subtotal = dto.items.reduce((s, i) => s + (i.unitAmount * (i.quantity ?? 1)), 0)

    const [invoice] = await this.db.insert(invoices).values({
      tenantId, createdBy: actorUserId, updatedBy: actorUserId,
      studentId: dto.studentId,
      source: 'ad_hoc',
      invoiceNumber,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: dto.dueDate ?? null,
      subtotal: String(subtotal),
      discountTotal: '0',
      total: String(subtotal),
      status: 'unpaid' as const,
    }).returning()

    await this.db.insert(invoiceItems).values(
      dto.items.map(i => ({
        tenantId, createdBy: actorUserId, updatedBy: actorUserId,
        invoiceId: invoice!.id,
        feeItemId: i.feeItemId ?? null,
        description: i.description,
        quantity: String(i.quantity ?? 1),
        unitAmount: String(i.unitAmount),
        total: String(i.unitAmount * (i.quantity ?? 1)),
      }))
    )

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'invoice.create',
        recordType: 'invoice',
        recordId: invoice!.id,
        ...(dto.reason?.trim() ? { reason: dto.reason.trim() } : {}),
        after: { ...(invoice as Record<string, unknown>), source: 'ad_hoc' },
      })
    )

    return invoice
  }

  async generateMonthlyInvoices(tenantId: string, actorUserId: string, dto: GenerateMonthlyInvoicesDto) {
    const [year] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, dto.academicYearId)))

    if (!year) {
      throw new NotFoundException('Academic year not found')
    }

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'invoice.generate_monthly',
        recordType: 'invoice',
        recordId: tenantId,
        after: { billingMonth: dto.billingMonth, academicYearId: dto.academicYearId },
      }),
    )

    const asyncMode = process.env.INVOICE_GENERATION_ASYNC === 'true'

    if (asyncMode) {
      await this.invoicesQueueService.enqueueGenerateMonthlyInvoices({
        tenantId,
        academicYearId: dto.academicYearId,
        billingMonth: dto.billingMonth,
        triggeredByUserId: actorUserId,
      })

      return {
        status: 'queued' as const,
        message: 'Monthly invoice generation queued',
        month: dto.billingMonth,
        invoicesCreated: 0,
        studentsSkipped: 0,
        studentsProcessed: 0,
        invoiceIds: [] as string[],
      }
    }

    const result = await this.recurringBillingService.generate(tenantId, actorUserId, {
      academicYearId: dto.academicYearId,
      billingMonth: dto.billingMonth,
      gradeId: dto.gradeId ?? null,
    })

    return {
      status: 'completed' as const,
      message:
        result.invoicesCreated > 0
          ? `Created ${result.invoicesCreated} recurring invoice(s) for ${dto.billingMonth}.`
          : `No new recurring invoices for ${dto.billingMonth} — ${result.studentsSkipped} student(s) already billed or had no billable services.`,
      month: dto.billingMonth,
      ...result,
    }
  }

  /** Resolve the tenant's active academic year id, or null. */
  private async getActiveAcademicYearId(tenantId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, 'active')))
      .limit(1)
    return row?.id ?? null
  }

  /**
   * Generate (or return) the current month's recurring invoice for a single
   * student on demand, so finance staff can collect recurring fees in one step
   * without first running the monthly batch. Idempotent.
   */
  async ensureRecurringInvoice(
    tenantId: string,
    studentId: string,
    actorUserId: string,
    billingMonth?: string,
  ) {
    const academicYearId = await this.getActiveAcademicYearId(tenantId)
    if (!academicYearId) return { invoiceId: null }
    const month = billingMonth ?? new Date().toISOString().slice(0, 7)
    const invoiceId = await ensureRecurringInvoiceForStudent(this.db, {
      tenantId,
      studentId,
      academicYearId,
      billingMonth: month,
      actorUserId,
    })
    return { invoiceId }
  }

  private async getVerifiedNetPaid(invoiceId: string): Promise<number> {
    const rows = await this.db
      .select({ amount: payments.amount, kind: payments.kind })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), isNotNull(payments.verifiedAt)))

    return rows.reduce((sum, row) => {
      const amount = Number(row.amount)
      return row.kind === 'refund' ? sum - amount : sum + amount
    }, 0)
  }

  /**
   * Gross verified payments for an invoice — refunds are NOT subtracted. This is
   * the basis for how much is still collectable: once an amount has been paid it
   * stays "paid" for collection purposes even if later refunded, so a refund can
   * never reopen the balance and let the refunded amount be collected again.
   * (Use {@link getVerifiedNetPaid} for cash/revenue, which nets out refunds.)
   */
  private async getGrossVerifiedPaid(invoiceId: string): Promise<number> {
    const rows = await this.db
      .select({ amount: payments.amount })
      .from(payments)
      .where(and(
        eq(payments.invoiceId, invoiceId),
        eq(payments.kind, 'payment'),
        isNotNull(payments.verifiedAt),
      ))

    return rows.reduce((sum, row) => sum + Number(row.amount), 0)
  }

  private async getPendingVerificationTotal(invoiceId: string): Promise<number> {
    const rows = await this.db
      .select({ amount: payments.amount })
      .from(payments)
      .where(and(
        eq(payments.invoiceId, invoiceId),
        eq(payments.kind, 'payment'),
        isNull(payments.verifiedAt),
      ))

    return rows.reduce((sum, row) => sum + Number(row.amount), 0)
  }

  private async getRefundedTotalForPayment(paymentId: string): Promise<number> {
    const totals = await this.getRefundedTotalsForPayments([paymentId])
    return totals.get(paymentId) ?? 0
  }

  private async getRefundedTotalsForPayments(paymentIds: string[]): Promise<Map<string, number>> {
    const totals = new Map<string, number>()
    if (!paymentIds.length) return totals

    const rows = await this.db
      .select({
        refundedPaymentId: payments.refundedPaymentId,
        total: sum(payments.amount),
      })
      .from(payments)
      .where(and(
        inArray(payments.refundedPaymentId, paymentIds),
        eq(payments.kind, 'refund'),
        isNotNull(payments.verifiedAt),
      ))
      .groupBy(payments.refundedPaymentId)

    for (const row of rows) {
      if (row.refundedPaymentId) {
        totals.set(row.refundedPaymentId, Number(row.total ?? 0))
      }
    }

    return totals
  }

  private async recalculateInvoiceStatus(tenantId: string, invoiceId: string, actorUserId: string) {
    const [invoice] = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    if (!invoice) return

    if (['waived', 'cancelled'].includes(invoice.status)) return

    // Status is driven by GROSS payments so a refund never downgrades a paid
    // invoice back to partial (which would reopen it for collection). Refunds
    // only affect cash/revenue, surfaced separately as a cash-out line.
    const gross = await this.getGrossVerifiedPaid(invoiceId)
    const net = await this.getVerifiedNetPaid(invoiceId)
    const total = Number(invoice.total)

    let newStatus: 'unpaid' | 'partial' | 'paid' | 'refunded'
    if (gross <= 0) {
      newStatus = 'unpaid'
    } else if (net <= 0) {
      // Everything that was paid has been refunded.
      newStatus = 'refunded'
    } else if (gross >= total) {
      newStatus = 'paid'
    } else {
      newStatus = 'partial'
    }

    await this.db.update(invoices)
      .set({ status: newStatus, updatedBy: actorUserId, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  async listPayments(tenantId: string, query: ListPaymentsQueryDto) {
    const conditions = [eq(payments.tenantId, tenantId), eq(payments.kind, 'payment')]
    if (query.method) conditions.push(eq(payments.method, query.method as any))
    if (query.verified === true) conditions.push(isNotNull(payments.verifiedAt))
    if (query.verified === false) conditions.push(isNull(payments.verifiedAt))
    if (query.dateFrom) conditions.push(gte(payments.paidAt, new Date(query.dateFrom)))
    if (query.dateTo) conditions.push(lte(payments.paidAt, new Date(query.dateTo)))

    if (query.academicYearId) {
      conditions.push(this.paymentAcademicYearFilter(tenantId, query.academicYearId))
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`
      conditions.push(
        or(
          ilike(receipts.receiptNumber, term),
          ilike(students.fullName, term),
        )!,
      )
    }

    const limit = Math.min(query.limit ?? 50, 200)
    const offset = query.offset ?? 0

    const rows = await this.db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        kind: payments.kind,
        refundedPaymentId: payments.refundedPaymentId,
        amount: payments.amount,
        method: payments.method,
        referenceNumber: payments.referenceNumber,
        paidAt: payments.paidAt,
        verifiedAt: payments.verifiedAt,
        notes: payments.notes,
        createdAt: payments.createdAt,
        createdBy: payments.createdBy,
        invoiceNumber: invoices.invoiceNumber,
        invoiceIssueDate: invoices.issueDate,
        invoiceSource: invoices.source,
        receiptNumber: receipts.receiptNumber,
        studentFullName: students.fullName,
        gradeName: grades.name,
        classroomName: classrooms.name,
        recordedByName: users.displayName,
      })
      .from(payments)
      .leftJoin(invoices, and(eq(payments.invoiceId, invoices.id), eq(invoices.tenantId, tenantId)))
      .leftJoin(receipts, and(eq(receipts.paymentId, payments.id), eq(receipts.tenantId, tenantId)))
      .leftJoin(students, and(eq(invoices.studentId, students.id), eq(students.tenantId, tenantId)))
      .leftJoin(enrollments, this.enrollmentJoinCondition(tenantId, query.academicYearId))
      .leftJoin(grades, eq(enrollments.gradeId, grades.id))
      .leftJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .leftJoin(users, eq(payments.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt), desc(payments.paidAt))
      .limit(limit)
      .offset(offset)

    const [countRow] = await this.db
      .select({ total: count() })
      .from(payments)
      .leftJoin(invoices, and(eq(payments.invoiceId, invoices.id), eq(invoices.tenantId, tenantId)))
      .leftJoin(receipts, and(eq(receipts.paymentId, payments.id), eq(receipts.tenantId, tenantId)))
      .leftJoin(students, and(eq(invoices.studentId, students.id), eq(students.tenantId, tenantId)))
      .where(and(...conditions))

    const refundablePaymentIds = rows
      .filter((row) => row.kind === 'payment' && row.verifiedAt)
      .map((row) => row.id)
    const refundedTotals = await this.getRefundedTotalsForPayments(refundablePaymentIds)

    const data = rows.map((row) => {
      let refundableAmount: number | null = null
      if (row.kind === 'payment' && row.verifiedAt) {
        const refunded = refundedTotals.get(row.id) ?? 0
        refundableAmount = Math.max(0, Number(row.amount) - refunded)
      }
      return {
        ...row,
        paymentNumber: row.receiptNumber,
        refundableAmount,
        billingMonth: billingMonthFromIssueDate(row.invoiceIssueDate),
        paymentPlan: paymentPlanKeyFromInvoiceSource(row.invoiceSource),
      }
    })

    return { data, total: Number(countRow?.total ?? 0), limit, offset }
  }

  async getPaymentMetrics(tenantId: string, query: PaymentMetricsQueryDto) {
    const conditions = [
      eq(payments.tenantId, tenantId),
      eq(payments.kind, 'payment'),
      isNotNull(payments.verifiedAt),
    ]

    if (query.academicYearId) {
      conditions.push(this.paymentAcademicYearFilter(tenantId, query.academicYearId))
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [totalsRow] = await this.db
      .select({
        receivedTotal: sql<string>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        receivedCount: sql<number>`COUNT(*)::int`,
        todayTotal: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paidAt} >= ${today} AND ${payments.paidAt} < ${tomorrow} THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        todayCount: sql<number>`COUNT(CASE WHEN ${payments.paidAt} >= ${today} AND ${payments.paidAt} < ${tomorrow} THEN 1 END)::int`,
      })
      .from(payments)
      .where(and(...conditions))

    const methodRows = await this.db
      .select({
        method: payments.method,
        total: sql<string>`SUM(${payments.amount}::numeric)`,
      })
      .from(payments)
      .where(and(...conditions))
      .groupBy(payments.method)

    const receivedTotal = Number(totalsRow?.receivedTotal ?? 0)
    const receivedCount = totalsRow?.receivedCount ?? 0
    const todayTotal = Number(totalsRow?.todayTotal ?? 0)
    const todayCount = totalsRow?.todayCount ?? 0

    let topMethod: string | null = null
    let topMethodShare = 0
    if (receivedTotal > 0 && methodRows.length) {
      for (const row of methodRows) {
        const share = Number(row.total ?? 0) / receivedTotal
        if (share > topMethodShare) {
          topMethod = row.method
          topMethodShare = share
        }
      }
    }

    const { term } = await this.resolveCurrentTerm(tenantId, query.academicYearId)

    return {
      receivedTotal,
      receivedCount,
      todayTotal,
      todayCount,
      topMethod,
      topMethodShare: Math.round(topMethodShare * 100),
      averageReceipt: receivedCount ? Math.round(receivedTotal / receivedCount) : 0,
      termName: term?.name ?? null,
    }
  }

  async recordPayment(tenantId: string, invoiceId: string, actorUserId: string, dto: RecordPaymentDto) {
    const [invoice] = await this.db.select().from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    if (!invoice) throw new NotFoundException('Invoice not found')

    if (['paid', 'cancelled', 'waived', 'refunded'].includes(invoice.status)) {
      throw new BadRequestException('This invoice is closed — no further payments can be recorded.')
    }

    if (dto.method !== 'cash' && !dto.referenceNumber?.trim()) {
      throw new BadRequestException('Transaction ID is required for non-cash payments.')
    }

    const invoiceTotal = Number(invoice.total)
    // Recordable is based on GROSS payments: a refunded amount has already been
    // collected once and must not become collectable again.
    const grossPaid = await this.getGrossVerifiedPaid(invoiceId)
    const pendingVerification = await this.getPendingVerificationTotal(invoiceId)
    const balanceDue = invoiceTotal - grossPaid
    const recordable = computeRecordablePaymentBalance(balanceDue, pendingVerification)

    if (balanceDue <= 0) {
      throw new BadRequestException('This invoice is already fully paid.')
    }
    if (recordable <= 0) {
      throw new BadRequestException(
        'The outstanding balance is fully covered by payment(s) awaiting verification.',
      )
    }
    if (dto.amount > recordable) {
      throw new BadRequestException(
        `Payment amount exceeds recordable balance (${recordable}).`,
      )
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date()
    const isCash = dto.method === 'cash'
    const [payment] = await this.db.insert(payments).values({
      tenantId, createdBy: actorUserId, updatedBy: actorUserId,
      invoiceId,
      kind: 'payment',
      amount: String(dto.amount),
      method: dto.method as any,
      referenceNumber: dto.referenceNumber?.trim() || null,
      notes: dto.notes,
      paidAt,
      verifiedAt: isCash ? new Date() : null,
      verifiedByUserId: isCash ? actorUserId : null,
    }).returning()

    await this.recalculateInvoiceStatus(tenantId, invoiceId, actorUserId)

    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'payment.record', recordType: 'payment', recordId: payment!.id, after: payment })
    )

    const updatedGrossPaid = await this.getGrossVerifiedPaid(invoiceId)
    const remainingBalance = Math.max(0, invoiceTotal - updatedGrossPaid)
    const receipt = await this.issueReceiptForPayment(tenantId, actorUserId, payment!.id, {
      studentId: invoice.studentId,
      enrollmentId: invoice.enrollmentId,
      amountPaid: dto.amount,
      method: dto.method,
      referenceNumber: dto.referenceNumber?.trim() || null,
      remainingBalance,
      invoiceNumber: invoice.invoiceNumber,
    })

    return { payment, receipt }
  }

  async sendInvoiceToGuardian(tenantId: string, invoiceId: string, actorUserId: string) {
    const invoice = await this.getInvoice(tenantId, invoiceId)
    const recipient = invoice.guardianEmail?.trim()
    if (!recipient) {
      throw new BadRequestException('Primary guardian has no email on file.')
    }

    await this.notificationsService.sendEmail({
      tenantId,
      templateKey: 'invoice-sent',
      recipient,
      variables: {
        invoiceNumber: invoice.invoiceNumber,
        studentName: invoice.studentFullName,
        total: invoice.total,
        dueDate: invoice.dueDate ?? '',
        guardianName: invoice.guardianName ?? '',
      },
    })

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: 'invoice.send_guardian',
        recordType: 'invoice',
        recordId: invoiceId,
        after: { recipient, invoiceNumber: invoice.invoiceNumber },
      }),
    )

    return { sent: true }
  }

  async verifyPayment(tenantId: string, paymentId: string, actorUserId: string, dto: VerifyPaymentDto) {
    const [payment] = await this.db.select().from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)))
    if (!payment) throw new NotFoundException('Payment not found')
    if (payment.verifiedAt) throw new BadRequestException('Payment is already verified.')

    const [updated] = await this.db.update(payments)
      .set({
        verifiedAt: new Date(),
        verifiedByUserId: actorUserId,
        referenceNumber: dto.referenceNumber?.trim() ?? payment.referenceNumber,
        notes: dto.notes ?? payment.notes,
        overrideReason: dto.reason.trim(),
        paidAt: payment.paidAt ?? new Date(),
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning()

    await this.recalculateInvoiceStatus(tenantId, payment.invoiceId, actorUserId)

    await this.auditService.recordSensitiveCorrection({
      tenantId,
      actorUserId,
      action: 'payment.verify',
      recordType: 'payment',
      recordId: paymentId,
      reason: dto.reason,
      before: payment as Record<string, unknown>,
      after: updated as Record<string, unknown>
    })
    return updated
  }

  async refundPayment(tenantId: string, paymentId: string, actorUserId: string, dto: RefundPaymentDto) {
    const [payment] = await this.db.select().from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)))
    if (!payment) throw new NotFoundException('Payment not found')
    if (payment.kind !== 'payment') throw new BadRequestException('Only payments can be refunded.')
    if (!payment.verifiedAt) throw new BadRequestException('Only verified payments can be refunded.')

    const alreadyRefunded = await this.getRefundedTotalForPayment(paymentId)
    const maxRefund = Number(payment.amount) - alreadyRefunded
    const refundAmount = dto.amount ?? maxRefund

    if (maxRefund <= 0) {
      throw new BadRequestException('This payment has already been fully refunded.')
    }
    if (refundAmount <= 0 || refundAmount > maxRefund) {
      throw new BadRequestException(`Refund amount must be between 0 and ${maxRefund}.`)
    }

    if (payment.method !== 'cash' && !dto.transactionId?.trim()) {
      throw new BadRequestException('Refund transaction ID is required for non-cash refunds.')
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date()
    const isCash = payment.method === 'cash'
    const [refund] = await this.db.insert(payments).values({
      tenantId,
      createdBy: actorUserId,
      updatedBy: actorUserId,
      invoiceId: payment.invoiceId,
      kind: 'refund',
      refundedPaymentId: paymentId,
      amount: String(refundAmount),
      method: payment.method,
      referenceNumber: dto.transactionId?.trim() || null,
      notes: dto.reason.trim(),
      paidAt,
      verifiedAt: isCash ? new Date() : null,
      verifiedByUserId: isCash ? actorUserId : null,
    }).returning()

    await this.recalculateInvoiceStatus(tenantId, payment.invoiceId, actorUserId)

    await this.auditService.recordSensitiveCorrection({
      tenantId,
      actorUserId,
      action: 'payment.refund',
      recordType: 'payment',
      recordId: refund!.id,
      reason: dto.reason,
      before: { paymentId, amount: refundAmount },
      after: refund as Record<string, unknown>,
    })
    return refund
  }

  // ── Receipts ───────────────────────────────────────────────────────────────

  /**
   * Balance totals from a student's invoice rows. Shared by the per-student
   * summary and the family-group billing roll-up so the math stays in one place.
   * - `totalOutstanding` — verified balance still due (what the family owes).
   * - `totalPaid` — verified net received.
   * - `recordable` — how much can be collected now, i.e. outstanding minus
   *   amounts already covered by payments awaiting verification. The Collect
   *   action is gated on this so we never double-collect against a pending payment.
   */
  private async balanceFromInvoices(
    rows: Array<{ id: string; total: string; status: string }>,
  ) {
    let totalOutstanding = 0
    let totalPaid = 0
    let recordable = 0
    for (const invoice of rows) {
      // Net cash actually received (gross payments minus refunds) — what the
      // family has effectively paid, counted even on cancelled/waived invoices.
      const net = await this.getVerifiedNetPaid(invoice.id)
      totalPaid += net

      // Cancelled / waived invoices owe nothing and cannot be collected against.
      if (['cancelled', 'waived'].includes(invoice.status)) continue

      // AR balance & recordable are driven by GROSS payments so a refund never
      // re-creates debt or reopens the invoice for collection.
      const gross = await this.getGrossVerifiedPaid(invoice.id)
      const remaining = Math.max(0, Number(invoice.total) - gross)
      const pending = await this.getPendingVerificationTotal(invoice.id)
      totalOutstanding += remaining
      recordable += computeRecordablePaymentBalance(remaining, pending)
    }
    return { totalOutstanding, totalPaid, recordable }
  }

  /** Per-student outstanding/paid for every member of a family group (household). */
  async getFamilyGroupBilling(tenantId: string, familyGroupId: string) {
    const memberRows = await this.db
      .select({ id: students.id, fullName: students.fullName })
      .from(students)
      .where(
        and(eq(students.tenantId, tenantId), eq(students.familyGroupId, familyGroupId)),
      )
      .orderBy(students.fullName)

    const studentsBilling = await Promise.all(
      memberRows.map(async (member) => {
        const invoiceRows = await this.db
          .select({ id: invoices.id, total: invoices.total, status: invoices.status })
          .from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, member.id)))
        const { totalOutstanding, totalPaid, recordable } =
          await this.balanceFromInvoices(invoiceRows)
        return {
          studentId: member.id,
          fullName: member.fullName,
          totalOutstanding,
          totalPaid,
          recordable,
        }
      }),
    )

    return { students: studentsBilling }
  }

  async getStudentBillingSummary(tenantId: string, studentId: string) {
    const [student] = await this.db
      .select({ id: students.id, fullName: students.fullName })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))

    if (!student) {
      throw new NotFoundException('Student not found')
    }

    const invoiceRows = await this.db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        source: invoices.source,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        total: invoices.total,
        status: invoices.status,
        enrollmentId: invoices.enrollmentId,
      })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId)))
      .orderBy(sql`${invoices.issueDate} DESC`)

    const { totalOutstanding, totalPaid, recordable } =
      await this.balanceFromInvoices(invoiceRows)

    const activeServices = await this.db
      .select({
        id: studentServices.id,
        feeItemId: studentServices.feeItemId,
        feeItemName: feeItems.name,
        billingType: feeItems.billingType,
        effectiveFrom: studentServices.effectiveFrom,
        effectiveTo: studentServices.effectiveTo,
      })
      .from(studentServices)
      .innerJoin(feeItems, eq(studentServices.feeItemId, feeItems.id))
      .where(
        and(
          eq(studentServices.tenantId, tenantId),
          eq(studentServices.studentId, studentId),
          isNull(studentServices.effectiveTo),
        ),
      )

    const feePlanRows = await this.db
      .select({
        feeItemId: enrollmentFeePlans.feeItemId,
        amount: enrollmentFeePlans.amount,
      })
      .from(enrollmentFeePlans)
      .where(eq(enrollmentFeePlans.tenantId, tenantId))

    const monthlyAmountByFeeItem = new Map<string, number>()
    for (const row of feePlanRows) {
      const amount = Number(row.amount)
      const existing = monthlyAmountByFeeItem.get(row.feeItemId)
      if (existing == null || amount < existing) {
        monthlyAmountByFeeItem.set(row.feeItemId, amount)
      }
    }

    const activeServicesWithAmounts = activeServices.map((service) => ({
      ...service,
      monthlyAmount: monthlyAmountByFeeItem.get(service.feeItemId) ?? null,
    }))

    const discounts = await this.db
      .select({
        id: studentDiscounts.id,
        ruleName: discountRules.name,
        status: studentDiscounts.status,
        reason: studentDiscounts.reason,
        effectiveFrom: studentDiscounts.effectiveFrom,
        effectiveTo: studentDiscounts.effectiveTo,
      })
      .from(studentDiscounts)
      .innerJoin(discountRules, eq(studentDiscounts.discountRuleId, discountRules.id))
      .where(and(eq(studentDiscounts.tenantId, tenantId), eq(studentDiscounts.studentId, studentId)))

    return {
      studentId,
      studentFullName: student.fullName,
      totalOutstanding,
      totalPaid,
      recordable,
      invoices: invoiceRows,
      activeServices: activeServicesWithAmounts,
      discounts,
    }
  }

  async getReceipt(tenantId: string, receiptId: string) {
    const [receipt] = await this.db.select().from(receipts)
      .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)))
    if (!receipt) throw new NotFoundException('Receipt not found')
    return receipt
  }

  // ── Billing roster & cashiering ──────────────────────────────────────────────

  private readonly CLOSED_STATUSES = ['paid', 'cancelled', 'waived', 'refunded']

  /** Resolve the academic-year window and (current/first) term for a period. */
  private async resolveBillingPeriod(tenantId: string, academicYearId: string) {
    const [year] = await this.db
      .select({ id: academicYears.id, name: academicYears.name, startsOn: academicYears.startsOn, endsOn: academicYears.endsOn })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)))
    if (!year) throw new NotFoundException('Academic year not found')

    const termRows = await this.db
      .select({ id: terms.id, name: terms.name, startsOn: terms.startsOn, endsOn: terms.endsOn })
      .from(terms)
      .where(and(eq(terms.tenantId, tenantId), eq(terms.academicYearId, academicYearId)))
      .orderBy(terms.startsOn)

    const today = new Date().toISOString().slice(0, 10)
    const currentTerm =
      termRows.find((term) => term.startsOn <= today && term.endsOn >= today) ?? termRows[0] ?? null

    return { year, currentTerm, periodStart: year.startsOn, periodEnd: year.endsOn }
  }

  /**
   * Per-student billing roster for the Fees & Billing workspace: billed / paid /
   * balance and collection metrics, scoped to an academic year and optional grade.
   */
  async getBillingRoster(tenantId: string, query: BillingRosterQueryDto) {
    const metricsOnly = query.metricsOnly === true
    const { year, currentTerm, periodStart, periodEnd } = await this.resolveBillingPeriod(
      tenantId,
      query.academicYearId,
    )
    const issueDateRange = this.resolveIssueDateFilter(query)
    const { start: filterStart, end: filterEnd } = issueDateRange ?? {
      start: periodStart,
      end: periodEnd,
    }

    const gradeSet = new Map<string, { id: string; name: string; sortOrder: number }>()
    if (!metricsOnly) {
      // Grade chips must list every grade with confirmed enrollments for the year,
      // regardless of the active gradeId filter on rows/metrics.
      const gradeNavRows = await this.db
        .select({
          id: grades.id,
          name: grades.name,
          sortOrder: grades.sortOrder,
        })
        .from(enrollments)
        .innerJoin(grades, eq(enrollments.gradeId, grades.id))
        .where(
          and(
            eq(enrollments.tenantId, tenantId),
            eq(enrollments.academicYearId, query.academicYearId),
            isNotNull(enrollments.confirmedAt),
          ),
        )
        .groupBy(grades.id, grades.name, grades.sortOrder)
        .orderBy(grades.sortOrder)

      for (const grade of gradeNavRows) {
        gradeSet.set(grade.id, grade)
      }
    }

    const enrollmentConditions = [
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.academicYearId, query.academicYearId),
      isNotNull(enrollments.confirmedAt),
    ]
    if (query.gradeId) enrollmentConditions.push(eq(enrollments.gradeId, query.gradeId))

    const enrollmentRows = await this.db
      .select({
        enrollmentId: enrollments.id,
        enrollmentInvoiceId: enrollments.invoiceId,
        studentId: enrollments.studentId,
        gradeId: enrollments.gradeId,
        gradeName: grades.name,
        gradeSortOrder: grades.sortOrder,
        classroomName: classrooms.name,
        classroomRoom: classrooms.room,
        studentFullName: students.fullName,
        admissionNumber: students.admissionNumber,
        guardianName: guardians.fullName,
        guardianPhone: guardians.phone,
      })
      .from(enrollments)
      .innerJoin(
        students,
        and(eq(enrollments.studentId, students.id), eq(students.tenantId, tenantId)),
      )
      .leftJoin(grades, eq(enrollments.gradeId, grades.id))
      .leftJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .leftJoin(familyGroups, eq(students.familyGroupId, familyGroups.id))
      .leftJoin(guardians, eq(familyGroups.primaryGuardianId, guardians.id))
      .where(and(...enrollmentConditions))
      .orderBy(desc(enrollments.confirmedAt))

    // De-dupe by student (a student may have multiple enrollment rows historically).
    const byStudent = new Map<string, (typeof enrollmentRows)[number]>()
    for (const row of enrollmentRows) {
      if (!byStudent.has(row.studentId)) byStudent.set(row.studentId, row)
    }
    const studentIds = [...byStudent.keys()]
    const enrollmentIds = enrollmentRows.map((row) => row.enrollmentId)
    const enrollmentInvoiceIds = enrollmentRows
      .map((row) => row.enrollmentInvoiceId)
      .filter((id): id is string => Boolean(id))

    const invoiceScopeParts = [
      ...(enrollmentIds.length > 0 ? [inArray(invoices.enrollmentId, enrollmentIds)] : []),
      ...(enrollmentInvoiceIds.length > 0 ? [inArray(invoices.id, enrollmentInvoiceIds)] : []),
      and(
        isNull(invoices.enrollmentId),
        gte(invoices.issueDate, filterStart),
        lte(invoices.issueDate, filterEnd),
      ),
    ]
    const invoiceScope =
      invoiceScopeParts.length === 1 ? invoiceScopeParts[0]! : or(...invoiceScopeParts)

    const invoiceRows = studentIds.length
      ? await this.db
          .select({
            id: invoices.id,
            studentId: invoices.studentId,
            total: invoices.total,
            status: invoices.status,
            dueDate: invoices.dueDate,
            issueDate: invoices.issueDate,
            source: invoices.source,
            createdAt: invoices.createdAt,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              inArray(invoices.studentId, studentIds),
              invoiceScope,
            ),
          )
          .orderBy(invoices.issueDate)
      : []

    const invoiceIds = invoiceRows.map((row) => row.id)
    const paidByInvoice = new Map<string, number>() // net cash (payments − refunds)
    const grossByInvoice = new Map<string, number>() // gross verified payments (no refund subtraction)
    const pendingByInvoice = new Map<string, number>()
    if (invoiceIds.length) {
      const paymentRows = await this.db
        .select({
          invoiceId: payments.invoiceId,
          amount: payments.amount,
          kind: payments.kind,
          verifiedAt: payments.verifiedAt,
        })
        .from(payments)
        .where(inArray(payments.invoiceId, invoiceIds))
      for (const row of paymentRows) {
        const amount = Number(row.amount)
        if (row.kind === 'refund') {
          if (row.verifiedAt) {
            const prev = paidByInvoice.get(row.invoiceId) ?? 0
            paidByInvoice.set(row.invoiceId, prev - amount)
          }
          continue
        }
        if (row.verifiedAt) {
          paidByInvoice.set(row.invoiceId, (paidByInvoice.get(row.invoiceId) ?? 0) + amount)
          grossByInvoice.set(row.invoiceId, (grossByInvoice.get(row.invoiceId) ?? 0) + amount)
        } else {
          const prev = pendingByInvoice.get(row.invoiceId) ?? 0
          pendingByInvoice.set(row.invoiceId, prev + amount)
        }
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const invoicesByStudent = new Map<string, typeof invoiceRows>()
    for (const inv of invoiceRows) {
      const bucket = invoicesByStudent.get(inv.studentId) ?? []
      bucket.push(inv)
      invoicesByStudent.set(inv.studentId, bucket)
    }

    type RosterRow = {
      studentId: string
      studentFullName: string
      admissionNumber: string
      gradeId: string
      gradeName: string
      classroomName: string | null
      guardianName: string | null
      guardianPhone: string | null
      billed: number
      paid: number
      balance: number
      pendingVerification: number
      recordableBalance: number
      status: 'paid' | 'partial' | 'due' | 'overdue'
      primaryInvoiceId: string | null
      primaryInvoiceCreatedAt: string | null
      primaryBillingMonth: string | null
      primaryPaymentPlan: ReturnType<typeof paymentPlanKeyFromInvoiceSource> | null
    }

    const rows: RosterRow[] = []
    const metrics = {
      billed: 0,
      collected: 0,
      outstanding: 0,
      overdue: 0,
      owingStudents: 0,
      collectibleStudents: 0,
      overdueStudents: 0,
    }

    for (const studentId of studentIds) {
      const meta = byStudent.get(studentId)!

      const studentInvoices = invoicesByStudent.get(studentId) ?? []
      let billed = 0
      let paid = 0 // net cash (for the collected metric)
      let grossPaid = 0 // gross verified payments (for balance / recordable)
      let pendingVerification = 0
      let hasOverdue = false
      let primaryInvoiceId: string | null = null
      let primaryInvoiceCreatedAt: string | null = null
      let primaryBillingMonth: string | null = null
      let primaryPaymentPlan: ReturnType<typeof paymentPlanKeyFromInvoiceSource> | null = null
      let latestInvoiceId: string | null = null
      let latestInvoice: (typeof invoiceRows)[number] | null = null

      for (const inv of studentInvoices) {
        billed += Number(inv.total)
        const net = paidByInvoice.get(inv.id) ?? 0
        const gross = grossByInvoice.get(inv.id) ?? 0
        paid += net
        grossPaid += gross
        pendingVerification += pendingByInvoice.get(inv.id) ?? 0
        latestInvoiceId = inv.id
        latestInvoice = inv
        const open = !this.CLOSED_STATUSES.includes(inv.status)
        const remaining = Number(inv.total) - gross
        if (open && remaining > 0) {
          if (!primaryInvoiceId) {
            primaryInvoiceId = inv.id
            primaryInvoiceCreatedAt = inv.createdAt instanceof Date ? inv.createdAt.toISOString() : String(inv.createdAt)
            primaryBillingMonth = billingMonthFromIssueDate(inv.issueDate)
            primaryPaymentPlan = paymentPlanKeyFromInvoiceSource(inv.source)
          }
          if (inv.dueDate && inv.dueDate < today) hasOverdue = true
        }
      }

      const resolvedPrimaryId = primaryInvoiceId ?? latestInvoiceId
      if (resolvedPrimaryId && latestInvoice && !primaryInvoiceCreatedAt) {
        const primary = studentInvoices.find((inv) => inv.id === resolvedPrimaryId) ?? latestInvoice
        primaryInvoiceCreatedAt =
          primary.createdAt instanceof Date ? primary.createdAt.toISOString() : String(primary.createdAt)
        primaryBillingMonth = billingMonthFromIssueDate(primary.issueDate)
        primaryPaymentPlan = paymentPlanKeyFromInvoiceSource(primary.source)
      }

      const balance = Math.max(0, billed - grossPaid)
      const recordableBalance = computeRecordablePaymentBalance(balance, pendingVerification)
      let status: RosterRow['status']
      if (billed > 0 && balance <= 0) status = 'paid'
      else if (hasOverdue) status = 'overdue'
      else if (paid > 0 && balance > 0) status = 'partial'
      else status = 'due'

      metrics.billed += billed
      metrics.collected += paid
      metrics.outstanding += balance
      if (balance > 0) metrics.owingStudents += 1
      if (recordableBalance > 0) metrics.collectibleStudents += 1
      if (status === 'overdue') {
        metrics.overdue += balance
        metrics.overdueStudents += 1
      }

      if (!metricsOnly) {
        rows.push({
          studentId,
          studentFullName: meta.studentFullName,
          admissionNumber: meta.admissionNumber,
          gradeId: meta.gradeId,
          gradeName: meta.gradeName ?? '—',
          classroomName: meta.classroomName ?? null,
          guardianName: meta.guardianName ?? null,
          guardianPhone: meta.guardianPhone ?? null,
          billed,
          paid,
          balance,
          pendingVerification,
          recordableBalance,
          status,
          primaryInvoiceId: resolvedPrimaryId,
          primaryInvoiceCreatedAt,
          primaryBillingMonth,
          primaryPaymentPlan,
        })
      }
    }

    const collectionRate = metrics.billed > 0 ? Math.round((metrics.collected / metrics.billed) * 100) : 0

    if (metricsOnly) {
      return {
        academicYear: { id: year.id, name: year.name },
        term: currentTerm ? { id: currentTerm.id, name: currentTerm.name } : null,
        grades: [],
        metrics: { ...metrics, collectionRate, totalStudents: studentIds.length },
        rows: [],
        total: 0,
        limit: 0,
        offset: 0,
      }
    }

    let filtered = rows
    if (query.owingOnly) filtered = filtered.filter((row) => row.balance > 0)
    if (query.status) filtered = filtered.filter((row) => row.status === query.status)
    if (query.search) {
      const needle = query.search.toLowerCase()
      filtered = filtered.filter(
        (row) =>
          row.studentFullName.toLowerCase().includes(needle) ||
          (row.guardianName?.toLowerCase().includes(needle) ?? false) ||
          row.admissionNumber.toLowerCase().includes(needle),
      )
    }

    const statusSortRank: Record<RosterRow['status'], number> = {
      overdue: 0,
      due: 1,
      partial: 2,
      paid: 3,
    }
    const sortBy = query.sortBy ?? 'student'
    const sortDir = query.sortDir ?? 'asc'
    const direction = sortDir === 'asc' ? 1 : -1

    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'student') {
        cmp = a.studentFullName.localeCompare(b.studentFullName)
      } else if (sortBy === 'status') {
        cmp = statusSortRank[a.status] - statusSortRank[b.status]
      } else {
        cmp = a.balance - b.balance
      }
      return cmp * direction
    })

    const total = filtered.length
    const limit = query.owingOnly ? Math.min(query.limit ?? 500, 500) : Math.min(query.limit ?? 50, 200)
    const offset = query.offset ?? 0
    const pagedRows = filtered.slice(offset, offset + limit)

    const gradeList = [...gradeSet.values()].sort((a, b) => a.sortOrder - b.sortOrder)

    return {
      academicYear: { id: year.id, name: year.name },
      term: currentTerm ? { id: currentTerm.id, name: currentTerm.name } : null,
      grades: gradeList.map((grade) => ({ id: grade.id, name: grade.name })),
      metrics: { ...metrics, collectionRate, totalStudents: rows.length },
      rows: pagedRows,
      total,
      limit,
      offset,
    }
  }

  private async nextReceiptNumber(tenantId: string, prefix: string) {
    return buildPaymentNumber(prefix.trim() || 'PMT')
  }

  private async resolveStudentBillingContext(
    tenantId: string,
    studentId: string,
    enrollmentId?: string | null,
  ) {
    const enrollmentConditions = [
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, 'approved'),
    ]
    if (enrollmentId) {
      enrollmentConditions.push(eq(enrollments.id, enrollmentId))
    }

    const [enrollment] = await this.db
      .select({
        gradeName: grades.name,
        classroomName: classrooms.name,
        classroomRoom: classrooms.room,
        academicYearId: enrollments.academicYearId,
      })
      .from(enrollments)
      .leftJoin(grades, eq(enrollments.gradeId, grades.id))
      .leftJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .where(and(...enrollmentConditions))
      .orderBy(desc(enrollments.confirmedAt))

    let academicYearName = '—'
    let termName: string | null = null
    if (enrollment?.academicYearId) {
      const { year, currentTerm } = await this.resolveBillingPeriod(tenantId, enrollment.academicYearId)
      academicYearName = year.name
      termName = currentTerm?.name ?? null
    }

    const [settings] = await this.db
      .select({
        schoolName: tenantSettings.schoolName,
        address: tenantSettings.address,
        contactPhone: tenantSettings.contactPhone,
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
    const [tenant] = await this.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
    const [student] = await this.db
      .select({ fullName: students.fullName })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
    const [guardian] = await this.db
      .select({ fullName: guardians.fullName, phone: guardians.phone, email: guardians.email })
      .from(students)
      .leftJoin(familyGroups, eq(students.familyGroupId, familyGroups.id))
      .leftJoin(guardians, eq(familyGroups.primaryGuardianId, guardians.id))
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))

    return {
      studentFullName: student?.fullName ?? '—',
      gradeName: enrollment?.gradeName ?? null,
      classroomName: enrollment?.classroomName ?? null,
      room: enrollment?.classroomRoom ?? null,
      guardianName: guardian?.fullName ?? null,
      guardianPhone: guardian?.phone ?? null,
      guardianEmail: guardian?.email ?? null,
      schoolName: settings?.schoolName ?? tenant?.name ?? 'School',
      schoolAddress: settings?.address ?? null,
      schoolContactPhone: settings?.contactPhone ?? null,
      academicYearName,
      termName,
    }
  }

  private async issueReceiptForPayment(
    tenantId: string,
    actorUserId: string,
    paymentId: string,
    input: {
      studentId: string
      enrollmentId?: string | null
      amountPaid: number
      method: string
      referenceNumber: string | null
      remainingBalance: number
      invoiceNumber?: string | null
    },
  ) {
    const context = await this.resolveStudentBillingContext(
      tenantId,
      input.studentId,
      input.enrollmentId,
    )
    const [settings] = await this.db
      .select({ receiptPrefix: tenantSettings.receiptPrefix })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
    const [cashier] = await this.db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, actorUserId))

    const receiptPrefix = settings?.receiptPrefix?.trim() || 'RCPT'
    const receiptNumber = await this.nextReceiptNumber(tenantId, receiptPrefix)
    const [receiptRow] = await this.db
      .insert(receipts)
      .values({
        tenantId,
        createdBy: actorUserId,
        updatedBy: actorUserId,
        paymentId,
        receiptNumber,
      })
      .returning()

    return {
      id: receiptRow!.id,
      receiptNumber,
      issuedAt: receiptRow!.issuedAt,
      schoolName: context.schoolName,
      studentName: context.studentFullName,
      gradeName: context.gradeName,
      classroomName: context.classroomName,
      room: context.room,
      guardianName: context.guardianName,
      guardianPhone: context.guardianPhone,
      method: input.method,
      academicYearName: context.academicYearName,
      termName: context.termName,
      referenceNumber: input.referenceNumber,
      cashier: cashier?.displayName ?? '—',
      amountPaid: input.amountPaid,
      remainingBalance: input.remainingBalance,
      currency: 'MMK',
      invoiceNumber: input.invoiceNumber ?? null,
    }
  }

  /**
   * Cashier flow for the Fees & Billing workspace: record a (point-of-sale,
   * immediately-verified) payment against a student's oldest open invoice and
   * issue a printable receipt payload.
   */
  async collectPayment(tenantId: string, actorUserId: string, dto: CollectPaymentDto) {
    const [enrollment] = await this.db
      .select({
        gradeName: grades.name,
        classroomName: classrooms.name,
        classroomRoom: classrooms.room,
        academicYearId: enrollments.academicYearId,
      })
      .from(enrollments)
      .leftJoin(grades, eq(enrollments.gradeId, grades.id))
      .leftJoin(classrooms, eq(enrollments.classroomId, classrooms.id))
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.studentId, dto.studentId),
          eq(enrollments.status, 'approved'),
          ...(dto.academicYearId ? [eq(enrollments.academicYearId, dto.academicYearId)] : []),
        ),
      )
      .orderBy(desc(enrollments.confirmedAt))

    const academicYearId = dto.academicYearId ?? enrollment?.academicYearId
    if (!academicYearId) throw new BadRequestException('No active enrollment for this student.')

    const { year, currentTerm, periodStart, periodEnd } = await this.resolveBillingPeriod(
      tenantId,
      academicYearId,
    )

    // One-click recurring collection: make sure the current month's recurring
    // invoice exists before we look for something to collect against, so finance
    // staff never have to run the monthly batch first.
    await ensureRecurringInvoiceForStudent(this.db, {
      tenantId,
      studentId: dto.studentId,
      academicYearId,
      billingMonth: new Date().toISOString().slice(0, 7),
      actorUserId,
    })

    const openInvoices = await this.db
      .select({ id: invoices.id, total: invoices.total, status: invoices.status })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.studentId, dto.studentId),
          gte(invoices.issueDate, periodStart),
          lte(invoices.issueDate, periodEnd),
          inArray(invoices.status, ['unpaid', 'partial', 'overdue'] as any[]),
        ),
      )
      .orderBy(invoices.issueDate)

    if (!openInvoices.length) {
      throw new BadRequestException('This student has no open invoice to collect against.')
    }

    if (dto.amount <= 0) throw new BadRequestException('Amount must be greater than zero.')
    const isCash = dto.method === 'cash'
    if (!isCash && !dto.referenceNumber?.trim()) {
      throw new BadRequestException('Transaction ID is required for non-cash payments.')
    }

    type ApplicableInvoice = { id: string; total: string; recordable: number }
    const applicableInvoices: ApplicableInvoice[] = []
    let totalRecordable = 0

    for (const invoice of openInvoices) {
      const gross = await this.getGrossVerifiedPaid(invoice.id)
      const pendingVerification = await this.getPendingVerificationTotal(invoice.id)
      const balanceDue = Number(invoice.total) - gross
      const recordable = computeRecordablePaymentBalance(balanceDue, pendingVerification)
      if (recordable > 0) {
        applicableInvoices.push({ id: invoice.id, total: invoice.total, recordable })
        totalRecordable += recordable
      }
    }

    if (totalRecordable <= 0) {
      throw new BadRequestException(
        'The outstanding balance is fully covered by payment(s) awaiting verification.',
      )
    }
    if (dto.amount > totalRecordable) {
      throw new BadRequestException(
        `Payment amount exceeds recordable balance (${totalRecordable}).`,
      )
    }

    // Spread the amount across open invoices, oldest first.
    let remainingToApply = dto.amount
    let lastPaymentId: string | null = null
    let lastInvoiceId: string | null = null

    for (const invoice of applicableInvoices) {
      if (remainingToApply <= 0) break
      const applied = Math.min(remainingToApply, invoice.recordable)
      const [payment] = await this.db
        .insert(payments)
        .values({
          tenantId,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          invoiceId: invoice.id,
          kind: 'payment',
          amount: String(applied),
          method: dto.method as any,
          referenceNumber: dto.referenceNumber?.trim() || null,
          notes: dto.notes?.trim() || null,
          paidAt: new Date(),
          // Non-cash (bank transfer / wallet) payments require verification before
          // they count as paid — mirror recordPayment() so the rule is consistent
          // whether collected from the Invoice or the Collection module.
          verifiedAt: isCash ? new Date() : null,
          verifiedByUserId: isCash ? actorUserId : null,
        })
        .returning()

      await this.recalculateInvoiceStatus(tenantId, invoice.id, actorUserId)
      await this.auditService.recordEvent(
        this.auditService.createEvent({
          tenantId,
          actorUserId,
          action: 'payment.collect',
          recordType: 'payment',
          recordId: payment!.id,
          after: payment,
        }),
      )

      remainingToApply -= applied
      lastPaymentId = payment!.id
      lastInvoiceId = invoice.id
    }

    if (!lastPaymentId || !lastInvoiceId) {
      throw new BadRequestException('Payment could not be applied — the balance is already settled.')
    }

    // Remaining student balance across the billing period after this collection.
    const periodInvoices = await this.db
      .select({ id: invoices.id, total: invoices.total })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.studentId, dto.studentId),
          gte(invoices.issueDate, periodStart),
          lte(invoices.issueDate, periodEnd),
        ),
      )
    let remainingBalance = 0
    for (const invoice of periodInvoices) {
      const gross = await this.getGrossVerifiedPaid(invoice.id)
      const pendingVerification = await this.getPendingVerificationTotal(invoice.id)
      remainingBalance += computeRecordablePaymentBalance(Number(invoice.total) - gross, pendingVerification)
    }

    const receipt = await this.issueReceiptForPayment(tenantId, actorUserId, lastPaymentId, {
      studentId: dto.studentId,
      amountPaid: dto.amount,
      method: dto.method,
      referenceNumber: dto.referenceNumber?.trim() || null,
      remainingBalance,
    })

    return {
      payment: { id: lastPaymentId, invoiceId: lastInvoiceId },
      receipt,
    }
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  private resolveIssueDateFilter(query: {
    month?: string
    dateFrom?: string
    dateTo?: string
  }) {
    const dateFrom = query.dateFrom?.trim()
    const dateTo = query.dateTo?.trim()
    if (dateFrom && dateTo) {
      return { start: dateFrom, end: dateTo }
    }
    const month = query.month?.trim()
    if (month) {
      return this.issueDateRangeForMonth(month)
    }
    return null
  }

  private issueDateRangeForMonth(month: string) {
    const parts = month.split('-')
    const year = Number(parts[0] ?? 0)
    const monthNum = Number(parts[1] ?? 0)
    if (!year || monthNum < 1 || monthNum > 12) {
      throw new BadRequestException('Invalid month; expected YYYY-MM')
    }
    const start = `${month}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const end = `${month}-${String(lastDay).padStart(2, '0')}`
    return { start, end }
  }

  private monthRange(month: string) {
    const parts = month.split('-')
    const year = Number(parts[0] ?? 0)
    const monthNum = Number(parts[1] ?? 0)
    const start = new Date(year, monthNum - 1, 1)
    const end = new Date(year, monthNum, 0, 23, 59, 59)
    const prevMonth =
      monthNum === 1
        ? `${year - 1}-12`
        : `${year}-${String(monthNum - 1).padStart(2, '0')}`
    return { start, end, prevMonth }
  }

  private monthLabel(month: string) {
    const parts = month.split('-').map(Number)
    const year = parts[0] ?? 0
    const monthNum = parts[1] ?? 1
    return new Date(year, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'short' })
  }

  private calcTrendPercent(current: number, previous: number) {
    if (previous <= 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 1000) / 10
  }

  /**
   * Net verified cash = verified payments minus verified refunds. Revenue and
   * cash-flow must use this so a refund reduces (not inflates) reported revenue.
   */
  private readonly netVerifiedPaymentExpr = sql<string>`COALESCE(SUM(CASE WHEN ${payments.kind} = 'refund' THEN -${payments.amount}::numeric ELSE ${payments.amount}::numeric END), 0)`

  private async sumVerifiedPayments(tenantId: string, start: Date, end: Date) {
    const result = await this.db
      .select({ total: this.netVerifiedPaymentExpr })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          sql`${payments.verifiedAt} >= ${start}`,
          sql`${payments.verifiedAt} <= ${end}`,
        ),
      )
    return Number(result[0]?.total ?? 0)
  }

  private async sumPaidPayroll(tenantId: string, start: Date, end: Date) {
    const result = await this.db
      .select({ total: sum(payrollRecords.netAmount) })
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.tenantId, tenantId),
          eq(payrollRecords.status, 'paid'),
          sql`${payrollRecords.paidAt} >= ${start}`,
          sql`${payrollRecords.paidAt} <= ${end}`,
        ),
      )
    return Number(result[0]?.total ?? 0)
  }

  private async getMonthlyTrend(tenantId: string, endMonth: string, count = 6) {
    const parts = endMonth.split('-').map(Number)
    let year = parts[0] ?? 0
    let month = parts[1] ?? 1
    const months: string[] = []

    for (let i = count - 1; i >= 0; i -= 1) {
      let m = month - i
      let y = year
      while (m <= 0) {
        m += 12
        y -= 1
      }
      months.push(`${y}-${String(m).padStart(2, '0')}`)
    }

    return Promise.all(
      months.map(async (monthKey) => {
        const { start, end } = this.monthRange(monthKey)
        const [revenue, expenses] = await Promise.all([
          this.sumVerifiedPayments(tenantId, start, end),
          this.sumPaidPayroll(tenantId, start, end),
        ])
        return {
          month: monthKey,
          label: this.monthLabel(monthKey),
          revenue,
          expenses,
        }
      }),
    )
  }

  private async getPayableSummary(tenantId: string) {
    const rows = await this.db
      .select({
        total: sum(payrollRecords.netAmount),
        staffCount: count(),
      })
      .from(payrollRecords)
      .where(and(eq(payrollRecords.tenantId, tenantId), eq(payrollRecords.status, 'pending')))

    return {
      amount: Number(rows[0]?.total ?? 0),
      staffCount: Number(rows[0]?.staffCount ?? 0),
    }
  }

  private async getSalaryByDepartment(tenantId: string, start: Date, end: Date) {
    const rows = await this.db
      .select({
        departmentName: payrollRecords.departmentName,
        amount: sum(payrollRecords.netAmount),
        staffCount: count(),
        paidCount: sql<number>`count(*) filter (where ${payrollRecords.status} = 'paid')`,
        pendingCount: sql<number>`count(*) filter (where ${payrollRecords.status} = 'pending')`,
      })
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.tenantId, tenantId),
          or(
            and(
              eq(payrollRecords.status, 'paid'),
              sql`${payrollRecords.paidAt} >= ${start}`,
              sql`${payrollRecords.paidAt} <= ${end}`,
            ),
            eq(payrollRecords.status, 'pending'),
          ),
        ),
      )
      .groupBy(payrollRecords.departmentName)

    return rows
      .map((row) => ({
        departmentName: row.departmentName?.trim() || 'Unassigned',
        amount: Number(row.amount ?? 0),
        staffCount: Number(row.staffCount ?? 0),
        paidCount: Number(row.paidCount ?? 0),
        pendingCount: Number(row.pendingCount ?? 0),
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  private async buildFinanceOverviewInsights(
    tenantId: string,
    params: {
      scope: 'month' | 'term'
      month: string
      term: { startsOn: string; endsOn: string } | null
      revenueMetrics: {
        collectionRate: number
        outstanding: number
        overdue: number
        overdueStudents: number
        collected: number
      }
      receivableInvoiceCount: number
    },
  ) {
    const scope = params.scope
    const { start: monthStart, end: monthEnd, prevMonth } = this.monthRange(params.month)

    let periodStart = monthStart
    let periodEnd = monthEnd
    let compareStart = this.monthRange(prevMonth).start
    let compareEnd = this.monthRange(prevMonth).end

    if (scope === 'term' && params.term) {
      periodStart = new Date(params.term.startsOn)
      const termEndDate = new Date(params.term.endsOn)
      periodEnd = monthEnd < termEndDate ? monthEnd : termEndDate
      const prevEnd = this.monthRange(prevMonth).end
      compareStart = new Date(params.term.startsOn)
      compareEnd = prevEnd < periodEnd ? prevEnd : periodEnd
    }

    const [
      revenue,
      expenses,
      prevRevenue,
      prevExpenses,
      monthlyTrend,
      payable,
      salaryByDepartment,
      yearCollected,
      yearPayrollPaid,
    ] = await Promise.all([
      this.sumVerifiedPayments(tenantId, periodStart, periodEnd),
      this.sumPaidPayroll(tenantId, periodStart, periodEnd),
      this.sumVerifiedPayments(tenantId, compareStart, compareEnd),
      this.sumPaidPayroll(tenantId, compareStart, compareEnd),
      this.getMonthlyTrend(tenantId, params.month),
      this.getPayableSummary(tenantId),
      this.getSalaryByDepartment(tenantId, periodStart, periodEnd),
      params.revenueMetrics.collected,
      this.sumPaidPayroll(
        tenantId,
        new Date(new Date().getFullYear(), 0, 1),
        new Date(new Date().getFullYear(), 11, 31, 23, 59, 59),
      ),
    ])

    const netSurplus = revenue - expenses
    const marginPercent = revenue > 0 ? Math.round((netSurplus / revenue) * 100) : 0
    const expenseTotal = expenses > 0 ? expenses : 0

    const expenseBreakdown =
      expenseTotal > 0
        ? [
            {
              key: 'salaries',
              amount: expenseTotal,
              percent: 100,
            },
          ]
        : []

    const staffCount = salaryByDepartment.reduce((sum, row) => sum + row.staffCount, 0)
    const salaryTotal = salaryByDepartment.reduce((sum, row) => sum + row.amount, 0)

    const cashTotal = Math.max(0, yearCollected - yearPayrollPaid)

    return {
      scope,
      kpis: {
        revenue: {
          amount: revenue,
          trendPercent: this.calcTrendPercent(revenue, prevRevenue),
          subtitleKey: 'feesAndIncome',
        },
        expenses: {
          amount: expenses,
          trendPercent: this.calcTrendPercent(expenses, prevExpenses),
          subtitleKey: 'payrollAndOperating',
        },
        netSurplus: {
          amount: netSurplus,
          marginPercent,
          subtitleKey: 'revenueMinusExpenses',
        },
        collectionRate: {
          percent: params.revenueMetrics.collectionRate,
          outstandingAmount: params.revenueMetrics.outstanding,
          subtitleKey: 'collectedDividedBilled',
        },
      },
      monthlyTrend,
      expenseBreakdown,
      statusCards: {
        collectable: {
          amount: params.revenueMetrics.outstanding,
          invoiceCount: params.receivableInvoiceCount,
        },
        overdue: {
          amount: params.revenueMetrics.overdue,
          studentCount: params.revenueMetrics.overdueStudents,
        },
        payable: {
          amount: payable.amount,
          staffCount: payable.staffCount,
        },
      },
      cashPosition: {
        total: cashTotal,
        accounts: [
          {
            key: 'feeCollections',
            amount: params.revenueMetrics.collected,
          },
          {
            key: 'payrollPaid',
            amount: yearPayrollPaid,
          },
        ],
      },
      salaryByDepartment,
      salarySummary: {
        totalAmount: salaryTotal,
        staffCount,
      },
    }
  }

  async getMonthlyReport(tenantId: string, query: MonthlyReportQueryDto) {
    const selectedMonth = query.month ?? new Date().toISOString().slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) {
      throw new BadRequestException('Month must be in YYYY-MM format')
    }

    const parts = selectedMonth.split('-')
    const year = Number(parts[0])
    const month = Number(parts[1])
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    // Revenue: net verified cash (payments minus refunds) in this month
    const revenueResult = await this.db
      .select({ revenue: this.netVerifiedPaymentExpr })
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        sql`${payments.verifiedAt} >= ${startDate}`,
        sql`${payments.verifiedAt} <= ${endDate}`,
      ))

    // Payroll expenses: sum of paid payroll records in this calendar month
    const salaryResult = await this.db
      .select({ salaryExpenses: sum(payrollRecords.netAmount) })
      .from(payrollRecords)
      .where(and(
        eq(payrollRecords.tenantId, tenantId),
        eq(payrollRecords.status, "paid"),
        sql`${payrollRecords.paidAt} >= ${startDate}`,
        sql`${payrollRecords.paidAt} <= ${endDate}`,
      ))

    const rev = Number(revenueResult[0]?.revenue ?? 0)
    const sal = Number(salaryResult[0]?.salaryExpenses ?? 0)

    const sourceRows = await this.db
      .select({
        source: invoices.source,
        total: sum(invoices.total),
      })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        sql`to_char(${invoices.issueDate}::date, 'YYYY-MM') = ${selectedMonth}`,
      ))
      .groupBy(invoices.source)

    const revenueBySource = {
      enrollment: 0,
      recurring: 0,
      ad_hoc: 0,
    }

    for (const row of sourceRows) {
      const key = row.source as keyof typeof revenueBySource
      if (key in revenueBySource) {
        revenueBySource[key] = Number(row.total ?? 0)
      }
    }

    return {
      month: selectedMonth,
      revenue: rev,
      salaryExpenses: sal,
      net: rev - sal,
      revenueBySource,
    }
  }

  async getReceivables(tenantId: string, query: ReceivablesQueryDto) {
    const conditions = [
      eq(invoices.tenantId, tenantId),
      inArray(invoices.status, ['unpaid', 'partial', 'overdue'] as any[]),
    ]

    if (query.status) {
      conditions.push(eq(invoices.status, query.status as 'unpaid' | 'partial' | 'overdue'))
    }

    if (query.gradeId) {
      conditions.push(
        exists(
          this.db
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.tenantId, tenantId),
                eq(enrollments.studentId, invoices.studentId),
                eq(enrollments.gradeId, query.gradeId),
                eq(enrollments.status, 'approved'),
              ),
            ),
        ),
      )
    }

    const verifiedPaidSql = sql<string>`(
      SELECT COALESCE(SUM(
        CASE
          WHEN ${payments.kind} = 'payment' THEN ${payments.amount}::numeric
          WHEN ${payments.kind} = 'refund' THEN -${payments.amount}::numeric
          ELSE 0
        END
      ), 0)
      FROM ${payments}
      WHERE ${payments.invoiceId} = ${invoices.id}
        AND ${payments.tenantId} = ${tenantId}
        AND ${payments.verifiedAt} IS NOT NULL
    )`

    const gradeNameSql = sql<string | null>`(
      SELECT ${grades.name}
      FROM ${enrollments}
      LEFT JOIN ${grades} ON ${enrollments.gradeId} = ${grades.id}
      WHERE ${enrollments.tenantId} = ${tenantId}
        AND ${enrollments.studentId} = ${invoices.studentId}
        AND ${enrollments.status} = 'approved'
      ORDER BY ${enrollments.confirmedAt} DESC NULLS LAST
      LIMIT 1
    )`

    const rows = await this.db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        studentId: invoices.studentId,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        total: invoices.total,
        status: invoices.status,
        studentFullName: students.fullName,
        verifiedPaid: verifiedPaidSql,
        gradeName: gradeNameSql,
      })
      .from(invoices)
      .leftJoin(students, and(eq(invoices.studentId, students.id), eq(students.tenantId, tenantId)))
      .where(and(...conditions))
      .orderBy(desc(invoices.dueDate), desc(invoices.issueDate))

    const today = new Date()
    return rows.map((row) => {
      const total = Number(row.total)
      const paid = Number(row.verifiedPaid ?? 0)
      return {
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        studentId: row.studentId,
        studentFullName: row.studentFullName,
        gradeName: row.gradeName,
        issueDate: row.issueDate,
        dueDate: row.dueDate,
        total: row.total,
        balanceDue: Math.max(0, total - paid),
        status: row.status,
        daysOverdue: row.dueDate
          ? Math.max(0, Math.floor((today.getTime() - new Date(row.dueDate).getTime()) / 86400000))
          : null,
      }
    })
  }

  async getFinanceOverview(tenantId: string, query: FinanceOverviewQueryDto) {
    const year = await this.resolveOverviewAcademicYear(tenantId, query.academicYearId)
    const month = query.month ?? new Date().toISOString().slice(0, 7)
    const scope = query.scope ?? 'month'

    if (!year) {
      const monthly = await this.getMonthlyReport(tenantId, { month })
      const receivableRows = await this.getReceivables(tenantId, {})
      const aging = this.buildReceivablesAging(receivableRows)
      const topOverdue = this.buildTopOverdue(receivableRows)
      const insights = await this.buildFinanceOverviewInsights(tenantId, {
        scope,
        month,
        term: null,
        revenueMetrics: {
          collectionRate: 0,
          outstanding: 0,
          overdue: 0,
          overdueStudents: 0,
          collected: 0,
        },
        receivableInvoiceCount: receivableRows.filter((row) => row.balanceDue > 0).length,
      })

      return {
        academicYear: null,
        term: null,
        month,
        profile: {
          enrolledStudents: 0,
          gradesWithStudents: 0,
          averageBilledPerStudent: 0,
          activeFeeItems: 0,
          activeDiscountRules: 0,
          studentsWithDiscounts: 0,
          discountExposurePercent: 0,
          paymentPlanMix: { enrollment: 0, monthly: 0, one_off: 0 },
        },
        revenue: {
          billed: 0,
          collected: 0,
          outstanding: 0,
          overdue: 0,
          collectionRate: 0,
          owingStudents: 0,
          overdueStudents: 0,
          bySource: { enrollment: 0, recurring: 0, ad_hoc: 0 },
          byGrade: [],
        },
        monthly: {
          month: monthly.month,
          revenue: monthly.revenue,
          salaryExpenses: monthly.salaryExpenses,
          net: monthly.net,
          payrollPercentOfRevenue: monthly.revenue > 0
            ? Math.round((monthly.salaryExpenses / monthly.revenue) * 100)
            : 0,
        },
        receivables: { aging, topOverdue },
        ...insights,
      }
    }

    const academicYearId = year.id
    const { currentTerm } = await this.resolveBillingPeriod(tenantId, academicYearId)
    const [metrics, rosterShell, monthly, receivableRows, feeItemCount, discountRuleCount, bySource, studentsWithDiscounts] =
      await Promise.all([
        this.getInvoiceMetrics(tenantId, { academicYearId }),
        this.getBillingRoster(tenantId, { academicYearId, limit: 1, offset: 0 }),
        this.getMonthlyReport(tenantId, { month }),
        this.getReceivables(tenantId, {}),
        this.db
          .select({ count: count() })
          .from(feeItems)
          .where(and(eq(feeItems.tenantId, tenantId), eq(feeItems.status, 'active'))),
        this.db
          .select({ count: count() })
          .from(discountRules)
          .where(and(eq(discountRules.tenantId, tenantId), eq(discountRules.status, 'active'))),
        this.getRevenueBySourceForYear(tenantId, year.startsOn, year.endsOn),
        this.countStudentsWithDiscountsForYear(tenantId, year.startsOn, year.endsOn),
      ])

    const enrolledStudents = rosterShell.metrics.totalStudents
    const paymentPlanMix = { enrollment: 0, monthly: 0, one_off: 0 }
    const byGrade: Array<{
      gradeId: string
      gradeName: string
      billed: number
      collected: number
      outstanding: number
      students: number
    }> = []

    await Promise.all(
      rosterShell.grades.map(async (grade) => {
        const gradeRoster = await this.getBillingRoster(tenantId, {
          academicYearId,
          gradeId: grade.id,
          limit: 500,
          offset: 0,
        })
        byGrade.push({
          gradeId: grade.id,
          gradeName: grade.name,
          billed: gradeRoster.metrics.billed,
          collected: gradeRoster.metrics.collected,
          outstanding: gradeRoster.metrics.outstanding,
          students: gradeRoster.metrics.totalStudents,
        })
        for (const row of gradeRoster.rows) {
          const plan = row.primaryPaymentPlan ?? 'one_off'
          if (plan in paymentPlanMix) {
            paymentPlanMix[plan as keyof typeof paymentPlanMix] += 1
          }
        }
      }),
    )

    byGrade.sort((a, b) => a.gradeName.localeCompare(b.gradeName))

    const discountExposurePercent =
      enrolledStudents > 0 ? Math.round((studentsWithDiscounts / enrolledStudents) * 100) : 0

    const aging = this.buildReceivablesAging(receivableRows)
    const topOverdue = this.buildTopOverdue(receivableRows)

    const insights = await this.buildFinanceOverviewInsights(tenantId, {
      scope,
      month,
      term: currentTerm
        ? { startsOn: currentTerm.startsOn, endsOn: currentTerm.endsOn }
        : null,
      revenueMetrics: {
        collectionRate: metrics.collectionRate,
        outstanding: metrics.outstanding,
        overdue: metrics.overdue,
        overdueStudents: metrics.overdueStudents,
        collected: metrics.collected,
      },
      receivableInvoiceCount: receivableRows.filter((row) => row.balanceDue > 0).length,
    })

    return {
      academicYear: { id: year.id, name: year.name, status: year.status },
      term: rosterShell.term,
      month,
      profile: {
        enrolledStudents,
        gradesWithStudents: rosterShell.grades.length,
        averageBilledPerStudent:
          enrolledStudents > 0 ? Math.round(metrics.billed / enrolledStudents) : 0,
        activeFeeItems: Number(feeItemCount[0]?.count ?? 0),
        activeDiscountRules: Number(discountRuleCount[0]?.count ?? 0),
        studentsWithDiscounts,
        discountExposurePercent,
        paymentPlanMix,
      },
      revenue: {
        billed: metrics.billed,
        collected: metrics.collected,
        outstanding: metrics.outstanding,
        overdue: metrics.overdue,
        collectionRate: metrics.collectionRate,
        owingStudents: metrics.owingStudents,
        overdueStudents: metrics.overdueStudents,
        bySource,
        byGrade,
      },
      monthly: {
        month: monthly.month,
        revenue: monthly.revenue,
        salaryExpenses: monthly.salaryExpenses,
        net: monthly.net,
        payrollPercentOfRevenue:
          monthly.revenue > 0 ? Math.round((monthly.salaryExpenses / monthly.revenue) * 100) : 0,
      },
      receivables: { aging, topOverdue },
      ...insights,
    }
  }

  private async resolveOverviewAcademicYear(tenantId: string, academicYearId?: string) {
    if (academicYearId) {
      const [year] = await this.db
        .select({
          id: academicYears.id,
          name: academicYears.name,
          status: academicYears.status,
          startsOn: academicYears.startsOn,
          endsOn: academicYears.endsOn,
        })
        .from(academicYears)
        .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)))
      if (!year) throw new NotFoundException('Academic year not found')
      return year
    }

    const [activeYear] = await this.db
      .select({
        id: academicYears.id,
        name: academicYears.name,
        status: academicYears.status,
        startsOn: academicYears.startsOn,
        endsOn: academicYears.endsOn,
      })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, 'active')))
      .limit(1)
    if (activeYear) return activeYear

    const [recentYear] = await this.db
      .select({
        id: academicYears.id,
        name: academicYears.name,
        status: academicYears.status,
        startsOn: academicYears.startsOn,
        endsOn: academicYears.endsOn,
      })
      .from(academicYears)
      .where(eq(academicYears.tenantId, tenantId))
      .orderBy(desc(academicYears.startsOn))
      .limit(1)
    return recentYear ?? null
  }

  private async getRevenueBySourceForYear(tenantId: string, periodStart: string, periodEnd: string) {
    const sourceRows = await this.db
      .select({
        source: invoices.source,
        total: sum(invoices.total),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.issueDate, periodStart),
          lte(invoices.issueDate, periodEnd),
        ),
      )
      .groupBy(invoices.source)

    const bySource = { enrollment: 0, recurring: 0, ad_hoc: 0 }
    for (const row of sourceRows) {
      const key = row.source as keyof typeof bySource
      if (key in bySource) {
        bySource[key] = Number(row.total ?? 0)
      }
    }
    return bySource
  }

  private async countStudentsWithDiscountsForYear(
    tenantId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    const rows = await this.db
      .selectDistinct({ studentId: invoices.studentId })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          gte(invoices.issueDate, periodStart),
          lte(invoices.issueDate, periodEnd),
          sql`${invoices.discountTotal}::numeric > 0`,
        ),
      )
    return rows.length
  }

  private buildReceivablesAging(
    rows: Awaited<ReturnType<FinanceService['getReceivables']>>,
  ) {
    const aging = { current: 0, days1to30: 0, days31to60: 0, days90Plus: 0 }
    for (const row of rows) {
      const balance = row.balanceDue
      if (balance <= 0) continue
      const days = row.daysOverdue ?? 0
      if (days <= 0) aging.current += balance
      else if (days <= 30) aging.days1to30 += balance
      else if (days <= 60) aging.days31to60 += balance
      else aging.days90Plus += balance
    }
    return aging
  }

  private buildTopOverdue(rows: Awaited<ReturnType<FinanceService['getReceivables']>>) {
    return rows
      .filter((row) => (row.daysOverdue ?? 0) > 0 && row.balanceDue > 0)
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        studentFullName: row.studentFullName,
        gradeName: row.gradeName,
        balanceDue: row.balanceDue,
        daysOverdue: row.daysOverdue ?? 0,
      }))
  }

  async getFinanceDashboard(tenantId: string) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const revResult = await this.db
      .select({ revenue: this.netVerifiedPaymentExpr })
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        sql`${payments.verifiedAt} >= ${monthStart}`,
        sql`${payments.verifiedAt} <= ${monthEnd}`,
      ))

    const outResult = await this.db
      .select({ outstanding: sum(invoices.total) })
      .from(invoices)
      .where(and(
        eq(invoices.tenantId, tenantId),
        inArray(invoices.status, ['unpaid', 'partial', 'overdue'] as any[]),
      ))

    const overdueResult = await this.db
      .select({ overdueCount: count() })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, 'overdue')))

    const rev = Number(revResult[0]?.revenue ?? 0)
    const out = Number(outResult[0]?.outstanding ?? 0)
    const overdueCount = overdueResult[0]?.overdueCount ?? 0

    return {
      totalRevenue: rev,
      totalOutstandingAR: out,
      collectionRate: rev + out > 0 ? Math.round((rev / (rev + out)) * 100) : 0,
      overdueCount: Number(overdueCount),
    }
  }
}
