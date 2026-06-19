import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { and, eq, isNull, or } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import {
  accountActivationTokens,
  passwordResetTokens,
  sessions,
  tenants,
  users
} from "../db/schema.js";
import type {
  ActivateAccountDto,
  ConfirmPasswordResetDto,
  LoginDto,
  RequestPasswordResetDto,
  RevokeSessionDto
} from "./auth.dto.js";
import { PasswordService } from "./password.service.js";
import { RequestContextService } from "./request-context.service.js";
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS } from "./session-cookie.js";

const RESET_TTL_MS = 1000 * 60 * 30;
const ACTIVATION_TTL_MS = 1000 * 60 * 60 * 72;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService,
    private readonly notifications: NotificationsService,
    private readonly requestContextService: RequestContextService
  ) {}

  async issueActivationToken(tenantId: string, userId: string) {
    const token = this.passwordService.generateToken();
    const tokenHash = this.passwordService.hashToken(token);
    const expiresAt = new Date(Date.now() + ACTIVATION_TTL_MS);

    await this.db.insert(accountActivationTokens).values({
      tenantId,
      userId,
      tokenHash,
      expiresAt
    });

    return { token, expiresAt };
  }

  async activateAccount(tenantId: string, dto: ActivateAccountDto) {
    const tokenHash = this.passwordService.hashToken(dto.token);

    const [activationToken] = await this.db
      .select()
      .from(accountActivationTokens)
      .where(
        and(
          eq(accountActivationTokens.tenantId, tenantId),
          eq(accountActivationTokens.tokenHash, tokenHash),
          isNull(accountActivationTokens.usedAt)
        )
      );

    if (!activationToken || activationToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Activation token is invalid or expired.");
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, activationToken.userId));

    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException("Tenant user not found.");
    }

    if (user.status !== "invited") {
      throw new BadRequestException("This account is not eligible for activation.");
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const [updated] = await this.db
      .update(users)
      .set({ passwordHash, status: "active", updatedAt: new Date() })
      .where(eq(users.id, activationToken.userId))
      .returning({ id: users.id, status: users.status });

    await this.db
      .update(accountActivationTokens)
      .set({ usedAt: new Date() })
      .where(eq(accountActivationTokens.id, activationToken.id));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: activationToken.userId,
      action: "user.activate",
      recordType: "User",
      recordId: activationToken.userId,
      before: { status: user.status },
      after: { status: "active" }
    });

    return updated;
  }

  /**
   * Accepts either a tenant UUID or a tenant slug (e.g. "demo-alpha") and
   * returns the canonical tenant UUID. Uses the generic credentials error to
   * avoid leaking which tenants exist.
   */
  private async resolveTenantId(tenantIdOrSlug: string): Promise<string> {
    const [tenant] = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        UUID_PATTERN.test(tenantIdOrSlug)
          ? eq(tenants.id, tenantIdOrSlug)
          : eq(tenants.slug, tenantIdOrSlug)
      );

    if (!tenant) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return tenant.id;
  }

  async login(tenantIdOrSlug: string, dto: LoginDto) {
    const tenantId = await this.resolveTenantId(tenantIdOrSlug);

    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          or(eq(users.email, dto.identifier), eq(users.phone, dto.identifier))
        )
      );

    if (!user || !user.passwordHash || user.status !== "active") {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const valid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const token = this.passwordService.generateToken();
    const tokenHash = this.passwordService.hashToken(token);
    const now = Date.now();
    // Stored idle deadline (slides forward on activity); the absolute lifetime is
    // enforced from the session's createdAt and surfaced to the client/cookie.
    const idleExpiresAt = new Date(now + SESSION_IDLE_TTL_MS);
    const absoluteExpiresAt = new Date(now + SESSION_ABSOLUTE_TTL_MS);

    const [session] = await this.db
      .insert(sessions)
      .values({
        tenantId,
        userId: user.id,
        tokenHash,
        expiresAt: idleExpiresAt,
        userAgent: dto.userAgent,
        ipAddress: dto.ipAddress
      })
      .returning({ id: sessions.id });

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: user.id,
      action: "user.login",
      recordType: "Session",
      recordId: session?.id ?? user.id,
      after: { userId: user.id }
    });

    const access = await this.requestContextService.resolve(tenantId, user.id);

    return {
      token,
      sessionId: session?.id,
      userId: user.id,
      tenantId,
      displayName: user.displayName,
      expiresAt: absoluteExpiresAt,
      roles: access.roles,
      permissions: access.permissions
    };
  }

  async getProfile(tenantId: string, token: string | undefined) {
    const actorUserId = await this.requestContextService.actorFromSessionToken(token);
    if (!actorUserId) {
      throw new UnauthorizedException("Missing or expired session.");
    }

    const access = await this.requestContextService.resolve(tenantId, actorUserId);
    const [user] = await this.db.select().from(users).where(eq(users.id, actorUserId));

    if (!user) {
      throw new UnauthorizedException("Unknown actor user.");
    }

    return {
      userId: user.id,
      tenantId,
      displayName: user.displayName,
      roles: access.roles,
      permissions: access.permissions
    };
  }

  async platformLogin(dto: LoginDto) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.tenantId),
          or(eq(users.email, dto.identifier), eq(users.phone, dto.identifier))
        )
      );

    if (!user || !user.passwordHash || user.status !== "active") {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const valid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const token = this.passwordService.generateToken();
    const tokenHash = this.passwordService.hashToken(token);
    const now = Date.now();
    const idleExpiresAt = new Date(now + SESSION_IDLE_TTL_MS);
    const absoluteExpiresAt = new Date(now + SESSION_ABSOLUTE_TTL_MS);

    const [session] = await this.db
      .insert(sessions)
      .values({
        tenantId: null,
        userId: user.id,
        tokenHash,
        expiresAt: idleExpiresAt,
        userAgent: dto.userAgent,
        ipAddress: dto.ipAddress
      })
      .returning({ id: sessions.id });

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    await this.auditService.recordEvent({
      tenantId: null,
      actorUserId: user.id,
      action: "platform.login",
      recordType: "Session",
      recordId: session?.id ?? user.id,
      after: { userId: user.id }
    });

    return {
      token,
      sessionId: session?.id,
      userId: user.id,
      tenantId: null,
      displayName: user.displayName,
      expiresAt: absoluteExpiresAt
    };
  }

  async requestPasswordReset(tenantId: string, dto: RequestPasswordResetDto) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          or(eq(users.email, dto.identifier), eq(users.phone, dto.identifier))
        )
      );

    // Always return success-shaped response to avoid account enumeration.
    if (!user) {
      return { requested: true };
    }

    const token = this.passwordService.generateToken();
    const tokenHash = this.passwordService.hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await this.db.insert(passwordResetTokens).values({
      tenantId,
      userId: user.id,
      tokenHash,
      expiresAt
    });

    if (user.email) {
      await this.notifications.sendPasswordResetEmail({
        tenantId,
        recipient: user.email,
        token,
        expiresAt
      });
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: user.id,
      action: "user.password_reset.request",
      recordType: "User",
      recordId: user.id
    });

    // The token is delivered out-of-band via the email channel and never
    // returned in the response, so it cannot be read by an unauthenticated
    // caller or leak through logs of the API response body.
    return { requested: true };
  }

  async confirmPasswordReset(tenantId: string, dto: ConfirmPasswordResetDto) {
    const tokenHash = this.passwordService.hashToken(dto.token);

    const [resetToken] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tenantId, tenantId),
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt)
        )
      );

    if (!resetToken || resetToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Reset token is invalid or expired.");
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    await this.db
      .update(users)
      .set({ passwordHash, status: "active", updatedAt: new Date() })
      .where(eq(users.id, resetToken.userId));

    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    // Revoke all active sessions after a password reset.
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tenantId, tenantId), eq(sessions.userId, resetToken.userId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: resetToken.userId,
      action: "user.password_reset.confirm",
      recordType: "User",
      recordId: resetToken.userId
    });

    return { reset: true };
  }

  async logout(token: string | undefined) {
    if (!token) {
      return { loggedOut: true };
    }

    const tokenHash = this.passwordService.hashToken(token);
    const [session] = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
      .returning({
        id: sessions.id,
        userId: sessions.userId,
        tenantId: sessions.tenantId
      });

    if (session?.tenantId) {
      await this.auditService.recordEvent({
        tenantId: session.tenantId,
        actorUserId: session.userId,
        action: "user.logout",
        recordType: "Session",
        recordId: session.id
      });
    }

    return { loggedOut: true };
  }

  async revokeSession(tenantId: string, dto: RevokeSessionDto, actorUserId?: string) {
    const [session] = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tenantId, tenantId), eq(sessions.id, dto.sessionId)))
      .returning({ id: sessions.id, revokedAt: sessions.revokedAt });

    if (!session) {
      throw new NotFoundException("Session not found.");
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "session.revoke",
      recordType: "Session",
      recordId: dto.sessionId
    });

    return session;
  }
}
