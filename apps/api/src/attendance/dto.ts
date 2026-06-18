import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray
} from "class-validator";
import { Type, Transform } from "class-transformer";

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export const ATTENDANCE_STATUS_VALUES = ["present", "absent", "late", "excused", "sick", "leave", "half_day"] as const;
export type AttendanceStatus = typeof ATTENDANCE_STATUS_VALUES[number];

export class OpenAttendanceSessionDto {
  @IsDateString()
  declare sessionDate: string;

  @IsOptional()
  @IsString()
  declare subjectId?: string;

  @IsOptional()
  @IsString()
  declare submittedByStaffId?: string;
}

export class AttendanceRecordItemDto {
  @IsString()
  declare studentId: string;

  @IsEnum(ATTENDANCE_STATUS_VALUES)
  declare status: AttendanceStatus;
}

export class BulkMarkRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordItemDto)
  declare records: AttendanceRecordItemDto[];
}

export class CorrectAttendanceRecordDto {
  @IsEnum(ATTENDANCE_STATUS_VALUES)
  declare status: AttendanceStatus;

  @IsString()
  @Transform(trimString)
  @IsNotEmpty()
  declare correctionReason: string;
}

export class AttendanceReportQueryDto {
  @IsOptional()
  @IsString()
  declare classroomId?: string;

  @IsOptional()
  @IsDateString()
  declare dateFrom?: string;

  @IsOptional()
  @IsDateString()
  declare dateTo?: string;
}
