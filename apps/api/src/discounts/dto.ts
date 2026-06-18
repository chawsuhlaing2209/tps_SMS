import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { discountBillingContexts, discountRuleTypes, discountTriggerModes } from "@sms/shared";

class DiscountAppliesToDto {
  @IsArray()
  @IsIn(discountBillingContexts, { each: true })
  declare billingContexts: string[];

  @IsArray()
  @IsString({ each: true })
  declare feeTypes: string[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  feeItemIds?: string[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  gradeIds?: string[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  academicYearIds?: string[];
}

class DiscountCriteriaDto {
  @IsString()
  declare type: string;

  @ValidateNested()
  @Type(() => DiscountAppliesToDto)
  declare appliesTo: DiscountAppliesToDto;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minEnrolledSiblings?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  siblingOrdinal?: number;

  @IsBoolean()
  @IsOptional()
  requiresDocumentation?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresPaymentAtEnrollment?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  paymentMethods?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  paymentPlanFrequencies?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateDiscountRuleDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsIn([...discountRuleTypes, "staff"])
  declare discountType: string;

  @IsIn(["percentage", "fixed"])
  declare valueType: string;

  @IsNumber()
  @Type(() => Number)
  declare value: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  approvalThreshold?: number | null;

  @IsIn(discountTriggerModes)
  @IsOptional()
  triggerMode?: string;

  @IsBoolean()
  @IsOptional()
  stackable?: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @ValidateNested()
  @Type(() => DiscountCriteriaDto)
  declare criteria: DiscountCriteriaDto;
}

export class UpdateDiscountRuleDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsIn([...discountRuleTypes, "staff"])
  @IsOptional()
  discountType?: string;

  @IsIn(["percentage", "fixed"])
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

  @IsIn(discountTriggerModes)
  @IsOptional()
  triggerMode?: string;

  @IsBoolean()
  @IsOptional()
  stackable?: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @ValidateNested()
  @Type(() => DiscountCriteriaDto)
  @IsOptional()
  criteria?: DiscountCriteriaDto;
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
