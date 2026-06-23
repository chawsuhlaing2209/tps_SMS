import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class CreatePayComponentDto {
  @IsString()
  @IsNotEmpty()
  declare code: string;

  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsIn(["earning", "deduction"])
  declare kind: "earning" | "deduction";

  @IsIn(["fixed", "percent_of_basic"])
  @IsOptional()
  calculation?: "fixed" | "percent_of_basic";

  @IsNumber()
  @IsOptional()
  defaultAmount?: number;
}

export class UpdatePayComponentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsIn(["fixed", "percent_of_basic"])
  @IsOptional()
  calculation?: "fixed" | "percent_of_basic";

  @IsNumber()
  @IsOptional()
  defaultAmount?: number;
}

export class CreateBenefitPackageDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  iconKey?: string;

  @IsNumber()
  @IsOptional()
  monthlyValue?: number;

  @IsIn(["all_staff", "teachers", "non_teaching"])
  @IsOptional()
  eligibilityScope?: "all_staff" | "teachers" | "non_teaching";
}

export class UpdateBenefitPackageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  iconKey?: string;

  @IsNumber()
  @IsOptional()
  monthlyValue?: number;

  @IsIn(["all_staff", "teachers", "non_teaching"])
  @IsOptional()
  eligibilityScope?: "all_staff" | "teachers" | "non_teaching";
}

export class EnrollStaffBenefitDto {
  @IsUUID()
  declare staffId: string;

  @IsDateString()
  declare effectiveFrom: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}

export class CreateIncentiveProgramDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(["per_payroll", "term", "annual", "one_time"])
  declare cadence: "per_payroll" | "term" | "annual" | "one_time";

  @IsIn(["fixed", "percent_of_basic", "manual"])
  declare awardType: "fixed" | "percent_of_basic" | "manual";

  @IsNumber()
  @IsOptional()
  awardAmount?: number;

  @IsNumber()
  @IsOptional()
  capAmount?: number;

  @IsUUID()
  @IsOptional()
  termId?: string;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}

export class UpdateIncentiveProgramDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  awardAmount?: number;

  @IsNumber()
  @IsOptional()
  capAmount?: number;
}

export class SetIncentiveEligibilityDto {
  @IsUUID()
  declare staffId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CompensationComponentDto {
  @IsUUID()
  declare componentId: string;

  @IsNumber()
  @IsOptional()
  amountOverride?: number | null;
}

export class UpsertStaffCompensationDto {
  @IsNumber()
  @IsOptional()
  baseSalary?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompensationComponentDto)
  @IsOptional()
  components?: CompensationComponentDto[];

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  payComponentIds?: string[];

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  benefitPackageIds?: string[];

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  incentiveProgramIds?: string[];
}

export class CreatePayrollRunDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  periodYear?: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  periodMonth?: number;

  @IsString()
  @IsOptional()
  month?: string;
}

export class ListPayrollRunsQueryDto {
  @IsString()
  @IsOptional()
  month?: string;
}

export class ListPayrollRecordsQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdatePayrollRunDto {
  @IsIn(["draft", "processing", "approved", "closed"])
  @IsOptional()
  status?: "draft" | "processing" | "approved" | "closed";
}

export class PayrollLineAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  declare label: string;

  @IsNumber()
  declare amount: number;

  @IsIn(["adjustment", "deduction"])
  @IsOptional()
  sourceType?: "adjustment" | "deduction";
}

export class PayrollLineItemPatchDto {
  @IsUUID()
  declare id: string;

  @IsNumber()
  declare amount: number;
}

export class IncentiveOverridePatchDto {
  @IsUUID()
  declare programId: string;

  @IsNumber()
  declare amount: number;
}

export class PackageSelectionDto {
  @IsUUID()
  declare packageId: string;

  @IsBoolean()
  declare enabled: boolean;
}

export class IncentiveSelectionDto {
  @IsUUID()
  declare programId: string;

  @IsBoolean()
  declare enabled: boolean;

  @IsNumber()
  @IsOptional()
  amount?: number;
}

export class ComponentSelectionDto {
  @IsUUID()
  declare componentId: string;

  @IsBoolean()
  declare enabled: boolean;

  @IsNumber()
  @IsOptional()
  amount?: number;
}

export class PatchPayrollRecordDto {
  @IsNumber()
  @IsOptional()
  baseSalary?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageSelectionDto)
  @IsOptional()
  packageSelections?: PackageSelectionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncentiveSelectionDto)
  @IsOptional()
  incentiveSelections?: IncentiveSelectionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentSelectionDto)
  @IsOptional()
  componentSelections?: ComponentSelectionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollLineItemPatchDto)
  @IsOptional()
  lineItems?: PayrollLineItemPatchDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncentiveOverridePatchDto)
  @IsOptional()
  incentiveOverrides?: IncentiveOverridePatchDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollLineAdjustmentDto)
  @IsOptional()
  adjustments?: PayrollLineAdjustmentDto[];
}

export class ApprovePayrollRecordDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class MarkPayrollPaidDto {
  @IsString()
  declare paymentMethod: string;

  @IsDateString()
  @IsOptional()
  paidAt?: string;

  @IsString()
  @IsOptional()
  paymentRef?: string;
}
