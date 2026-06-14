import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@sms/shared";
import { PERMISSIONS_KEY } from "./permissions.decorator.js";
import { RequestContextService } from "./request-context.service.js";
import { readSessionCookie } from "./session-cookie.js";

interface GuardedRequest {
  params?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  tenantContext?: unknown;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContextService: RequestContextService
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

    const hasAll = required.every((permission) =>
      tenantContext.permissions.includes(permission)
    );

    if (!hasAll) {
      throw new ForbiddenException("Missing required permissions for this action.");
    }

    request.tenantContext = tenantContext;

    return true;
  }
}
