import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, gte, lte, inArray, isNotNull, isNull, ne, sql, sum, count, desc, exists } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service.js'
import { DB, type Database } from '../db/db.module.js'
import {
  academicYears, discountRules, enrollmentFeePlans, enrollmentFeePlanGrades, enrollments, feeItems, grades, invoices, invoiceItems,
  payments, paymentPlanInstallments, paymentPlans, receipts, salaryRecords, studentDiscounts, studentServices, students,
} from '../db/schema.js'
import type {
  CreateFeeItemDto, CreateEnrollmentFeePlanDto, CreateInvoiceDto,
  CreatePaymentPlanDto, GenerateMonthlyInvoicesDto, RecordPaymentDto, RefundPaymentDto,
  UpdatePaymentPlanInstallmentsDto, UpdatePaymentPlanDto,
  VerifyPaymentDto, ListInvoicesQueryDto, ListPaymentsQueryDto,
  MonthlyReportQueryDto, ReceivablesQueryDto, UpdateFeeItemDto,
  UpdateEnrollmentFeePlanDto,
} from './dto.js'
import { InvoicesQueueService } from './invoices-queue.service.js'
import { RecurringBillingService } from './recurring-billing.service.js'

@Injectable()
export class FinanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly recurringBillingService: RecurringBillingService,
    private readonly invoicesQueueService: InvoicesQueueService,
  ) {}

  // ── Fee Items ──────────────────────────────────────────────────────────────

  async listFeeItems(tenantId: string) {
    return this.db.select().from(feeItems).where(eq(feeItems.tenantId, tenantId))
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

  async listInvoices(tenantId: string, query: ListInvoicesQueryDto) {
    const conditions = [eq(invoices.tenantId, tenantId)]
    if (query.status) conditions.push(eq(invoices.status, query.status as any))
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
    }

    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

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
      })
      .from(invoices)
      .leftJoin(students, eq(invoices.studentId, students.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.updatedAt))
      .limit(limit)
      .offset(offset)

    const countResult = await this.db
      .select({ total: count() })
      .from(invoices)
      .where(and(...conditions))
    const totalCount = countResult[0]?.total ?? 0

    return { data: rows, total: Number(totalCount), limit, offset }
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

    const invoicePayments = await this.db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))

    return { ...invoice, items, payments: invoicePayments }
  }

  async createInvoice(tenantId: string, actorUserId: string, dto: CreateInvoiceDto) {
    const invoiceNumber = `INV-${Date.now()}`
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

  private async getRefundedTotalForPayment(paymentId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(and(
        eq(payments.refundedPaymentId, paymentId),
        eq(payments.kind, 'refund'),
        isNotNull(payments.verifiedAt),
      ))
    return Number(row?.total ?? 0)
  }

  private async recalculateInvoiceStatus(tenantId: string, invoiceId: string, actorUserId: string) {
    const [invoice] = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    if (!invoice) return

    if (['waived', 'cancelled'].includes(invoice.status)) return

    const net = await this.getVerifiedNetPaid(invoiceId)
    const total = Number(invoice.total)

    let newStatus: 'unpaid' | 'partial' | 'paid' | 'refunded'
    if (net >= total) {
      newStatus = 'paid'
    } else if (net > 0) {
      newStatus = 'partial'
    } else {
      const [verifiedPayment] = await this.db
        .select({ id: payments.id })
        .from(payments)
        .where(and(
          eq(payments.invoiceId, invoiceId),
          eq(payments.kind, 'payment'),
          isNotNull(payments.verifiedAt),
        ))
        .limit(1)
      newStatus = verifiedPayment ? 'refunded' : 'unpaid'
    }

    await this.db.update(invoices)
      .set({ status: newStatus, updatedBy: actorUserId, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  async listPayments(tenantId: string, query: ListPaymentsQueryDto) {
    const conditions = [eq(payments.tenantId, tenantId)]
    if (query.method) conditions.push(eq(payments.method, query.method as any))
    if (query.verified === true) conditions.push(isNotNull(payments.verifiedAt))
    if (query.verified === false) conditions.push(sql`${payments.verifiedAt} IS NULL`)

    const limit = query.limit ?? 50
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
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(payments)
      .leftJoin(invoices, and(eq(payments.invoiceId, invoices.id), eq(invoices.tenantId, tenantId)))
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)

    const [countRow] = await this.db
      .select({ total: count() })
      .from(payments)
      .where(and(...conditions))

    const data = await Promise.all(rows.map(async (row) => {
      let refundableAmount: number | null = null
      if (row.kind === 'payment' && row.verifiedAt) {
        const refunded = await this.getRefundedTotalForPayment(row.id)
        refundableAmount = Math.max(0, Number(row.amount) - refunded)
      }
      return { ...row, refundableAmount }
    }))

    return { data, total: Number(countRow?.total ?? 0), limit, offset }
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
    const verifiedTotal = await this.getVerifiedNetPaid(invoiceId)
    const remaining = invoiceTotal - verifiedTotal

    if (remaining <= 0) {
      throw new BadRequestException('This invoice is already fully paid.')
    }
    if (dto.amount > remaining) {
      throw new BadRequestException(`Payment amount exceeds remaining balance (${remaining}).`)
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
    return payment
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

    let totalOutstanding = 0
    let totalPaid = 0

    for (const invoice of invoiceRows) {
      if (['paid', 'cancelled', 'waived', 'refunded'].includes(invoice.status)) {
        if (invoice.status === 'paid') {
          totalPaid += Number(invoice.total)
        }
        continue
      }
      const verifiedNet = await this.getVerifiedNetPaid(invoice.id)
      const remaining = Math.max(0, Number(invoice.total) - verifiedNet)
      totalOutstanding += remaining
      totalPaid += verifiedNet
    }

    const activeServices = await this.db
      .select({
        id: studentServices.id,
        feeItemId: studentServices.feeItemId,
        feeItemName: feeItems.name,
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
      invoices: invoiceRows,
      activeServices,
      discounts,
    }
  }

  async getReceipt(tenantId: string, receiptId: string) {
    const [receipt] = await this.db.select().from(receipts)
      .where(and(eq(receipts.id, receiptId), eq(receipts.tenantId, tenantId)))
    if (!receipt) throw new NotFoundException('Receipt not found')
    return receipt
  }

  // ── Reports ────────────────────────────────────────────────────────────────

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

    // Revenue: sum of verified payments in this month
    const revenueResult = await this.db
      .select({ revenue: sum(payments.amount) })
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        sql`${payments.verifiedAt} >= ${startDate}`,
        sql`${payments.verifiedAt} <= ${endDate}`,
      ))

    // Salary expenses for this month
    const salaryResult = await this.db
      .select({ salaryExpenses: sum(salaryRecords.netAmount) })
      .from(salaryRecords)
      .where(and(
        eq(salaryRecords.tenantId, tenantId),
        eq(salaryRecords.salaryMonth, selectedMonth),
        eq(salaryRecords.status, "approved"),
        isNotNull(salaryRecords.paidAt)
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
      })
      .from(invoices)
      .leftJoin(students, eq(invoices.studentId, students.id))
      .where(and(...conditions))

    const today = new Date()
    return rows.map(row => ({
      ...row,
      daysOverdue: row.dueDate
        ? Math.max(0, Math.floor((today.getTime() - new Date(row.dueDate).getTime()) / 86400000))
        : null,
    }))
  }

  async getFinanceDashboard(tenantId: string) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const revResult = await this.db
      .select({ revenue: sum(payments.amount) })
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
