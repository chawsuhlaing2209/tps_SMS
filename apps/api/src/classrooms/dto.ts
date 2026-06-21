import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min
} from "class-validator";

export class CreateClassroomDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  gradeId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsUUID()
  facilityRoomId?: string;

  @IsOptional()
  @IsUUID()
  classTeacherStaffId?: string;
}

export class UpdateClassroomDto {
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @IsOptional()
  @IsString()
  room?: string | null;

  @IsOptional()
  @IsUUID()
  facilityRoomId?: string | null;

  @IsOptional()
  @IsUUID()
  classTeacherStaffId?: string | null;
}

export class AssignClassroomSubjectTeacherDto {
  @IsOptional()
  @IsUUID()
  teacherStaffId?: string | null;
}
