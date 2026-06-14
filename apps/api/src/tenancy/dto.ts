import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

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
