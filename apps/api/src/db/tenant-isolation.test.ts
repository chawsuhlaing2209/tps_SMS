import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { featureFlags, tenantSettings, tenants, users } from "./schema.js";

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

  // ---------------------------------------------------------------------
  // RLS backstop (DEPLOYMENT.md I4): the same checks at the DATABASE level,
  // connected as the least-privilege app role (sms_app, migration 0037).
  // These queries deliberately OMIT the tenant_id where-clause — Postgres
  // itself must do the filtering.
  // ---------------------------------------------------------------------
  describe("RLS backstop (app role)", () => {
    const appRoleUrl =
      process.env.RLS_TEST_DATABASE_URL ??
      databaseUrl!.replace(/\/\/[^@]+@/, "//sms_app:sms_app@");
    const appPool = new Pool({ connectionString: appRoleUrl, max: 2 });

    beforeAll(async () => {
      // One flag row per tenant, written as the owner (bypasses RLS).
      for (const tenantId of createdTenantIds) {
        await db
          .insert(featureFlags)
          .values({ tenantId, key: `rls-probe-${suffix}`, enabled: true })
          .onConflictDoNothing();
      }
    });

    afterAll(async () => {
      await db
        .delete(featureFlags)
        .where(inArray(featureFlags.tenantId, createdTenantIds));
      await appPool.end();
    });

    it("returns zero rows without a tenant context", async () => {
      const client = await appPool.connect();
      try {
        const { rows } = await client.query(
          "SELECT count(*)::int AS count FROM feature_flags WHERE key = $1",
          [`rls-probe-${suffix}`]
        );
        expect(rows[0]!.count).toBe(0);
      } finally {
        client.release();
      }
    });

    it("filters an UNSCOPED query to the current tenant only", async () => {
      const [tenantA, tenantB] = [createdTenantIds[0]!, createdTenantIds[1]!];
      const client = await appPool.connect();
      try {
        await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
        const { rows } = await client.query(
          "SELECT tenant_id FROM feature_flags WHERE key = $1",
          [`rls-probe-${suffix}`]
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]!.tenant_id).toBe(tenantA);
        expect(rows.some((row) => row.tenant_id === tenantB)).toBe(false);
      } finally {
        client.release();
      }
    });

    it("blocks writing a row for another tenant", async () => {
      const [tenantA, tenantB] = [createdTenantIds[0]!, createdTenantIds[1]!];
      const client = await appPool.connect();
      try {
        await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantA]);
        await expect(
          client.query(
            "INSERT INTO feature_flags (tenant_id, key, enabled) VALUES ($1, $2, true)",
            [tenantB, `rls-smuggle-${suffix}`]
          )
        ).rejects.toThrow(/row-level security/i);
      } finally {
        client.release();
      }
    });

    it("sees all tenants only with the platform bypass", async () => {
      const client = await appPool.connect();
      try {
        await client.query("SELECT set_config('app.bypass_rls', 'on', false)");
        const { rows } = await client.query(
          "SELECT count(*)::int AS count FROM feature_flags WHERE key = $1",
          [`rls-probe-${suffix}`]
        );
        expect(rows[0]!.count).toBe(2);
      } finally {
        client.release();
      }
    });
  });
});
