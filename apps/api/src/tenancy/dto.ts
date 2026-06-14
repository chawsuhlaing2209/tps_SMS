import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested
} from "class-validator";

export class InitialOwnerDto {
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsEmail()
  email!: string;

  /** When omitted, a temporary password is generated and emailed to the owner. */
  @IsOptional()
  @IsString()
  @MinLength(10)
  password?: string;
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsIn(["my", "en"])
  defaultLanguage?: "my" | "en";

  @IsOptional()
  @IsString()
  currency?: string;

  @ValidateNested()
  @Type(() => InitialOwnerDto)
  initialOwner!: InitialOwnerDto;
}

export class UpdateTenantStatusDto {
  @IsIn(["active", "suspended", "archived"])
  status!: "active" | "suspended" | "archived";
}

export class UpsertTenantSettingsDto {
  @IsString()
  @IsNotEmpty()
  schoolName!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  receiptPrefix?: string;

  @IsOptional()
  @IsString()
  invoicePrefix?: string;
}

export class SetFeatureFlagDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsBoolean()
  enabled!: boolean;
}
