import { config } from "dotenv";
import { rolePermissions, roles as roleKeys } from "@sms/shared";
import argon2 from "argon2";
import { and, eq, isNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  academicYears,
  grades,
  roles,
  sections,
  subjects,
  tenantSettings,
  tenants,
  userRoles,
  users
} from "./schema.js";

// Load env from the API folder first, then the repo root.
config();
config({ path: "../../.env" });

const demoTenants = [
  { name: "Demo Alpha Academy", slug: "demo-alpha" },
  { name: "Demo Beta International", slug: "demo-beta" }
] as const;

// Default password for seeded demo owners so they can sign in immediately.
// Intended for local development only.
const DEMO_OWNER_PASSWORD = "ChangeMe123!";
const PLATFORM_ADMIN_EMAIL = "platform-admin@example.edu.mm";

async function seedPlatformAdmin(db: ReturnType<typeof drizzle>, passwordHash: string) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNull(users.tenantId), eq(users.email, PLATFORM_ADMIN_EMAIL)));

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, status: "active", displayName: "Platform Super Admin" })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const [admin] = await db
    .insert(users)
    .values({
      tenantId: null,
      email: PLATFORM_ADMIN_EMAIL,
      displayName: "Platform Super Admin",
      status: "active",
      passwordHash
    })
    .returning({ id: users.id });

  return admin?.id;
}

async function seedTenant(
  db: ReturnType<typeof drizzle>,
  input: { name: string; slug: string },
  ownerPasswordHash: string
) {
  const [tenant] = await db
    .insert(tenants)
    .values({ name: input.name, slug: input.slug, status: "active" })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: input.name } })
    .returning();

  if (!tenant) {
    throw new Error(`Failed to seed tenant ${input.slug}`);
  }

  await db
    .insert(tenantSettings)
    .values({ tenantId: tenant.id, schoolName: input.name })
    .onConflictDoNothing();

  for (const roleKey of roleKeys) {
    await db
      .insert(roles)
      .values({ tenantId: tenant.id, key: roleKey, name: roleKey, permissions: rolePermissions[roleKey] })
      .onConflictDoUpdate({
        target: [roles.tenantId, roles.key],
        set: { permissions: rolePermissions[roleKey] }
      });
  }

  const ownerEmail = `owner@${input.slug}.example.edu.mm`;
  const [owner] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: ownerEmail,
      displayName: `${input.name} Owner`,
      status: "active",
      passwordHash: ownerPasswordHash
    })
    .onConflictDoUpdate({
      target: [users.tenantId, users.email],
      set: { status: "active", passwordHash: ownerPasswordHash }
    })
    .returning();

  const [ownerRole] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.tenantId, tenant.id), eq(roles.key, "school_owner")));

  if (owner && ownerRole) {
    await db
      .insert(userRoles)
      .values({ tenantId: tenant.id, userId: owner.id, roleId: ownerRole.id })
      .onConflictDoNothing();
  }

  // Academic master data has no natural unique key, so guard on existence to
  // keep the seed idempotent across repeated runs.
  const [existingYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenant.id), eq(academicYears.name, "2026-2027")));

  let academicYearId = existingYear?.id;

  if (!academicYearId) {
    const [academicYear] = await db
      .insert(academicYears)
      .values({
        tenantId: tenant.id,
        name: "2026-2027",
        startsOn: "2026-06-01",
        endsOn: "2027-03-31",
        status: "active"
      })
      .returning();
    academicYearId = academicYear?.id;

    await db.insert(grades).values({ tenantId: tenant.id, name: "Grade 1", sortOrder: 1 });
    await db.insert(sections).values({ tenantId: tenant.id, name: "A" });
    await db.insert(subjects).values({ tenantId: tenant.id, name: "Mathematics", code: "MATH" });
  }

  return { tenant, academicYearId };
}

async function verifyIsolation(db: ReturnType<typeof drizzle>, tenantId: string) {
  const leakedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), ne(users.tenantId, tenantId)));

  if (leakedUsers.length > 0) {
    throw new Error(`Tenant isolation check failed for ${tenantId}`);
  }
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://sms:sms@localhost:5432/sms"
  });
  const db = drizzle(pool);

  try {
    const ownerPasswordHash = await argon2.hash(DEMO_OWNER_PASSWORD, { type: argon2.argon2id });

    await seedPlatformAdmin(db, ownerPasswordHash);

    const results = [];
    for (const tenantInput of demoTenants) {
      const result = await seedTenant(db, tenantInput, ownerPasswordHash);
      await verifyIsolation(db, result.tenant.id);
      results.push(result);
    }

    const tenantIds = results.map((result) => result.tenant.id);
    if (new Set(tenantIds).size !== tenantIds.length) {
      throw new Error("Duplicate tenant ids detected during seed.");
    }

    console.log(
      "Seeded demo tenants:",
      results.map((result) => ({ id: result.tenant.id, slug: result.tenant.slug }))
    );
    console.log("\nDemo sign-in credentials (local development only):");
    console.log(
      `  • Platform console  ·  /platform/login  ·  email ${PLATFORM_ADMIN_EMAIL}  ·  password ${DEMO_OWNER_PASSWORD}`
    );
    for (const result of results) {
      console.log(
        `  • Tenant "${result.tenant.slug}"  ·  email owner@${result.tenant.slug}.example.edu.mm  ·  password ${DEMO_OWNER_PASSWORD}`
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
