import {
  IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID,
  IsBoolean, IsArray, ValidateNested, IsDateString, IsIn, Min, Max,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { paymentMethods } from '@sms/shared'

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value
}

function parseBoolean({ value }: { value: unknown }) {
  if (value === true || value === 'true' || value === '1') return true
  if (value === false || value === 'false' || value === '0') return false
  return value
}

export class CreateFeeItemDto {
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  declare name: string

  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  declare feeType: string

  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  declare billingType: string
}

export class UpdateFeeItemDto {
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  @IsOptional()
  name?: string

  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  @IsOptional()
  feeType?: string

  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  @IsOptional()
  billingType?: string
}

export class CreateEnrollmentFeePlanDto {
  @IsUUID() declare academicYearId: string
  @IsArray()
  @IsUUID('4', { each: true })
  declare gradeIds: string[]
  @IsUUID() declare feeItemId: string
  @IsNumber() @Type(() => Number) declare amount: number
}

export class UpdateEnrollmentFeePlanDto {
  @IsNumber() @Type(() => Number) @IsOptional() declare amount?: number
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  declare gradeIds?: string[]
}

export class InvoiceItemDto {
  @IsString() @IsNotEmpty() declare description: string
  @IsNumber() @Type(() => Number) declare unitAmount: number
  @IsNumber() @IsOptional() @Type(() => Number) quantity?: number
  @IsUUID() @IsOptional() feeItemId?: string
}

export class CreateInvoiceDto {
  @IsUUID() declare studentId: string
  @IsDateString() @IsOptional() dueDate?: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto) declare items: InvoiceItemDto[]
  @IsString()
  @Transform(trimString)
  @IsOptional()
  reason?: string
}

export class GenerateMonthlyInvoicesDto {
  @IsUUID() declare academicYearId: string
  @IsString() @IsNotEmpty() declare billingMonth: string
  @IsUUID() @IsOptional() gradeId?: string
}

export class RecordPaymentDto {
  @IsNumber() @Type(() => Number) declare amount: number
  @IsString() @IsNotEmpty() @IsIn([...paymentMethods]) declare method: string
  @IsString() @IsOptional() referenceNumber?: string
  @IsString() @IsOptional() notes?: string
  @IsDateString() @IsOptional() paidAt?: string
}

export class RefundPaymentDto {
  @IsNumber() @IsOptional() @Type(() => Number) amount?: number
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  declare reason: string
  @IsString() @IsOptional() transactionId?: string
  @IsDateString() @IsOptional() paidAt?: string
}

export class VerifyPaymentDto {
  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  declare reason: string
  @IsString() @IsOptional() referenceNumber?: string
  @IsString() @IsOptional() notes?: string
}

export class ListInvoicesQueryDto {
  @IsString() @IsOptional() status?: string
  @IsUUID() @IsOptional() studentId?: string
  @IsString() @IsOptional() @IsIn(['enrollment', 'recurring', 'ad_hoc']) source?: string
  @IsString() @IsOptional() month?: string
  @IsUUID() @IsOptional() academicYearId?: string
  @IsUUID() @IsOptional() gradeId?: string
  @IsString() @Transform(trimString) @IsOptional() search?: string
  @IsString() @IsOptional() @IsIn(['createdAt']) sortBy?: string
  @IsString() @IsOptional() @IsIn(['asc', 'desc']) sortDir?: string
  @IsNumber() @IsOptional() @Type(() => Number) @Min(1) @Max(200) limit?: number
  @IsNumber() @IsOptional() @Type(() => Number) @Min(0) offset?: number
}

export class InvoiceMetricsQueryDto {
  @IsUUID() @IsOptional() academicYearId?: string
}

export class ListPaymentsQueryDto {
  @IsString() @IsOptional() method?: string
  @IsBoolean() @IsOptional() @Transform(({ value }) => value === 'true') verified?: boolean
  @IsString() @IsOptional() dateFrom?: string
  @IsString() @IsOptional() dateTo?: string
  @IsUUID() @IsOptional() academicYearId?: string
  @IsString() @Transform(trimString) @IsOptional() search?: string
  @IsNumber() @IsOptional() @Type(() => Number) @Min(1) @Max(200) limit?: number
  @IsNumber() @IsOptional() @Type(() => Number) @Min(0) offset?: number
}

export class PaymentMetricsQueryDto {
  @IsUUID() @IsOptional() academicYearId?: string
}

export class MonthlyReportQueryDto {
  @IsString() @IsNotEmpty() declare month: string
}

export class BillingRosterQueryDto {
  @IsUUID() declare academicYearId: string
  @IsUUID() @IsOptional() gradeId?: string
  @IsString() @IsOptional() @IsIn(['paid', 'partial', 'due', 'overdue']) status?: string
  @IsString() @Transform(trimString) @IsOptional() search?: string
  @IsNumber() @IsOptional() @Type(() => Number) @Min(1) @Max(500) limit?: number
  @IsNumber() @IsOptional() @Type(() => Number) @Min(0) offset?: number
  @IsString() @IsOptional() @IsIn(['student', 'status', 'balance']) sortBy?: 'student' | 'status' | 'balance'
  @IsString() @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc'
  @IsBoolean() @IsOptional() @Transform(parseBoolean) owingOnly?: boolean
  @IsBoolean() @IsOptional() @Transform(parseBoolean) metricsOnly?: boolean
}

export class CollectPaymentDto {
  @IsUUID() declare studentId: string
  @IsUUID() @IsOptional() academicYearId?: string
  @IsNumber() @Type(() => Number) declare amount: number
  @IsString() @IsNotEmpty() @IsIn([...paymentMethods]) declare method: string
  @IsString() @Transform(trimString) @IsOptional() referenceNumber?: string
  @IsString() @Transform(trimString) @IsOptional() notes?: string
}

export class ReceivablesQueryDto {
  @IsString() @IsOptional() gradeId?: string
  @IsString() @IsOptional() status?: string
}

export class PaymentPlanInstallmentDto {
  @IsString() @Transform(trimString) @IsNotEmpty() declare label: string
  @IsString() @Transform(trimString) @IsNotEmpty() declare dueDate: string
  @IsNumber() @IsOptional() @Type(() => Number) installmentCount?: number
  @IsNumber() @IsOptional() @Type(() => Number) sortOrder?: number
}

export class CreatePaymentPlanDto {
  @IsString() @Transform(trimString) @IsNotEmpty() declare name: string
  @IsString() @Transform(trimString) @IsOptional() description?: string
  @IsString() @Transform(trimString) @IsNotEmpty() declare frequency: string
  @IsNumber() @IsOptional() @Type(() => Number) sortOrder?: number
  @IsIn(['active', 'inactive']) @IsOptional() status?: 'active' | 'inactive'
  @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentPlanInstallmentDto) @IsOptional()
  installments?: PaymentPlanInstallmentDto[]
}

export class UpdatePaymentPlanDto {
  @IsString() @Transform(trimString) @IsNotEmpty() @IsOptional() name?: string
  @IsString() @Transform(trimString) @IsOptional() description?: string
  @IsString() @Transform(trimString) @IsNotEmpty() @IsOptional() frequency?: string
  @IsNumber() @IsOptional() @Type(() => Number) sortOrder?: number
  @IsIn(['active', 'inactive']) @IsOptional() status?: 'active' | 'inactive'
}

export class UpdatePaymentPlanInstallmentsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentPlanInstallmentDto)
  declare installments: PaymentPlanInstallmentDto[]
}
