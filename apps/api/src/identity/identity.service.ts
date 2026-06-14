import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { rolePermissions, roles as defaultRoles } from "@sms/shared";
import { eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { roles, sessions, userRoles, users } from "../db/schema.js";
import type { AssignRoleDto, CreateSessionDto, InviteUserDto } from "./dto.js";

@Injectable()
export class IdentityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  async seedTenantRoles(tenantId: string) {
    const seeded = [];

    for (const roleKey of defaultRoles) {
      const [role] = await this.db
        .insert(roles)
        .values({
          tenantId,
          key: roleKey,
          name: roleKey
            .split("_")
            .map((part) => part[0]?.toUpperCase() + part.slice(1))
            .join(" "),
          permissions: rolePermissions[roleKey]
        })
        .onConflictDoUpdate({
          target: [roles.tenantId, roles.key],
          set: {
            permissions: rolePermissions[roleKey],
            updatedAt: new Date()
          }
        })
        .returning();

      seeded.push(role);
    }

    return seeded;
  }

  listTenantUsers(tenantId: string) {
    return this.db.select().from(users).where(eq(users.tenantId, tenantId));
  }

  listTenantRoles(tenantId: string) {
    return this.db.select().from(roles).where(eq(roles.tenantId, tenantId));
  }

  async inviteUser(tenantId: string, dto: InviteUserDto, actorUserId?: string) {
    const [user] = await this.db
      .insert(users)
      .values({
        tenantId,
        email: dto.email,
        phone: dto.phone,
        displayName: dto.displayName,
        status: "invited"
      })
      .returning();

    if (user) {
      await this.auditService.recordEvent({
        tenantId,
        actorUserId: actorUserId ?? null,
        action: "user.invite",
        recordType: "User",
        recordId: user.id,
        after: { email: dto.email, phone: dto.phone, displayName: dto.displayName }
      });
    }

    return user;
  }

  async assignRole(tenantId: string, dto: AssignRoleDto, actorUserId?: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, dto.userId));

    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundException("Tenant user not found.");
    }

    const [role] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, dto.roleId));

    if (!role || role.tenantId !== tenantId) {
      throw new NotFoundException("Tenant role not found.");
    }

    const [assignment] = await this.db
      .insert(userRoles)
      .values({
        tenantId,
        userId: dto.userId,
        roleId: dto.roleId
      })
      .onConflictDoNothing()
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "user.role.assign",
      recordType: "UserRole",
      recordId: `${dto.userId}:${dto.roleId}`,
      after: { userId: dto.userId, roleId: dto.roleId }
    });

    return assignment ?? { tenantId, userId: dto.userId, roleId: dto.roleId };
  }

  async createSession(tenantId: string, dto: CreateSessionDto) {
    const [session] = await this.db
      .insert(sessions)
      .values({
        tenantId,
        userId: dto.userId,
        tokenHash: dto.tokenHash,
        expiresAt: new Date(dto.expiresAt),
        userAgent: dto.userAgent,
        ipAddress: dto.ipAddress
      })
      .returning();

    return session;
  }
}
