import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
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
