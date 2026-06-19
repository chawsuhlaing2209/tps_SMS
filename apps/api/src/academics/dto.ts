import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";

export class CreateAcademicYearDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;
}

export class UpdateAcademicYearDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;
}

export class SetAcademicYearActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class CreateTermDto {
  @IsUUID()
  academicYearId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;
}

export class CreateGradeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  subjectIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  gradeChiefStaffId?: string | null;
}

export class UpdateGradeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAge?: number | null;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  subjectIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  gradeChiefStaffId?: string | null;
}

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  subjectType?: string;

  @IsOptional()
  @IsString()
  colorKey?: string;

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  gradeIds?: string[];
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  subjectType?: string;

  @IsOptional()
  @IsString()
  colorKey?: string;

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  gradeIds?: string[];
}

export class UpdateTermDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;
}

export class ImportMasterDataDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGradeDto)
  grades?: CreateGradeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSubjectDto)
  subjects?: CreateSubjectDto[];
}

export class AssignGradeSubjectDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  gradeId!: string;

  @IsUUID()
  subjectId!: string;

  @IsOptional()
  @IsString()
  weight?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class UpdateGradeSubjectDto {
  @IsOptional()
  @IsString()
  weight?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
