import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { enableRlsBypass } from "../db/tenant-db-context.js";
import { RequestContextService } from "./request-context.service.js";
import { readSessionCookie } from "./session-cookie.js";

interface GuardedRequest {
  headers?: Record<string, string | string[] | undefined>;
  platformActorUserId?: string;
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly requestContextService: RequestContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const actorUserId = await this.requestContextService.actorFromSessionToken(
      readSessionCookie(request)
    );
    request.platformActorUserId = await this.requestContextService.assertPlatformAdmin(actorUserId);
    // Verified platform admin: this request may read across tenants (RLS).
    enableRlsBypass();
    return true;
  }
}
