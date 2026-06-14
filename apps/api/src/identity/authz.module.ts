import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module.js";
import { IdentityManageGuard } from "./identity-manage.guard.js";
import { PasswordService } from "./password.service.js";
import { PermissionsGuard } from "./permissions.guard.js";
import { PlatformAdminGuard } from "./platform-admin.guard.js";
import { RbacService } from "./rbac.service.js";
import { RequestContextService } from "./request-context.service.js";
import { TeacherAssignmentService } from "./teacher-assignment.service.js";

/**
 * Authorization primitives shared across feature modules. Kept free of
 * AuditModule so feature modules can depend on guards without creating a
 * circular dependency with audit logging.
 */
@Module({
  imports: [DbModule],
  providers: [
    PasswordService,
    RequestContextService,
    RbacService,
    TeacherAssignmentService,
    PermissionsGuard,
    PlatformAdminGuard,
    IdentityManageGuard
  ],
  exports: [
    PasswordService,
    RequestContextService,
    RbacService,
    TeacherAssignmentService,
    PermissionsGuard,
    PlatformAdminGuard,
    IdentityManageGuard
  ]
})
export class AuthzModule {}
