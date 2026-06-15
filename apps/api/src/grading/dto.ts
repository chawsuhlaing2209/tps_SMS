import { IsString, IsUUID } from "class-validator";

export class CreateGradeRuleDto {
  @IsUUID()
  declare academicYearId: string;

  @IsString()
  declare name: string;
}
