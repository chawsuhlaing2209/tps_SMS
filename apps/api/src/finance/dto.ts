import {
  IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID,
  IsBoolean, IsArray, ValidateNested, IsDateString,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'

export class CreateFeeItemDto {
  @IsString() @IsNotEmpty() declare name: string
  @IsString() @IsNotEmpty() declare feeType: string
  @IsString() @IsNotEmpty() declare billingType: string
}

export class CreateEnrollmentFeePlanDto {
  @IsUUID() declare academicYearId: string
  @IsUUID() declare gradeId: string
  @IsUUID() declare feeItemId: string
  @IsNumber() @Type(() => Number) declare amount: number
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
}

export class GenerateMonthlyInvoicesDto {
  @IsUUID() declare academicYearId: string
  @IsString() @IsNotEmpty() declare billingMonth: string
}

export class CancelInvoiceDto {
  @IsString() @IsNotEmpty() declare reason: string
}

export class RecordPaymentDto {
  @IsNumber() @Type(() => Number) declare amount: number
  @IsString() @IsNotEmpty() declare method: string
  @IsString() @IsOptional() referenceNumber?: string
  @IsString() @IsOptional() notes?: string
  @IsDateString() @IsOptional() paidAt?: string
}

export class VerifyPaymentDto {
  @IsString() @IsOptional() referenceNumber?: string
  @IsString() @IsOptional() notes?: string
  @IsString() @IsOptional() overrideReason?: string
}

export class ListInvoicesQueryDto {
  @IsString() @IsOptional() status?: string
  @IsUUID() @IsOptional() studentId?: string
  @IsString() @IsOptional() month?: string
  @IsUUID() @IsOptional() gradeId?: string
  @IsNumber() @IsOptional() @Type(() => Number) limit?: number
  @IsNumber() @IsOptional() @Type(() => Number) offset?: number
}

export class ListPaymentsQueryDto {
  @IsString() @IsOptional() method?: string
  @IsBoolean() @IsOptional() @Transform(({ value }) => value === 'true') verified?: boolean
  @IsString() @IsOptional() dateFrom?: string
  @IsString() @IsOptional() dateTo?: string
  @IsNumber() @IsOptional() @Type(() => Number) limit?: number
  @IsNumber() @IsOptional() @Type(() => Number) offset?: number
}

export class MonthlyReportQueryDto {
  @IsString() @IsNotEmpty() declare month: string
}

export class ReceivablesQueryDto {
  @IsString() @IsOptional() gradeId?: string
  @IsString() @IsOptional() status?: string
}
