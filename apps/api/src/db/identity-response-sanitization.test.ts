import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { AuditService } from "../audit/audit.service.js";
import type { NotificationsService } from "../notifications/notifications.service.js";
import type { AuthService } from "../identity/auth.service.js";
import type { TenantContextCache } from "../identity/tenant-context.cache.js";
import { IdentityService } from "../identity/identity.service.js";
import { PasswordService } from "../identity/password.service.js";
import { roles, sessions, tenants, userRoles, users } from "./schema.js";

// Integration test: proves identity endpoints never return credential material
// (passwordHash, session tokenHash) in their response payloads. Requires a
// migrated PostgreSQL database, so it is skipped unless DATABASE_URL is set.
const databaseUrl = process.env.DATABASE_URL;

/** Recursively collects every object key present anywhere in a payload. */
function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
  } else if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

function expectNoCredentialKeys(payload: unknown) {
  const keys = collectKeys(payload);
  expect(keys.has("passwordHash")).toBe(false);
  expect(keys.has("tokenHash")).toBe(false);
}

describe.skipIf(!databaseUrl)("identity response sanitization", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const passwordService = new PasswordService();

  const auditStub = { recordEvent: async () => undefined } as unknown as AuditService;
  const notificationsStub = {
    sendOwnerWelcomeEmail: async () => undefined
  } as unknown as NotificationsService;
  const authStub = {
    issueActivationToken: async () => ({
      token: "test-activation-token",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60)
    })
  } as unknown as AuthService;
  const cacheStub = {
    invalidateTenant: () => undefined,
    invalidateUser: () => undefined
  } as unknown as TenantContextCache;

  const identityService = new IdentityService(
    db as never,
    auditStub,
    passwordService,
    notificationsStub,
    authStub,
    cacheStub
  );

  const suffix = `sanitize-${Date.now()}`;
  let tenantId: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Sanitize Test School", slug: suffix, status: "active" })
      .returning({ id: tenants.id });

    if (!tenant) {
      throw new Error("Failed to insert test tenant");
    }
    tenantId = tenant.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await db.delete(sessions).where(eq(sessions.tenantId, tenantId));
      await db.delete(userRoles).where(eq(userRoles.tenantId, tenantId));
      const tenantUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.tenantId, tenantId));
      if (tenantUsers.length > 0) {
        await db.delete(users).where(
          inArray(users.id, tenantUsers.map((user) => user.id))
        );
      }
      await db.delete(roles).where(eq(roles.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
    await pool.end();
  });

  it("inviteUser (email) stores a password hash but never returns it", async () => {
    const invited = await identityService.inviteUser(tenantId, {
      email: `invitee@${suffix}.example.edu.mm`,
      displayName: "Invited Teacher"
    });

    expectNoCredentialKeys(invited);
    expect(invited.id).toBeTruthy();
    expect(invited.credentialsSent).toBe(true);

    // The hash must exist in the database — proving the response stripped a
    // real value rather than the column simply being empty.
    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, invited.id!));
    expect(row?.passwordHash).toBeTruthy();
  });

  it("inviteUser (phone only) returns an activation token but no credential hashes", async () => {
    const invited = await identityService.inviteUser(tenantId, {
      phone: "+959111222333",
      displayName: "Phone Invitee"
    });

    expectNoCredentialKeys(invited);
    expect(invited.status).toBe("invited");
  });

  it("listTenantUsers never includes passwordHash", async () => {
    const rows = await identityService.listTenantUsers(tenantId);

    expect(rows.length).toBeGreaterThan(0);
    expectNoCredentialKeys(rows);
  });

  it("provisionSchoolOwner returns only the safe owner summary", async () => {
    const provisioned = await identityService.provisionSchoolOwner(tenantId, {
      displayName: "Owner",
      email: `owner@${suffix}.example.edu.mm`,
      schoolName: "Sanitize Test School",
      tenantSlug: suffix
    });

    expectNoCredentialKeys(provisioned);
    expect(Object.keys(provisioned).sort()).toEqual([
      "credentialsSent",
      "email",
      "userId"
    ]);
  });

  it("createSession never returns the session tokenHash", async () => {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .limit(1);

    const session = await identityService.createSession(tenantId, {
      userId: user!.id,
      tokenHash: passwordService.hashToken("regression-test-token"),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString()
    });

    expectNoCredentialKeys(session);
    expect(session?.id).toBeTruthy();
  });
});
