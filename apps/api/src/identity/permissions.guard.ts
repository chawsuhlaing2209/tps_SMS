import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@sms/shared";
import type { TenantContext } from "../tenancy/tenant-context.js";
import {
  PERMISSIONS_KEY,
  PERMISSIONS_MODE_KEY,
  type PermissionsMode
} from "./permissions.decorator.js";
import { RequestContextService } from "./request-context.service.js";
import { readSessionCookie } from "./session-cookie.js";
import { TeacherAssignmentService } from "./teacher-assignment.service.js";
import { TEACHER_SCOPE_KEY, type TeacherScopeOptions } from "./teacher-scope.decorator.js";

interface GuardedRequest {
  params?: Record<string, string | undefined>;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  tenantContext?: TenantContext;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService,
    private readonly teacherAssignmentService: TeacherAssignmentService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const tenantId = request.params?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException("Tenant context is required for this action.");
    }

    const actorUserId = await this.requestContextService.actorFromSessionToken(
      readSessionCookie(request)
    );
    const tenantContext = await this.requestContextService.resolve(tenantId, actorUserId);

    const mode = this.reflector.getAllAndOverride<PermissionsMode>(PERMISSIONS_MODE_KEY, [
      context.getHandler(),
      context.getClass()
    ]) ?? "all";

    const authorized =
      mode === "any"
        ? required.some((permission) => tenantContext.permissions.includes(permission))
        : required.every((permission) => tenantContext.permissions.includes(permission));

    if (!authorized) {
      throw new ForbiddenException("Missing required permissions for this action.");
    }

    request.tenantContext = tenantContext;

    const teacherScope = this.reflector.getAllAndOverride<TeacherScopeOptions>(TEACHER_SCOPE_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (teacherScope) {
      await this.teacherAssignmentService.enforceScope(tenantContext, request, teacherScope);
    }

    return true;
  }
}
