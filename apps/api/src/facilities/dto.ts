import { Type } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class CreateFacilityRoomDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateFacilityRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number | null;

  @IsString()
  @IsOptional()
  note?: string | null;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
