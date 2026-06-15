import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from "class-validator";

export class CreateEnquiryDto {
  @IsString()
  @IsNotEmpty()
  prospectName!: string;

  @IsString()
  @IsOptional()
  guardianName?: string;

  @IsString()
  @IsOptional()
  guardianPhone?: string;

  @IsString()
  @IsOptional()
  guardianEmail?: string;

  @IsString()
  @IsOptional()
  interestedGrade?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  assignedToUserId?: string;

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @IsBoolean()
  @IsOptional()
  ferryInterest?: boolean;

  @IsBoolean()
  @IsOptional()
  boardingInterest?: boolean;
}

export class UpdateEnquiryDto implements Partial<CreateEnquiryDto> {
  @IsString()
  @IsOptional()
  prospectName?: string;

  @IsString()
  @IsOptional()
  guardianName?: string;

  @IsString()
  @IsOptional()
  guardianPhone?: string;

  @IsString()
  @IsOptional()
  guardianEmail?: string;

  @IsString()
  @IsOptional()
  interestedGrade?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  assignedToUserId?: string;

  @IsDateString()
  @IsOptional()
  followUpDate?: string;

  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @IsBoolean()
  @IsOptional()
  ferryInterest?: boolean;

  @IsBoolean()
  @IsOptional()
  boardingInterest?: boolean;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  lostReason?: string;
}

export class CreateLeadActivityDto {
  @IsString()
  @IsNotEmpty()
  activityType!: string;

  @IsString()
  @IsNotEmpty()
  notes!: string;

  @IsDateString()
  @IsOptional()
  activityDate?: string;
}

export class ConvertEnquiryDto {
  @IsDateString()
  @IsOptional()
  enrollmentDate?: string;
}

export class ListEnquiriesQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  assignedToUserId?: string;

  @IsString()
  @IsOptional()
  source?: string;

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
