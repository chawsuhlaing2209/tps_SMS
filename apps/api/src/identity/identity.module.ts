import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DbModule } from "../db/db.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AuthzModule } from "./authz.module.js";
import { IdentityController } from "./identity.controller.js";
import { IdentityService } from "./identity.service.js";
import { PlatformAuthController } from "./platform-auth.controller.js";
import { RbacService } from "./rbac.service.js";

@Module({
  imports: [DbModule, AuditModule, AuthzModule, NotificationsModule],
  controllers: [IdentityController, AuthController, PlatformAuthController],
  providers: [IdentityService, AuthService, RbacService],
  exports: [IdentityService, AuthService, RbacService, AuthzModule]
})
export class IdentityModule {}
