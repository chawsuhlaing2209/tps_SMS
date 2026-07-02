import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { RequireAnyPermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { ArchiveService } from "./archive.service.js";

@Controller("tenants/:tenantId/archive")
@UseGuards(PermissionsGuard)
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  /** Aggregated archived records across modules (the recycle bin). */
  @Get("recycle-bin")
  @RequireAnyPermissions("student.manage", "hr.manage", "academic_setup.manage", "finance.manage")
  getRecycleBin(@Param("tenantId") tenantId: string) {
    return this.archiveService.getRecycleBin(tenantId);
  }
}
