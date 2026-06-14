import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { AuditService } from "./audit.service.js";

@Controller("tenants/:tenantId/audit-logs")
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions("audit.view")
  list(@Param("tenantId") tenantId: string, @Query("recordType") recordType?: string) {
    return this.auditService.listForTenant(tenantId, recordType);
  }
}
