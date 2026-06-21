import { IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { personTypes } from "@sms/shared";

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  declare fullName: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  employmentRole?: string;

  @IsString()
  @IsOptional()
  employmentStatus?: string;

  @IsDateString()
  @IsOptional()
  joinDate?: string;

  @IsString()
  @IsOptional()
  salaryBasis?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class UpdateStaffDto implements Partial<CreateStaffDto> {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  employmentRole?: string;

  @IsString()
  @IsOptional()
  employmentStatus?: string;

  @IsDateString()
  @IsOptional()
  joinDate?: string;

  @IsString()
  @IsOptional()
  salaryBasis?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class LinkStaffUserDto {
  @IsUUID()
  declare userId: string;
}

export class StaffQualificationDto {
  @IsString()
  @IsNotEmpty()
  declare title: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsString()
  @IsOptional()
  year?: string;
}

export class ListStaffQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  employmentRole?: string;

  @IsString()
  @IsOptional()
  excludeEmploymentRole?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID()
  @IsOptional()
  eligibleGradeId?: string;

  @IsUUID()
  @IsOptional()
  includeStaffId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}

export class GradeChiefAssignmentItemDto {
  @IsUUID()
  declare academicYearId: string;

  @IsUUID()
  declare gradeId: string;
}

export class HomeroomAssignmentItemDto {
  @IsUUID()
  declare classroomId: string;
}

export class SubjectAssignmentItemDto {
  @IsUUID()
  declare classroomId: string;

  @IsUUID()
  declare subjectId: string;
}

export class UpdateTeacherAssignmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeChiefAssignmentItemDto)
  gradeChief!: GradeChiefAssignmentItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HomeroomAssignmentItemDto)
  homeroom!: HomeroomAssignmentItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectAssignmentItemDto)
  subjectTeaching!: SubjectAssignmentItemDto[];
}

export class TeacherProfileCapabilityDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  sectorIds!: string[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  competentSubjectIds!: string[];

  @IsArray()
  @IsUUID(undefined, { each: true })
  eligibleGradeIds!: string[];
}

export class UpdateTeacherTeachingSetupDto {
  @ValidateNested()
  @Type(() => TeacherProfileCapabilityDto)
  capability!: TeacherProfileCapabilityDto;

  @ValidateNested()
  @Type(() => UpdateTeacherAssignmentsDto)
  assignments!: UpdateTeacherAssignmentsDto;
}

export class ProvisionStaffDto {
  @IsString()
  @IsNotEmpty()
  declare fullName: string;

  @IsEmail()
  declare email: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsIn([...personTypes])
  @IsOptional()
  personType?: (typeof personTypes)[number];

  @IsString()
  @IsNotEmpty()
  roleKey!: string;

  @IsBoolean()
  @IsOptional()
  createLogin?: boolean;

  @IsString()
  @IsOptional()
  rbacRoleKey?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsDateString()
  @IsOptional()
  joinDate?: string;

  @IsString()
  @IsOptional()
  promotionTitle?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffQualificationDto)
  qualifications?: StaffQualificationDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTeacherAssignmentsDto)
  teacherAssignments?: UpdateTeacherAssignmentsDto;
}

export class ProvisionStaffUpdateDto extends UpdateStaffDto {
  @IsIn([...personTypes])
  @IsOptional()
  personType?: (typeof personTypes)[number];

  @IsString()
  @IsOptional()
  roleKey?: string;

  @IsString()
  @IsOptional()
  rbacRoleKey?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  promotionTitle?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffQualificationDto)
  qualifications?: StaffQualificationDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTeacherAssignmentsDto)
  teacherAssignments?: UpdateTeacherAssignmentsDto;
}
