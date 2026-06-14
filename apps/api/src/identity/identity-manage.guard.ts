import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { RequestContextService } from "./request-context.service.js";
import { readSessionCookie } from "./session-cookie.js";

interface GuardedRequest {
  params?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  tenantContext?: unknown;
  platformActorUserId?: string;
}

/**
 * Allows tenant provisioning routes for either a platform administrator
 * (onboarding the first tenant owner) or a tenant user with identity.manage.
 */
@Injectable()
export class IdentityManageGuard implements CanActivate {
  constructor(private readonly requestContextService: RequestContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const tenantId = request.params?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException("Tenant context is required for this action.");
    }

    const actorUserId = await this.requestContextService.actorFromSessionToken(
      readSessionCookie(request)
    );

    try {
      request.platformActorUserId = await this.requestContextService.assertPlatformAdmin(actorUserId);
      return true;
    } catch {
      const tenantContext = await this.requestContextService.resolve(tenantId, actorUserId);
      if (!tenantContext.permissions.includes("identity.manage")) {
        throw new ForbiddenException("Missing identity.manage permission.");
      }
      request.tenantContext = tenantContext;
      return true;
    }
  }
}
