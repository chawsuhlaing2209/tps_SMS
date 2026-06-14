import { IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class ActivateAccountDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(10)
  password!: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class RevokeSessionDto {
  @IsUUID()
  sessionId!: string;
}

export class RequestPasswordResetDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(10)
  password!: string;
}
