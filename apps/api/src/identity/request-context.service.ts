import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import { roles, sessions, userRoles, users } from "../db/schema.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import { PasswordService } from "./password.service.js";
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS } from "./session-cookie.js";

// Avoid a database write on every request: only push the idle deadline forward
// when it would move by at least this much.
const SLIDE_THRESHOLD_MS = 1000 * 60;

@Injectable()
export class RequestContextService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly passwordService: PasswordService
  ) {}

  /**
   * Resolves the acting user from a session cookie token, enforcing a sliding
   * idle timeout and a hard absolute lifetime. Returns undefined for missing,
   * revoked, idle-expired, or lifetime-exceeded sessions so callers can reject
   * the request. The client never supplies the user id directly; it is derived
   * from a valid server-side session.
   */
  async actorFromSessionToken(token: string | undefined): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }

    const tokenHash = this.passwordService.hashToken(token);
    const [session] = await this.db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        createdAt: sessions.createdAt
      })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));

    if (!session) {
      return undefined;
    }

    const now = Date.now();
    const absoluteDeadline = session.createdAt.getTime() + SESSION_ABSOLUTE_TTL_MS;

    // Idle timeout (expiresAt) or absolute lifetime exceeded.
    if (session.expiresAt.getTime() < now || absoluteDeadline < now) {
      return undefined;
    }

    // Slide the idle deadline forward, capped by the absolute lifetime.
    const nextExpiry = Math.min(now + SESSION_IDLE_TTL_MS, absoluteDeadline);
    if (nextExpiry - session.expiresAt.getTime() >= SLIDE_THRESHOLD_MS) {
      await this.db
        .update(sessions)
        .set({ expiresAt: new Date(nextExpiry) })
        .where(eq(sessions.id, session.id));
    }

    return session.userId;
  }

  async assertPlatformAdmin(actorUserId: string | undefined): Promise<string> {
    if (!actorUserId) {
      throw new UnauthorizedException("Missing actor user id.");
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, actorUserId));

    if (!user) {
      throw new UnauthorizedException("Unknown actor user.");
    }

    if (user.tenantId !== null || user.status !== "active") {
      throw new ForbiddenException("Platform administrator access is required.");
    }

    return user.id;
  }

  async resolve(tenantId: string, actorUserId: string | undefined): Promise<TenantContext> {
    if (!actorUserId) {
      throw new UnauthorizedException("Missing actor user id.");
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, actorUserId));

    if (!user) {
      throw new UnauthorizedException("Unknown actor user.");
    }

    if (user.tenantId !== null && user.tenantId !== tenantId) {
      throw new UnauthorizedException("Actor does not belong to this tenant.");
    }

    const assignedRoles = await this.db
      .select({ key: roles.key, permissions: roles.permissions })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, actorUserId)));

    const permissionSet = new Set<string>();
    for (const role of assignedRoles) {
      for (const permission of role.permissions) {
        permissionSet.add(permission);
      }
    }

    return {
      tenantId,
      tenantSlug: "",
      actorUserId,
      roles: assignedRoles.map((role) => role.key),
      permissions: [...permissionSet]
    };
  }
}
