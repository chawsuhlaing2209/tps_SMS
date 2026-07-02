import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { RequireAnyPermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { ArchiveService } from "./archive.service.js";

@Controller("tenants/:tenantId/archive")
@UseGuards(PermissionsGuard)
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  /** Run the retention auto-purge for this tenant now. */
  @Post("purge")
  @RequireAnyPermissions("student.manage", "hr.manage")
  purgeNow(@Param("tenantId") tenantId: string) {
    return this.archiveService.purgeNow(tenantId);
  }
}
