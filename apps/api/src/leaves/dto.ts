import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
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

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsNumber()
  @Min(0)
  @Max(365)
  declare yearlyQuota: number;
}

export class UpdateLeaveTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @Max(365)
  @IsOptional()
  yearlyQuota?: number;
}

export class LeaveBalanceEntryDto {
  @IsUUID()
  declare leaveTypeId: string;

  @IsNumber()
  @Min(0)
  @Max(365)
  declare allocatedDays: number;
}

export class SetLeaveBalancesDto {
  @IsUUID()
  declare staffId: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  declare calendarYear: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveBalanceEntryDto)
  declare entries: LeaveBalanceEntryDto[];
}

export class CreateLeaveRecordDto {
  @IsUUID()
  declare staffId: string;

  @IsUUID()
  declare leaveTypeId: string;

  @IsDateString()
  declare startDate: string;

  @IsDateString()
  declare endDate: string;

  @IsNumber()
  @Min(0.5)
  @Max(365)
  declare days: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class ListLeaveQueryDto {
  @IsUUID()
  @IsOptional()
  staffId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  year?: number;
}
