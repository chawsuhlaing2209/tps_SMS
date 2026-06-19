import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { isTenantConfigurablePermission, roleDisplayFor, rolePermissions, roles as defaultRoles } from "@sms/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { roles, sessions, tenants, userRoles, users } from "../db/schema.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { AssignRoleDto, CreateSessionDto, CreateTenantRoleDto, InviteUserDto, UpdateTenantRoleDto } from "./dto.js";
import { AuthService } from "./auth.service.js";
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
    private readonly notifications: NotificationsService,
    private readonly authService: AuthService
  ) {}

  async seedTenantRoles(tenantId: string) {
    const seeded = [];

    for (const roleKey of defaultRoles) {
      const display = roleDisplayFor(roleKey);
      const [role] = await this.db
        .insert(roles)
        .values({
          tenantId,
          key: roleKey,
          name: display.label,
          permissions: rolePermissions[roleKey]
        })
        .onConflictDoUpdate({
          target: [roles.tenantId, roles.key],
          set: {
            name: display.label,
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
    return this.db
      .select({
        id: roles.id,
        key: roles.key,
        name: roles.name,
        permissions: roles.permissions,
        status: roles.status,
        userCount: sql<number>`count(${userRoles.id})::int`
      })
      .from(roles)
      .leftJoin(
        userRoles,
        and(eq(userRoles.roleId, roles.id), eq(userRoles.tenantId, tenantId))
      )
      .where(eq(roles.tenantId, tenantId))
      .groupBy(roles.id)
      .orderBy(asc(roles.name));
  }

  private readonly nonStaffRoleKeys = new Set([
    "parent_guardian",
    "student",
    "platform_super_admin"
  ]);

  async listAssignableRoles(tenantId: string, scope?: "team" | "teacher") {
    const rows = await this.listTenantRoles(tenantId);
    const filtered = rows.filter(
      (role) => role.status === "active" && !this.nonStaffRoleKeys.has(role.key)
    );

    if (scope === "team") {
      return filtered.filter((role) => role.key !== "teacher");
    }

    if (scope === "teacher") {
      return filtered.filter((role) => role.key === "teacher");
    }

    return filtered;
  }

  async assertAssignableRole(tenantId: string, roleKey: string) {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.key, roleKey)));

    if (!role) {
      throw new NotFoundException(`Role "${roleKey}" was not found.`);
    }

    if (role.status !== "active") {
      throw new BadRequestException("This role is disabled.");
    }

    if (this.nonStaffRoleKeys.has(role.key)) {
      throw new BadRequestException("This role cannot be assigned to staff.");
    }

    return role;
  }

  async getTenantRole(tenantId: string, roleId: string) {
    const rows = await this.listTenantRoles(tenantId);
    const role = rows.find((row) => row.id === roleId);
    if (!role) {
      throw new NotFoundException("Tenant role not found.");
    }
    return role;
  }

  private normalizePermissions(values: string[] | undefined) {
    if (!values) {
      return undefined;
    }

    const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    for (const permission of unique) {
      if (!isTenantConfigurablePermission(permission)) {
        throw new BadRequestException(`Unknown or unsupported permission: ${permission}`);
      }
    }

    return unique;
  }

  private slugifyRoleKey(name: string) {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!slug || !/^[a-z]/.test(slug)) {
      throw new BadRequestException("Role name must produce a valid key.");
    }

    return slug;
  }

  async createTenantRole(
    tenantId: string,
    dto: CreateTenantRoleDto,
    actorUserId?: string
  ) {
    const key = dto.key?.trim() || this.slugifyRoleKey(dto.name);
    const permissions = this.normalizePermissions(dto.permissions) ?? [];

    const [existing] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.key, key)));

    if (existing) {
      throw new ConflictException(`Role key "${key}" already exists.`);
    }

    const [role] = await this.db
      .insert(roles)
      .values({
        tenantId,
        key,
        name: dto.name.trim(),
        permissions
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "role.create",
      recordType: "Role",
      recordId: role!.id,
      after: { key, name: dto.name.trim(), permissions }
    });

    return this.getTenantRole(tenantId, role!.id);
  }

  async updateTenantRole(
    tenantId: string,
    roleId: string,
    dto: UpdateTenantRoleDto,
    actorUserId?: string
  ) {
    const [existing] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.id, roleId)));

    if (!existing) {
      throw new NotFoundException("Tenant role not found.");
    }

    const permissions = this.normalizePermissions(dto.permissions);
    const name = dto.name?.trim();

    if (!name && !permissions && !dto.status) {
      throw new BadRequestException("Provide a name, permissions, or status to update.");
    }

    if (dto.status === "inactive") {
      const roleWithUsers = await this.getTenantRole(tenantId, roleId);
      if (roleWithUsers.userCount > 0) {
        throw new BadRequestException(
          "Cannot disable a role that is assigned to users."
        );
      }
    }

    await this.db
      .update(roles)
      .set({
        ...(name ? { name } : {}),
        ...(permissions ? { permissions } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(roles.tenantId, tenantId), eq(roles.id, roleId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "role.update",
      recordType: "Role",
      recordId: roleId,
      before: {
        name: existing.name,
        permissions: existing.permissions,
        status: existing.status
      },
      after: {
        ...(name ? { name } : {}),
        ...(permissions ? { permissions } : {}),
        ...(dto.status ? { status: dto.status } : {})
      }
    });

    return this.getTenantRole(tenantId, roleId);
  }

  async findUserByContact(
    tenantId: string,
    contact: { email?: string; phone?: string }
  ) {
    let byEmail: typeof users.$inferSelect | undefined;
    let byPhone: typeof users.$inferSelect | undefined;

    if (contact.email) {
      [byEmail] = await this.db
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.email, contact.email)));
    }

    if (contact.phone) {
      [byPhone] = await this.db
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.phone, contact.phone)));
    }

    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      throw new ConflictException(
        "The email and phone number belong to different existing user accounts."
      );
    }

    return byEmail ?? byPhone ?? null;
  }

  private isUniqueViolation(error: unknown): boolean {
    const cause = error instanceof Error && "cause" in error ? error.cause : error;
    return (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      (cause as { code?: string }).code === "23505"
    );
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

    const existing = await this.findUserByContact(tenantId, {
      email: dto.email,
      phone: dto.phone
    });
    if (existing) {
      throw new ConflictException(
        "A user with this email or phone already exists. Edit the existing team member instead."
      );
    }

    let plainPassword: string | undefined;
    let passwordHash: string | undefined;

    if (dto.email) {
      plainPassword = this.passwordService.generateTemporaryPassword();
      passwordHash = await this.passwordService.hash(plainPassword);
    }

    let user: typeof users.$inferSelect | undefined;
    try {
      [user] = await this.db
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
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          "A user with this email or phone already exists. Edit the existing team member instead."
        );
      }
      throw error;
    }

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

      if (!dto.email && user.status === "invited") {
        const { token, expiresAt } = await this.authService.issueActivationToken(tenantId, user.id);
        return {
          ...user,
          credentialsSent: false,
          activationToken: token,
          activationExpiresAt: expiresAt
        };
      }
    }

    return {
      ...user,
      credentialsSent: Boolean(dto.email)
    };
  }

  async assignRoleByKey(
    tenantId: string,
    userId: string,
    roleKey: string,
    actorUserId?: string
  ) {
    const role = await this.assertAssignableRole(tenantId, roleKey);
    return this.assignRole(tenantId, { userId, roleId: role.id }, actorUserId);
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

    if (role.status !== "active") {
      throw new BadRequestException("This role is disabled.");
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
