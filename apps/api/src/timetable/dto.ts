import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { Type } from "class-transformer";

export class CreatePeriodDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsString()
  declare startTime: string;

  @IsString()
  declare endTime: string;

  @IsNumber()
  @Type(() => Number)
  declare sortOrder: number;

  @IsBoolean()
  @IsOptional()
  isBreak?: boolean;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}

export class CreateTimetableSlotDto {
  @IsUUID()
  declare classroomId: string;

  @IsUUID()
  declare subjectId: string;

  @IsUUID()
  declare staffId: string;

  @IsUUID()
  declare periodId: string;

  @IsNumber()
  @Type(() => Number)
  declare dayOfWeek: number;

  @IsString()
  @IsOptional()
  roomLabel?: string;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  @IsString()
  @IsOptional()
  effectiveFrom?: string;
}

export class ListTimetableSlotsQueryDto {
  @IsUUID()
  @IsOptional()
  classroomId?: string;

  @IsUUID()
  @IsOptional()
  staffId?: string;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}

export class PublishTimetableDto {
  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}
