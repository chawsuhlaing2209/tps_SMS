import { IsOptional, IsString, IsUUID } from "class-validator";

export class ListReportCardsQueryDto {
  @IsOptional()
  @IsUUID()
  declare classroomId?: string;

  @IsOptional()
  @IsString()
  declare status?: string;
}

export class GenerateReportCardsDto {
  @IsUUID()
  declare classroomId: string;

  @IsUUID()
  declare academicYearId: string;

  @IsOptional()
  @IsUUID()
  declare termId?: string;
}
