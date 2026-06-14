import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { AuthzModule } from "../identity/authz.module.js";
import { TenantManagementController } from "./tenant-management.controller.js";
import { TenantManagementService } from "./tenant-management.service.js";
import { TenancyController } from "./tenancy.controller.js";
import { TenancyService } from "./tenancy.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [TenancyController, TenantManagementController],
  providers: [TenancyService, TenantManagementService],
  exports: [TenancyService, TenantManagementService]
})
export class TenancyModule {}
