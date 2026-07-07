import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import {
  DATE_FORMATS,
  SCHOOL_TYPES,
  SUPPORTED_LANGUAGES,
  TIME_FORMATS,
  type DateFormat,
  type SchoolType,
  type SupportedLanguage,
  type TimeFormat
} from "@sms/shared";

export class UpdateSchoolProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  schoolName!: string;

  @IsOptional()
  @IsIn([...SCHOOL_TYPES])
  schoolType?: SchoolType | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  motto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string | null;

  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  principalName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  registrationNumber?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2200)
  establishedYear?: number | null;
}

export class UpdateTenantPreferencesDto {
  @IsIn([...SUPPORTED_LANGUAGES])
  defaultLanguage!: SupportedLanguage;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  currency!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone!: string;

  @IsIn([...DATE_FORMATS])
  dateFormat!: DateFormat;

  @IsIn([...TIME_FORMATS])
  timeFormat!: TimeFormat;
}
