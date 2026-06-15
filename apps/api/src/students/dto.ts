import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min
} from "class-validator";
import { Type } from "class-transformer";

export class CreateStudentDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsIn(["M", "F", "other"])
  gender!: "M" | "F" | "other";

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @IsOptional()
  @IsUUID()
  photoFileId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(["M", "F", "other"])
  gender?: "M" | "F" | "other";

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @IsOptional()
  @IsUUID()
  photoFileId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;
}

export class CreateGuardianDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsIn(["father", "mother", "guardian", "other"])
  relationship!: "father" | "mother" | "guardian" | "other";

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class LinkGuardianDto {
  @IsUUID()
  guardianId!: string;

  @IsIn(["father", "mother", "guardian", "other"])
  relationship!: "father" | "mother" | "guardian" | "other";

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class EnrollStudentDto {
  @IsUUID()
  classroomId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsDateString()
  enrollmentDate?: string;
}

export class TransferStudentDto {
  @IsUUID()
  toClassroomId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

export class WithdrawStudentDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  withdrawDate?: string;
}

export class ListStudentsQueryDto {
  @IsOptional()
  @IsEnum(["draft", "enrolled", "transferred", "withdrawn", "graduated", "archived"])
  status?: "draft" | "enrolled" | "transferred" | "withdrawn" | "graduated" | "archived";

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
