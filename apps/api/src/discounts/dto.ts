import { IsDateString, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID } from "class-validator";
import { Type } from "class-transformer";

export class CreateDiscountRuleDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsString()
  declare discountType: string;

  @IsString()
  declare valueType: string;

  @IsNumber()
  @Type(() => Number)
  declare value: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  approvalThreshold?: number;

  @IsObject()
  @IsOptional()
  criteria?: Record<string, unknown>;
}

export class UpdateDiscountRuleDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  discountType?: string;

  @IsString()
  @IsOptional()
  valueType?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  value?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  approvalThreshold?: number | null;

  @IsObject()
  @IsOptional()
  criteria?: Record<string, unknown>;
}

export class RequestStudentDiscountDto {
  @IsUUID()
  declare studentId: string;

  @IsUUID()
  declare discountRuleId: string;

  @IsString()
  @IsNotEmpty()
  declare reason: string;

  @IsDateString()
  declare effectiveFrom: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}

export class ApproveDiscountDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectDiscountDto {
  @IsString()
  @IsNotEmpty()
  declare reason: string;
}

export class ListStudentDiscountsQueryDto {
  @IsUUID()
  @IsOptional()
  studentId?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
