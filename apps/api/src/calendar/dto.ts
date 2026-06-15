import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class CreateCalendarEventDto {
  @IsString()
  @IsNotEmpty()
  declare title: string;

  @IsString()
  declare eventType: string;

  @IsDateString()
  declare startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}

export class UpdateCalendarEventDto extends PartialType(CreateCalendarEventDto) {}

export class ListCalendarEventsQueryDto {
  @IsString()
  @IsOptional()
  month?: string;

  @IsString()
  @IsOptional()
  eventType?: string;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}
