import { BadRequestException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service.js";
import { auditLogs, tenantSettings, tenants } from "../db/schema.js";
import type { S3StorageService } from "../storage/s3-storage.service.js";
import { SchoolProfileService } from "./school-profile.service.js";

/**
 * P1 integration tests (localhost-test-plan.md Part B §6): the school profile
 * feeds every customer-facing document (invoices, receipts, payslips) and the
 * sidebar brand — round-trips, logo validation, and preference writes across
 * both the tenants and tenant_settings tables must hold.
 * Requires a migrated PostgreSQL database; skipped unless DATABASE_URL is set.
 */
const databaseUrl = process.env.DATABASE_URL;

/** In-memory stand-in for MinIO/S3 — records puts, serves them back. */
function makeStorageStub() {
  const objects = new Map<string, Buffer>();
  return {
    calls: objects,
    stub: {
      putObject: async (key: string, body: Buffer) => {
        objects.set(key, body);
      },
      getObject: async (key: string) => {
        const found = objects.get(key);
        if (!found) throw new Error("missing object");
        return found;
      },
      getObjectIfExists: async (key: string) => objects.get(key) ?? null
    } as unknown as S3StorageService
  };
}

describe.skipIf(!databaseUrl)("SchoolProfileService (P1)", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const storage = makeStorageStub();
  const service = new SchoolProfileService(
    db as never,
    storage.stub,
    new AuditService(db as never)
  );

  let tenantId: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Profile Spec School", slug: `profile-spec-${Date.now()}` })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;
    await db.insert(tenantSettings).values({ tenantId, schoolName: "Profile Spec School" });
  });

  afterAll(async () => {
    await db.delete(tenantSettings).where(eq(tenantSettings.tenantId, tenantId));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await pool.end();
  });

  it("updates and reads back the full profile, recording an audit event", async () => {
    const updated = await service.updateProfile(tenantId, undefined, {
      schoolName: "Aung Myint Myat Private School",
      schoolType: "private",
      motto: "Good Learners",
      address: "No. 12, Pyay Road, Yangon",
      contactEmail: "office@amm.example.edu.mm",
      contactPhone: "+95 9 771 000 000",
      principalName: "U Tint Lwin",
      registrationNumber: "MOE-2014-118",
      establishedYear: 2014
    });

    expect(updated).toMatchObject({
      schoolName: "Aung Myint Myat Private School",
      schoolType: "private",
      motto: "Good Learners",
      principalName: "U Tint Lwin",
      establishedYear: 2014
    });

    const events = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(
        and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.action, "tenant.school_profile.update"))
      );
    expect(events.length).toBeGreaterThan(0);
  });

  it("clearing optional fields persists nulls", async () => {
    const updated = await service.updateProfile(tenantId, undefined, {
      schoolName: "Aung Myint Myat Private School",
      motto: null,
      principalName: null
    });
    expect(updated.motto).toBeNull();
    expect(updated.principalName).toBeNull();
  });

  it("rejects oversized and non-image logos", async () => {
    const png = { originalname: "logo.png", mimetype: "image/png", size: 1024, buffer: Buffer.alloc(1024, 1) };

    await expect(
      service.uploadLogo(tenantId, undefined, { ...png, size: 3 * 1024 * 1024 })
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.uploadLogo(tenantId, undefined, { ...png, mimetype: "application/pdf" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("uploads a logo, cache-busts on re-upload, and delete clears it", async () => {
    const png = { originalname: "logo.png", mimetype: "image/png", size: 1024, buffer: Buffer.alloc(1024, 1) };

    const first = await service.uploadLogo(tenantId, undefined, png);
    expect(first.logoFileId).toBeTruthy();

    const second = await service.uploadLogo(tenantId, undefined, png);
    expect(second.logoFileId).not.toBe(first.logoFileId); // new id busts caches

    const streamed = await service.getLogo(tenantId);
    expect(streamed).toBeDefined();

    await service.deleteLogo(tenantId, undefined);
    const profile = await service.getProfile(tenantId);
    expect(profile.logoFileId).toBeNull();
    await expect(service.getLogo(tenantId)).rejects.toBeDefined();
  });

  it("updates preferences across both the tenants and tenant_settings tables", async () => {
    const preferences = await service.updatePreferences(tenantId, undefined, {
      defaultLanguage: "my",
      currency: "usd", // stored uppercased
      timezone: "Asia/Bangkok",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h"
    });

    expect(preferences).toMatchObject({
      defaultLanguage: "my",
      currency: "USD",
      timezone: "Asia/Bangkok",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h"
    });

    const [tenantRow] = await db
      .select({ currency: tenants.currency, timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    expect(tenantRow).toEqual({ currency: "USD", timezone: "Asia/Bangkok" });

    const [settingsRow] = await db
      .select({ dateFormat: tenantSettings.dateFormat, timeFormat: tenantSettings.timeFormat })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));
    expect(settingsRow).toEqual({ dateFormat: "YYYY-MM-DD", timeFormat: "24h" });
  });
});
