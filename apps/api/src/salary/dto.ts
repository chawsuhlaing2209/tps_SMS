import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID
} from "class-validator";

export class CreateSalaryComponentDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsString()
  declare componentType: string;

  @IsNumber()
  @IsOptional()
  defaultAmount?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSalaryComponentDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  componentType?: string;
}

export class ListSalaryRecordsQueryDto {
  @IsString()
  @IsOptional()
  month?: string;

  @IsUUID()
  @IsOptional()
  staffId?: string;

  @IsString()
  @IsOptional()
  approvalStatus?: string;
}

export class AdjustSalaryRecordDto {
  @IsNumber()
  @IsOptional()
  adjustmentAmount?: number;

  @IsString()
  @IsNotEmpty()
  declare reason: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class GenerateSalaryRecordsDto {
  @IsString()
  @IsNotEmpty()
  declare month: string;
}

export class ApproveSalaryRecordDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class MarkSalaryPaidDto {
  @IsString()
  declare paymentMethod: string;

  @IsDateString()
  @IsOptional()
  paidAt?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;
}
