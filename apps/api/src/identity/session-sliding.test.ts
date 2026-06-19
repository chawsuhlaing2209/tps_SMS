import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Database } from "../db/db.module.js";
import { sessions, tenants, users } from "../db/schema.js";
import { PasswordService } from "./password.service.js";
import { RequestContextService } from "./request-context.service.js";
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS } from "./session-cookie.js";
import { TenantContextCache } from "./tenant-context.cache.js";

// Integration test: exercises the sliding idle timeout and absolute lifetime in
// actorFromSessionToken against a real database. Skipped without DATABASE_URL.
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("session sliding timeout", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const passwordService = new PasswordService();
  const service = new RequestContextService(
    db as unknown as Database,
    passwordService,
    new TenantContextCache()
  );

  const suffix = `slide-${Date.now()}`;
  let tenantId: string;
  let userId: string;
  const sessionIds: string[] = [];

  async function createSession(input: {
    token: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<string> {
    const [session] = await db
      .insert(sessions)
      .values({
        tenantId,
        userId,
        tokenHash: passwordService.hashToken(input.token),
        expiresAt: input.expiresAt,
        createdAt: input.createdAt
      })
      .returning({ id: sessions.id });

    if (!session) {
      throw new Error("Failed to insert session");
    }

    sessionIds.push(session.id);
    return session.id;
  }

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Sliding Test", slug: `${suffix}-tenant`, status: "active" })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;

    const [user] = await db
      .insert(users)
      .values({
        tenantId,
        email: `owner@${suffix}.example.edu.mm`,
        displayName: "Sliding Owner",
        status: "active"
      })
      .returning({ id: users.id });
    userId = user!.id;
  });

  afterAll(async () => {
    if (sessionIds.length > 0) {
      await db.delete(sessions).where(inArray(sessions.id, sessionIds));
    }
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await pool.end();
  });

  it("slides the idle deadline forward on use", async () => {
    const now = Date.now();
    const originalExpiry = new Date(now + 1000 * 60 * 60); // 1h out
    const id = await createSession({
      token: "slide-active",
      expiresAt: originalExpiry,
      createdAt: new Date(now)
    });

    const actor = await service.actorFromSessionToken("slide-active");
    expect(actor).toBe(userId);

    const [refreshed] = await db
      .select({ expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, id));

    // Idle deadline should have moved out toward now + idle TTL.
    expect(refreshed!.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
  });

  it("rejects an idle-expired session", async () => {
    const now = Date.now();
    await createSession({
      token: "slide-idle-expired",
      expiresAt: new Date(now - 1000),
      createdAt: new Date(now - 1000 * 60 * 60)
    });

    const actor = await service.actorFromSessionToken("slide-idle-expired");
    expect(actor).toBeUndefined();
  });

  it("rejects a session past its absolute lifetime even if recently active", async () => {
    const now = Date.now();
    await createSession({
      token: "slide-absolute-expired",
      // Idle deadline is still in the future...
      expiresAt: new Date(now + 1000 * 60 * 60),
      // ...but the session was created beyond the absolute lifetime.
      createdAt: new Date(now - SESSION_ABSOLUTE_TTL_MS - 1000 * 60)
    });

    const actor = await service.actorFromSessionToken("slide-absolute-expired");
    expect(actor).toBeUndefined();
  });

  it("does not exceed the absolute lifetime when sliding", async () => {
    const now = Date.now();
    // Created 29.9 days ago: less than an idle window remains before the cap.
    const createdAt = new Date(now - (SESSION_ABSOLUTE_TTL_MS - 1000 * 60 * 60));
    const id = await createSession({
      token: "slide-near-cap",
      expiresAt: new Date(now + 1000 * 60),
      createdAt
    });

    const actor = await service.actorFromSessionToken("slide-near-cap");
    expect(actor).toBe(userId);

    const [refreshed] = await db
      .select({ expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, id));

    const absoluteDeadline = createdAt.getTime() + SESSION_ABSOLUTE_TTL_MS;
    expect(refreshed!.expiresAt.getTime()).toBeLessThanOrEqual(absoluteDeadline);
    expect(refreshed!.expiresAt.getTime()).toBeLessThan(now + SESSION_IDLE_TTL_MS);
  });
});
