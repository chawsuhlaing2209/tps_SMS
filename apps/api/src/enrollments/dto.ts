import { IsOptional, IsString, IsUUID } from "class-validator";

export class ListEnrollmentsQueryDto {
  @IsOptional()
  @IsUUID()
  declare academicYearId?: string;

  @IsOptional()
  @IsUUID()
  declare studentId?: string;

  @IsOptional()
  @IsString()
  declare status?: string;
}

export class CreateEnrollmentDto {
  @IsUUID()
  declare studentId: string;

  @IsUUID()
  declare classroomId: string;

  @IsUUID()
  declare academicYearId: string;

  @IsUUID()
  declare gradeId: string;
}

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsString()
  declare status?: string;
}

export class ListStudentServicesQueryDto {
  @IsOptional()
  @IsUUID()
  declare studentId?: string;
}

export class CreateStudentServiceDto {
  @IsUUID()
  declare studentId: string;

  @IsUUID()
  declare feeItemId: string;

  @IsString()
  declare startDate: string;

  @IsOptional()
  @IsString()
  declare endDate?: string;
}
