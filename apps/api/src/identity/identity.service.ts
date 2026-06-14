import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { rolePermissions, roles as defaultRoles } from "@sms/shared";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { roles, sessions, tenants, userRoles, users } from "../db/schema.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { AssignRoleDto, CreateSessionDto, InviteUserDto } from "./dto.js";
import { PasswordService } from "./password.service.js";

export interface ProvisionedOwner {
  userId: string;
  email: string;
  credentialsSent: boolean;
}

@Injectable()
export class IdentityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly passwordService: PasswordService,
    private readonly notifications: NotificationsService
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

  /**
   * Seeds tenant roles, creates an active school owner, assigns the role, and
   * emails login credentials. The password is never returned from this method.
   */
  async provisionSchoolOwner(
    tenantId: string,
    input: { displayName: string; email: string; password?: string; schoolName: string; tenantSlug: string },
    actorUserId?: string
  ): Promise<ProvisionedOwner> {
    await this.seedTenantRoles(tenantId);

    const plainPassword = input.password ?? this.passwordService.generateTemporaryPassword();
    const passwordHash = await this.passwordService.hash(plainPassword);

    const [user] = await this.db
      .insert(users)
      .values({
        tenantId,
        email: input.email,
        displayName: input.displayName,
        status: "active",
        passwordHash
      })
      .returning();

    if (!user) {
      throw new BadRequestException("Failed to create the school owner account.");
    }

    const [ownerRole] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.key, "school_owner")));

    if (!ownerRole) {
      throw new NotFoundException("School owner role was not seeded.");
    }

    await this.db
      .insert(userRoles)
      .values({ tenantId, userId: user.id, roleId: ownerRole.id })
      .onConflictDoNothing();

    await this.notifications.sendOwnerWelcomeEmail({
      tenantId,
      recipient: input.email,
      schoolName: input.schoolName,
      tenantSlug: input.tenantSlug,
      displayName: input.displayName,
      password: plainPassword
    });

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "user.provision",
      recordType: "User",
      recordId: user.id,
      after: { email: input.email, displayName: input.displayName, role: "school_owner" }
    });

    return { userId: user.id, email: input.email, credentialsSent: true };
  }

  async inviteUser(tenantId: string, dto: InviteUserDto, actorUserId?: string) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException("Provide an email or phone number to invite a user.");
    }

    let plainPassword: string | undefined;
    let passwordHash: string | undefined;

    if (dto.email) {
      plainPassword = this.passwordService.generateTemporaryPassword();
      passwordHash = await this.passwordService.hash(plainPassword);
    }

    const [user] = await this.db
      .insert(users)
      .values({
        tenantId,
        email: dto.email,
        phone: dto.phone,
        displayName: dto.displayName,
        status: dto.email ? "active" : "invited",
        passwordHash
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

      if (dto.email && plainPassword) {
        const [tenant] = await this.db
          .select({ name: tenants.name, slug: tenants.slug })
          .from(tenants)
          .where(eq(tenants.id, tenantId));

        if (tenant) {
          await this.notifications.sendOwnerWelcomeEmail({
            tenantId,
            recipient: dto.email,
            schoolName: tenant.name,
            tenantSlug: tenant.slug,
            displayName: dto.displayName,
            password: plainPassword
          });
        }
      }
    }

    return {
      ...user,
      credentialsSent: Boolean(dto.email)
    };
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
