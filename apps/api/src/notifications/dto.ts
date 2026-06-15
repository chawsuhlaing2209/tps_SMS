import { IsEnum, IsOptional, IsString } from "class-validator";

export class CreateEmailTemplateDto {
  @IsString()
  declare key: string;

  @IsEnum(["en", "my"])
  declare language: "en" | "my";

  @IsString()
  declare subject: string;

  @IsString()
  declare body: string;
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  declare subject?: string;

  @IsOptional()
  @IsString()
  declare body?: string;

  @IsOptional()
  @IsEnum(["active", "inactive"])
  declare status?: "active" | "inactive";
}

export class ListNotificationLogsDto {
  @IsOptional()
  @IsString()
  declare status?: string;

  @IsOptional()
  @IsString()
  declare dateFrom?: string;

  @IsOptional()
  @IsString()
  declare dateTo?: string;

  @IsOptional()
  @IsString()
  declare recipientEmail?: string;
}
