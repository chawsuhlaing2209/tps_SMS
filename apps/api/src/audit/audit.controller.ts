import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { AuditService } from "./audit.service.js";

class ListAuditQueryDto {
  @IsString()
  @IsOptional()
  recordType?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

@Controller("tenants/:tenantId/audit-logs")
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions("audit.view")
  list(@Param("tenantId") tenantId: string, @Query() query: ListAuditQueryDto) {
    return this.auditService.listForTenant(tenantId, query);
  }
}
