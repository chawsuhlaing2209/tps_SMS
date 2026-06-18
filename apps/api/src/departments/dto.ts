import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateDepartmentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
