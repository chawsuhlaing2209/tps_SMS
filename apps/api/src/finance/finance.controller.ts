import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, Headers, UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PermissionsGuard } from '../identity/permissions.guard.js'
import { RequirePermissions } from '../identity/permissions.decorator.js'
import { FinanceService } from './finance.service.js'
import {
  BillingRosterQueryDto,
  CollectPaymentDto,
  CreateEnrollmentFeePlanDto,
  CreateFeeItemDto,
  CreateInvoiceDto,
  CreatePaymentPlanDto,
  GenerateMonthlyInvoicesDto,
  InvoiceMetricsQueryDto,
  ListInvoicesQueryDto,
  ListPaymentsQueryDto,
  FinanceOverviewQueryDto,
  MonthlyReportQueryDto,
  PaymentMetricsQueryDto,
  ReceivablesQueryDto,
  RecordPaymentDto,
  ReconcileFeeItemGradeAmountsDto,
  RefundPaymentDto,
  UpdateEnrollmentFeePlanDto,
  UpdateFeeItemDto,
  UpdatePaymentPlanDto,
  UpdatePaymentPlanInstallmentsDto,
  VerifyPaymentDto,
} from './dto.js'

@ApiTags('finance')
@Controller('tenants/:tenantId/finance')
@UseGuards(PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ── Fee Items ──────────────────────────────────────────────────────────────

  @Get('fee-items')
  @RequirePermissions('finance.manage')
  listFeeItems(@Param('tenantId') tenantId: string) {
    return this.financeService.listFeeItems(tenantId)
  }

  @Post('fee-items')
  @RequirePermissions('finance.manage')
  createFeeItem(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateFeeItemDto,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.createFeeItem(tenantId, actorUserId, dto)
  }

  @Patch('fee-items/:feeItemId')
  @RequirePermissions('finance.manage')
  updateFeeItem(
    @Param('tenantId') tenantId: string,
    @Param('feeItemId') feeItemId: string,
    @Body() dto: UpdateFeeItemDto,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.updateFeeItem(tenantId, feeItemId, actorUserId, dto)
  }

  @Put('fee-items/:feeItemId/grade-amounts')
  @RequirePermissions('finance.manage')
  reconcileFeeItemGradeAmounts(
    @Param('tenantId') tenantId: string,
    @Param('feeItemId') feeItemId: string,
    @Body() dto: ReconcileFeeItemGradeAmountsDto,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.reconcileFeeItemGradeAmounts(tenantId, feeItemId, actorUserId, dto)
  }

  @Delete('fee-items/:feeItemId')
  @RequirePermissions('finance.manage')
  deleteFeeItem(
    @Param('tenantId') tenantId: string,
    @Param('feeItemId') feeItemId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.deleteFeeItem(tenantId, feeItemId, actorUserId)
  }

  @Post('fee-items/:feeItemId/archive')
  @RequirePermissions('finance.manage')
  archiveFeeItem(
    @Param('tenantId') tenantId: string,
    @Param('feeItemId') feeItemId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.archiveFeeItem(tenantId, feeItemId, actorUserId)
  }

  @Post('fee-items/:feeItemId/restore')
  @RequirePermissions('finance.manage')
  restoreFeeItem(
    @Param('tenantId') tenantId: string,
    @Param('feeItemId') feeItemId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.restoreFeeItem(tenantId, feeItemId, actorUserId)
  }

  /** @deprecated Use POST fee-items/:feeItemId/restore. */
  @Post('fee-items/:feeItemId/reactivate')
  @RequirePermissions('finance.manage')
  reactivateFeeItem(
    @Param('tenantId') tenantId: string,
    @Param('feeItemId') feeItemId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.restoreFeeItem(tenantId, feeItemId, actorUserId)
  }

  // ── Enrollment Fee Plans ───────────────────────────────────────────────────

  @Get('enrollment-fee-plans')
  @RequirePermissions('finance.manage')
  listEnrollmentFeePlans(@Param('tenantId') tenantId: string) {
    return this.financeService.listEnrollmentFeePlans(tenantId)
  }

  @Post('enrollment-fee-plans')
  @RequirePermissions('finance.manage')
  createEnrollmentFeePlan(
    @Param('tenantId') tenantId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: CreateEnrollmentFeePlanDto,
  ) {
    return this.financeService.createEnrollmentFeePlan(tenantId, actorUserId, dto)
  }

  @Patch('enrollment-fee-plans/:planId')
  @RequirePermissions('finance.manage')
  updateEnrollmentFeePlan(
    @Param('tenantId') tenantId: string,
    @Param('planId') planId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: UpdateEnrollmentFeePlanDto,
  ) {
    return this.financeService.updateEnrollmentFeePlan(tenantId, planId, actorUserId, dto)
  }

  @Delete('enrollment-fee-plans/:planId')
  @RequirePermissions('finance.manage')
  deleteEnrollmentFeePlan(
    @Param('tenantId') tenantId: string,
    @Param('planId') planId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.deleteEnrollmentFeePlan(tenantId, planId, actorUserId)
  }

  @Get('fee-structures/summary')
  @RequirePermissions('finance.manage')
  getFeeStructureSummary(
    @Param('tenantId') tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.financeService.getFeeStructureSummary(tenantId, academicYearId)
  }

  // ── Payment Plans ──────────────────────────────────────────────────────────

  @Get('payment-plans')
  @RequirePermissions('finance.manage')
  listPaymentPlans(@Param('tenantId') tenantId: string) {
    return this.financeService.listPaymentPlans(tenantId)
  }

  @Post('payment-plans')
  @RequirePermissions('finance.manage')
  createPaymentPlan(
    @Param('tenantId') tenantId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: CreatePaymentPlanDto,
  ) {
    return this.financeService.createPaymentPlan(tenantId, actorUserId, dto)
  }

  @Patch('payment-plans/:planId')
  @RequirePermissions('finance.manage')
  updatePaymentPlan(
    @Param('tenantId') tenantId: string,
    @Param('planId') planId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: UpdatePaymentPlanDto,
  ) {
    return this.financeService.updatePaymentPlan(tenantId, planId, actorUserId, dto)
  }

  @Post('payment-plans/:planId/toggle-status')
  @RequirePermissions('finance.manage')
  togglePaymentPlanStatus(
    @Param('tenantId') tenantId: string,
    @Param('planId') planId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.togglePaymentPlanStatus(tenantId, planId, actorUserId)
  }

  @Put('payment-plans/:planId/installments')
  @RequirePermissions('finance.manage')
  updatePaymentPlanInstallments(
    @Param('tenantId') tenantId: string,
    @Param('planId') planId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: UpdatePaymentPlanInstallmentsDto,
  ) {
    return this.financeService.updatePaymentPlanInstallments(tenantId, planId, actorUserId, dto)
  }

  @Delete('payment-plans/:planId')
  @RequirePermissions('finance.manage')
  deletePaymentPlan(
    @Param('tenantId') tenantId: string,
    @Param('planId') planId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.deletePaymentPlan(tenantId, planId, actorUserId)
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  @Get('students/:studentId/summary')
  @RequirePermissions('finance.manage')
  getStudentBillingSummary(
    @Param('tenantId') tenantId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.financeService.getStudentBillingSummary(tenantId, studentId)
  }

  @Get('family-groups/:familyGroupId/billing')
  @RequirePermissions('finance.manage')
  getFamilyGroupBilling(
    @Param('tenantId') tenantId: string,
    @Param('familyGroupId') familyGroupId: string,
  ) {
    return this.financeService.getFamilyGroupBilling(tenantId, familyGroupId)
  }

  @Post('students/:studentId/bill-recurring')
  @RequirePermissions('finance.manage')
  billRecurring(
    @Param('tenantId') tenantId: string,
    @Param('studentId') studentId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.ensureRecurringInvoice(tenantId, studentId, actorUserId)
  }

  @Get('invoices/metrics')
  @RequirePermissions('finance.manage')
  getInvoiceMetrics(
    @Param('tenantId') tenantId: string,
    @Query() query: InvoiceMetricsQueryDto,
  ) {
    return this.financeService.getInvoiceMetrics(tenantId, query)
  }

  @Get('invoices')
  @RequirePermissions('finance.manage')
  listInvoices(
    @Param('tenantId') tenantId: string,
    @Query() query: ListInvoicesQueryDto,
  ) {
    return this.financeService.listInvoices(tenantId, query)
  }

  @Post('invoices')
  @RequirePermissions('finance.manage')
  createInvoice(
    @Param('tenantId') tenantId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.financeService.createInvoice(tenantId, actorUserId, dto)
  }

  @Get('invoices/:invoiceId')
  @RequirePermissions('finance.manage')
  getInvoice(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.financeService.getInvoice(tenantId, invoiceId)
  }

  @Get('invoices/:invoiceId/activity')
  @RequirePermissions('finance.manage')
  getInvoiceActivity(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.financeService.getInvoiceActivity(tenantId, invoiceId)
  }

  @Post('invoices/:invoiceId/send-guardian')
  @RequirePermissions('finance.manage')
  sendInvoiceToGuardian(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
    @Headers('x-user-id') actorUserId: string,
  ) {
    return this.financeService.sendInvoiceToGuardian(tenantId, invoiceId, actorUserId)
  }

  @Post('invoices/generate-monthly')
  @RequirePermissions('finance.manage')
  generateMonthlyInvoices(
    @Param('tenantId') tenantId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: GenerateMonthlyInvoicesDto,
  ) {
    return this.financeService.generateMonthlyInvoices(tenantId, actorUserId, dto)
  }

  // ── Billing roster & cashiering ──────────────────────────────────────────────

  @Get('billing/roster')
  @RequirePermissions('finance.manage')
  getBillingRoster(
    @Param('tenantId') tenantId: string,
    @Query() query: BillingRosterQueryDto,
  ) {
    return this.financeService.getBillingRoster(tenantId, query)
  }

  @Post('billing/collect')
  @RequirePermissions('finance.manage')
  collectPayment(
    @Param('tenantId') tenantId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: CollectPaymentDto,
  ) {
    return this.financeService.collectPayment(tenantId, actorUserId, dto)
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  @Get('payments/metrics')
  @RequirePermissions('finance.manage')
  getPaymentMetrics(
    @Param('tenantId') tenantId: string,
    @Query() query: PaymentMetricsQueryDto,
  ) {
    return this.financeService.getPaymentMetrics(tenantId, query)
  }

  @Get('payments')
  @RequirePermissions('finance.manage')
  listPayments(
    @Param('tenantId') tenantId: string,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.financeService.listPayments(tenantId, query)
  }

  @Post('invoices/:invoiceId/payments')
  @RequirePermissions('finance.manage')
  recordPayment(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.financeService.recordPayment(tenantId, invoiceId, actorUserId, dto)
  }

  @Patch('payments/:paymentId/verify')
  @RequirePermissions('finance.manage')
  verifyPayment(
    @Param('tenantId') tenantId: string,
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.financeService.verifyPayment(tenantId, paymentId, actorUserId, dto)
  }

  @Post('payments/:paymentId/refund')
  @RequirePermissions('finance.manage')
  refundPayment(
    @Param('tenantId') tenantId: string,
    @Param('paymentId') paymentId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.financeService.refundPayment(tenantId, paymentId, actorUserId, dto)
  }

  // ── Receipts ───────────────────────────────────────────────────────────────

  @Get('receipts/:receiptId')
  @RequirePermissions('finance.manage')
  getReceipt(
    @Param('tenantId') tenantId: string,
    @Param('receiptId') receiptId: string,
  ) {
    return this.financeService.getReceipt(tenantId, receiptId)
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  @Get('reports/overview')
  @RequirePermissions('finance.manage')
  getFinanceOverview(
    @Param('tenantId') tenantId: string,
    @Query() query: FinanceOverviewQueryDto,
  ) {
    return this.financeService.getFinanceOverview(tenantId, query)
  }

  @Get('reports/monthly')
  @RequirePermissions('finance.manage')
  getMonthlyReport(
    @Param('tenantId') tenantId: string,
    @Query() query: MonthlyReportQueryDto,
  ) {
    return this.financeService.getMonthlyReport(tenantId, query)
  }

  @Get('reports/receivables')
  @RequirePermissions('finance.manage')
  getReceivables(
    @Param('tenantId') tenantId: string,
    @Query() query: ReceivablesQueryDto,
  ) {
    return this.financeService.getReceivables(tenantId, query)
  }

  @Get('reports/dashboard')
  @RequirePermissions('finance.manage')
  getFinanceDashboard(@Param('tenantId') tenantId: string) {
    return this.financeService.getFinanceDashboard(tenantId)
  }
}
