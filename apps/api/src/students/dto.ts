import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class RegisterStudentGuardianDto {
  @IsOptional()
  @IsUUID()
  guardianId?: string;

  @ValidateIf((dto: RegisterStudentGuardianDto) => !dto.guardianId)
  @IsString()
  firstName?: string;

  @ValidateIf((dto: RegisterStudentGuardianDto) => !dto.guardianId)
  @IsString()
  lastName?: string;

  @ValidateIf((dto: RegisterStudentGuardianDto) => !dto.guardianId)
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsIn(["father", "mother", "guardian", "other"])
  relationship!: "father" | "mother" | "guardian" | "other";
}

export class RegisterStudentHouseholdDto {
  @IsIn(["none", "existing", "new", "guardian_default"])
  mode!: "none" | "existing" | "new" | "guardian_default";

  @ValidateIf((dto: RegisterStudentHouseholdDto) => dto.mode === "existing")
  @IsUUID()
  familyGroupId?: string;

  @ValidateIf((dto: RegisterStudentHouseholdDto) => dto.mode === "new")
  @IsString()
  name?: string;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterStudentGuardianDto)
  guardian?: RegisterStudentGuardianDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterStudentHouseholdDto)
  household?: RegisterStudentHouseholdDto;
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

  @IsOptional()
  @IsEnum(["draft", "enrolled", "transferred", "withdrawn", "graduated", "archived"])
  status?:
    | "draft"
    | "enrolled"
    | "transferred"
    | "withdrawn"
    | "graduated"
    | "archived";
}

export class UpdateGuardianDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
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

  /** Archive lifecycle filter. Defaults to "active" (non-archived) when omitted. */
  @IsOptional()
  @IsIn(["active", "archived", "all"])
  view?: "active" | "archived" | "all";

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

export class SearchFamilyGroupsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class CreateFamilyGroupDto {
  @IsString()
  name!: string;

  @IsUUID()
  primaryGuardianId!: string;
}

export class UpdateFamilyGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  primaryGuardianId?: string;
}

export class ListGuardiansQueryDto {
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

export class SetStudentFamilyGroupDto {
  @ValidateIf((dto: SetStudentFamilyGroupDto) => dto.familyGroupId !== null)
  @IsUUID()
  familyGroupId!: string | null;
}

export class CreateStudentFamilyGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  primaryGuardianId?: string;
}
