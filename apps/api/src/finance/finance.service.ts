import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, gte, lte, inArray, sql, sum, count } from 'drizzle-orm'
import { AuditService } from '../audit/audit.service.js'
import { DB, type Database } from '../db/db.module.js'
import {
  feeItems, enrollmentFeePlans, invoices, invoiceItems,
  payments, receipts, salaryRecords, students,
} from '../db/schema.js'
import type {
  CreateFeeItemDto, CreateEnrollmentFeePlanDto, CreateInvoiceDto,
  GenerateMonthlyInvoicesDto, CancelInvoiceDto, RecordPaymentDto,
  VerifyPaymentDto, ListInvoicesQueryDto, ListPaymentsQueryDto,
  MonthlyReportQueryDto, ReceivablesQueryDto,
} from './dto.js'

@Injectable()
export class FinanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  // ── Fee Items ──────────────────────────────────────────────────────────────

  async listFeeItems(tenantId: string) {
    return this.db.select().from(feeItems).where(eq(feeItems.tenantId, tenantId))
  }

  async createFeeItem(tenantId: string, actorUserId: string, dto: CreateFeeItemDto) {
    if (!dto.name?.trim() || !dto.feeType?.trim() || !dto.billingType?.trim()) {
      throw new BadRequestException('Name, fee type, and billing type are required')
    }

    const [item] = await this.db.insert(feeItems).values({
      tenantId, createdBy: actorUserId, updatedBy: actorUserId,
      name: dto.name.trim(), feeType: dto.feeType.trim(), billingType: dto.billingType.trim(),
    }).returning()
    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'fee_item.create', recordType: 'fee_item', recordId: item!.id, after: item })
    )
    return item
  }

  // ── Enrollment Fee Plans ───────────────────────────────────────────────────

  async listEnrollmentFeePlans(tenantId: string) {
    return this.db.select().from(enrollmentFeePlans).where(eq(enrollmentFeePlans.tenantId, tenantId))
  }

  async createEnrollmentFeePlan(tenantId: string, actorUserId: string, dto: CreateEnrollmentFeePlanDto) {
    const [plan] = await this.db.insert(enrollmentFeePlans).values({
      tenantId, createdBy: actorUserId, updatedBy: actorUserId,
      academicYearId: dto.academicYearId, gradeId: dto.gradeId,
      feeItemId: dto.feeItemId, amount: String(dto.amount),
    }).returning()
    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'enrollment_fee_plan.create', recordType: 'enrollment_fee_plan', recordId: plan!.id, after: plan })
    )
    return plan
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  async listInvoices(tenantId: string, query: ListInvoicesQueryDto) {
    const conditions = [eq(invoices.tenantId, tenantId)]
    if (query.status) conditions.push(eq(invoices.status, query.status as any))
    if (query.studentId) conditions.push(eq(invoices.studentId, query.studentId))

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
        createdAt: invoices.createdAt,
        studentFullName: students.fullName,
      })
      .from(invoices)
      .leftJoin(students, eq(invoices.studentId, students.id))
      .where(and(...conditions))
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
      this.auditService.createEvent({ tenantId, actorUserId, action: 'invoice.create', recordType: 'invoice', recordId: invoice!.id, after: invoice })
    )

    return invoice
  }

  async generateMonthlyInvoices(tenantId: string, actorUserId: string, dto: GenerateMonthlyInvoicesDto) {
    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'invoice.generate_monthly', recordType: 'invoice', recordId: tenantId, after: { billingMonth: dto.billingMonth } })
    )
    return { message: 'Monthly invoice generation queued', month: dto.billingMonth }
  }

  async cancelInvoice(tenantId: string, invoiceId: string, actorUserId: string, dto: CancelInvoiceDto) {
    const [invoice] = await this.db.select().from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    if (!invoice) throw new NotFoundException('Invoice not found')

    const [updated] = await this.db.update(invoices)
      .set({ status: 'cancelled', updatedBy: actorUserId })
      .where(eq(invoices.id, invoiceId))
      .returning()

    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'invoice.cancel', recordType: 'invoice', recordId: invoiceId, before: invoice, after: { ...invoice, status: 'cancelled', reason: dto.reason } })
    )
    return updated
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  async listPayments(tenantId: string, query: ListPaymentsQueryDto) {
    const conditions = [eq(payments.tenantId, tenantId)]
    if (query.method) conditions.push(eq(payments.method, query.method as any))
    if (query.verified === true) conditions.push(sql`${payments.verifiedAt} IS NOT NULL`)
    if (query.verified === false) conditions.push(sql`${payments.verifiedAt} IS NULL`)

    const limit = query.limit ?? 50
    const offset = query.offset ?? 0

    const rows = await this.db.select().from(payments)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)

    return { data: rows, limit, offset }
  }

  async recordPayment(tenantId: string, invoiceId: string, actorUserId: string, dto: RecordPaymentDto) {
    const [invoice] = await this.db.select().from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    if (!invoice) throw new NotFoundException('Invoice not found')

    const isCash = dto.method === 'cash'
    const [payment] = await this.db.insert(payments).values({
      tenantId, createdBy: actorUserId, updatedBy: actorUserId,
      invoiceId,
      amount: String(dto.amount),
      method: dto.method as any,
      referenceNumber: dto.referenceNumber,
      notes: dto.notes,
      verifiedAt: isCash ? new Date() : null,
      verifiedByUserId: isCash ? actorUserId : null,
    }).returning()

    // Recalculate invoice status
    const paidResult = await this.db
      .select({ paidTotal: sum(payments.amount) })
      .from(payments)
      .where(and(eq(payments.invoiceId, invoiceId), sql`${payments.verifiedAt} IS NOT NULL`))

    const paid = Number(paidResult[0]?.paidTotal ?? 0)
    const invoiceTotal = Number(invoice.total)
    const newStatus = paid >= invoiceTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid'

    await this.db.update(invoices)
      .set({ status: newStatus as any, updatedBy: actorUserId })
      .where(eq(invoices.id, invoiceId))

    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'payment.record', recordType: 'payment', recordId: payment!.id, after: payment })
    )
    return payment
  }

  async verifyPayment(tenantId: string, paymentId: string, actorUserId: string, dto: VerifyPaymentDto) {
    const [payment] = await this.db.select().from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)))
    if (!payment) throw new NotFoundException('Payment not found')

    const [updated] = await this.db.update(payments)
      .set({
        verifiedAt: new Date(),
        verifiedByUserId: actorUserId,
        referenceNumber: dto.referenceNumber ?? payment.referenceNumber,
        notes: dto.notes ?? payment.notes,
        overrideReason: dto.overrideReason,
        updatedBy: actorUserId,
      })
      .where(eq(payments.id, paymentId))
      .returning()

    // Recalculate invoice status after verification
    const paidResult2 = await this.db
      .select({ paidTotal: sum(payments.amount) })
      .from(payments)
      .where(and(eq(payments.invoiceId, payment.invoiceId), sql`${payments.verifiedAt} IS NOT NULL`))

    const paid = Number(paidResult2[0]?.paidTotal ?? 0)
    const [invoice] = await this.db.select({ total: invoices.total }).from(invoices).where(eq(invoices.id, payment.invoiceId))
    const invoiceTotal = Number(invoice?.total ?? 0)
    const newStatus = paid >= invoiceTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid'

    await this.db.update(invoices)
      .set({ status: newStatus as any, updatedBy: actorUserId })
      .where(eq(invoices.id, payment.invoiceId))

    await this.auditService.recordEvent(
      this.auditService.createEvent({ tenantId, actorUserId, action: 'payment.verify', recordType: 'payment', recordId: paymentId, before: payment, after: updated })
    )
    return updated
  }

  // ── Receipts ───────────────────────────────────────────────────────────────

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
        inArray(salaryRecords.status, ['approved', 'paid'] as any[]),
      ))

    const rev = Number(revenueResult[0]?.revenue ?? 0)
    const sal = Number(salaryResult[0]?.salaryExpenses ?? 0)

    return {
      month: selectedMonth,
      revenue: rev,
      salaryExpenses: sal,
      net: rev - sal,
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
