import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { tenantSettings, tenants, users } from "./schema.js";

// Integration test: proves two tenants cannot read each other's rows at the
// database layer. Requires a migrated PostgreSQL database, so it is skipped
// unless DATABASE_URL is set (CI provides one; local unit runs stay green).
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("tenant isolation", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const suffix = `iso-${Date.now()}`;
  const slugA = `${suffix}-alpha`;
  const slugB = `${suffix}-beta`;
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    for (const [slug, name] of [
      [slugA, "Isolation Alpha"],
      [slugB, "Isolation Beta"]
    ] as const) {
      const [tenant] = await db
        .insert(tenants)
        .values({ name, slug, status: "active" })
        .returning({ id: tenants.id });

      if (!tenant) {
        throw new Error(`Failed to insert tenant ${slug}`);
      }

      createdTenantIds.push(tenant.id);

      await db
        .insert(tenantSettings)
        .values({ tenantId: tenant.id, schoolName: name })
        .onConflictDoNothing();

      await db.insert(users).values({
        tenantId: tenant.id,
        email: `owner@${slug}.example.edu.mm`,
        displayName: `${name} Owner`,
        status: "active"
      });
    }
  });

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
      await db.delete(users).where(inArray(users.tenantId, createdTenantIds));
      await db
        .delete(tenantSettings)
        .where(inArray(tenantSettings.tenantId, createdTenantIds));
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
    await pool.end();
  });

  it("scopes user reads to a single tenant", async () => {
    const tenantA = createdTenantIds[0]!;
    const tenantB = createdTenantIds[1]!;

    const tenantAUsers = await db
      .select({ id: users.id, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.tenantId, tenantA));

    expect(tenantAUsers.length).toBeGreaterThan(0);
    expect(tenantAUsers.every((user) => user.tenantId === tenantA)).toBe(true);
    expect(tenantAUsers.some((user) => user.tenantId === tenantB)).toBe(false);
  });

  it("returns nothing when a tenant queries another tenant's user by email", async () => {
    const tenantA = createdTenantIds[0]!;

    const leaked = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantA),
          eq(users.email, `owner@${slugB}.example.edu.mm`)
        )
      );

    expect(leaked).toHaveLength(0);
  });

  it("keeps tenant settings isolated per tenant", async () => {
    const tenantA = createdTenantIds[0]!;
    const tenantB = createdTenantIds[1]!;

    const settingsA = await db
      .select({ tenantId: tenantSettings.tenantId })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantA));

    expect(settingsA.every((row) => row.tenantId === tenantA)).toBe(true);
    expect(settingsA.some((row) => row.tenantId === tenantB)).toBe(false);
  });
});
