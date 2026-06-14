import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

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
