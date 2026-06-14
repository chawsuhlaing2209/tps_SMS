import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Permission, Role } from "@sms/shared";
import { rolePermissions } from "@sms/shared";
import type { TenantContext } from "../tenancy/tenant-context.js";

@Injectable()
export class RbacService {
  permissionsForRoles(roles: Role[]): Permission[] {
    return [...new Set(roles.flatMap((role) => rolePermissions[role] ?? []))];
  }

  assertTenantAccess(context: TenantContext, tenantId: string) {
    if (context.tenantId !== tenantId) {
      throw new ForbiddenException("Tenant access denied.");
    }
  }

  assertPermission(context: TenantContext, permission: Permission) {
    if (!context.permissions.includes(permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  assertTeacherAssignment(isAssigned: boolean) {
    if (!isAssigned) {
      throw new ForbiddenException("Teacher access is limited to assigned classes and subjects.");
    }
  }
}
