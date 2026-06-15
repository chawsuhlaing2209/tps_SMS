import {
  Controller, Get, Post, Patch, Body, Param, Query, Headers, UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PermissionsGuard } from '../identity/permissions.guard.js'
import { RequirePermissions } from '../identity/permissions.decorator.js'
import { FinanceService } from './finance.service.js'
import type {
  CreateFeeItemDto, CreateEnrollmentFeePlanDto, CreateInvoiceDto,
  GenerateMonthlyInvoicesDto, CancelInvoiceDto, RecordPaymentDto,
  VerifyPaymentDto, ListInvoicesQueryDto, ListPaymentsQueryDto,
  MonthlyReportQueryDto, ReceivablesQueryDto,
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
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: CreateFeeItemDto,
  ) {
    return this.financeService.createFeeItem(tenantId, actorUserId, dto)
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

  // ── Invoices ───────────────────────────────────────────────────────────────

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

  @Post('invoices/generate-monthly')
  @RequirePermissions('finance.manage')
  generateMonthlyInvoices(
    @Param('tenantId') tenantId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: GenerateMonthlyInvoicesDto,
  ) {
    return this.financeService.generateMonthlyInvoices(tenantId, actorUserId, dto)
  }

  @Post('invoices/:invoiceId/cancel')
  @RequirePermissions('finance.manage')
  cancelInvoice(
    @Param('tenantId') tenantId: string,
    @Param('invoiceId') invoiceId: string,
    @Headers('x-user-id') actorUserId: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    return this.financeService.cancelInvoice(tenantId, invoiceId, actorUserId, dto)
  }

  // ── Payments ───────────────────────────────────────────────────────────────

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
