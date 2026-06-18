import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches
} from "class-validator";

export class InviteUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;
}

export class AssignRoleDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  roleId!: string;
}

export class CreateSessionDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  tokenHash!: string;

  @IsString()
  @IsNotEmpty()
  expiresAt!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class CreateTenantRoleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/)
  key?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateTenantRoleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
