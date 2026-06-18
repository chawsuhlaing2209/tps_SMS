import { IsOptional, IsString, IsUUID } from "class-validator";

export class CreateMaterialDto {
  @IsString()
  declare title: string;

  @IsUUID()
  declare subjectId: string;

  @IsUUID()
  declare fileId: string;

  @IsUUID()
  @IsOptional()
  uploadedByStaffId?: string;

  @IsOptional()
  @IsString()
  declare topicTag?: string;
}

export class CreateAssignmentDto {
  @IsUUID()
  declare subjectId: string;

  @IsString()
  declare title: string;

  @IsOptional()
  @IsString()
  declare instructions?: string;

  @IsOptional()
  @IsString()
  declare dueDate?: string;
}

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  declare title?: string;

  @IsOptional()
  @IsString()
  declare instructions?: string;

  @IsOptional()
  @IsString()
  declare dueDate?: string;
}
