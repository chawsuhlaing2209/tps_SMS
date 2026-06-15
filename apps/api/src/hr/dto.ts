import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

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
  search?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
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
