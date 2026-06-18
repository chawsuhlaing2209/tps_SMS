import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { Type, Transform } from "class-transformer";

export class CreateExamCycleDto {
  @IsUUID()
  declare academicYearId: string;

  @IsString()
  declare name: string;

  @IsString()
  declare examType: string;
}

export class ListExamSchedulesQueryDto {
  @IsOptional()
  @IsUUID()
  declare cycleId?: string;

  @IsOptional()
  @IsUUID()
  declare classroomId?: string;
}

export class CreateExamScheduleDto {
  @IsUUID()
  declare examCycleId: string;

  @IsUUID()
  declare classroomId: string;

  @IsUUID()
  declare subjectId: string;

  @IsString()
  declare examDate: string;

  @IsOptional()
  @IsString()
  declare startTime?: string;

  @IsOptional()
  @IsString()
  declare endTime?: string;

  @IsNumber()
  declare maxMarks: number;
}

export class ResultEntryDto {
  @IsUUID()
  declare studentId: string;

  @IsOptional()
  @IsNumber()
  declare marksObtained?: number;

  @IsOptional()
  @IsString()
  declare grade?: string;

  @IsOptional()
  @IsString()
  declare remarks?: string;
}

export class BulkResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultEntryDto)
  declare results: ResultEntryDto[];
}

export class CorrectAssessmentResultDto {
  @IsOptional()
  @IsNumber()
  declare marksObtained?: number;

  @IsOptional()
  @IsString()
  declare grade?: string;

  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty()
  declare correctionReason: string;
}
