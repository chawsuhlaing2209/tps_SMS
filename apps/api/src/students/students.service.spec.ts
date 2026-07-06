import { BadRequestException, ConflictException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service.js";
import { auditLogs, invoices, students, tenants } from "../db/schema.js";
import { StudentsService } from "./students.service.js";

/**
 * P0 integration tests (localhost-test-plan.md Part B §4): the student archive
 * lifecycle guards irreversible actions — permanent deletion must be two-step
 * (archive first) and impossible while financial/academic history exists.
 * Requires a migrated PostgreSQL database; skipped unless DATABASE_URL is set.
 */
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("StudentsService lifecycle (P0)", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const service = new StudentsService(db as never, new AuditService(db as never));

  let tenantId: string;
  let billedStudentId: string;
  let cleanStudentId: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Students Spec School", slug: `students-spec-${Date.now()}` })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;

    const [billed] = await db
      .insert(students)
      .values({ tenantId, fullName: "Mg Has Invoice", admissionNumber: `SPEC-${Date.now()}-1`, status: "enrolled" })
      .returning({ id: students.id });
    billedStudentId = billed!.id;

    const [clean] = await db
      .insert(students)
      .values({ tenantId, fullName: "Ma No History", admissionNumber: `SPEC-${Date.now()}-2`, status: "draft" })
      .returning({ id: students.id });
    cleanStudentId = clean!.id;

    await db.insert(invoices).values({
      tenantId,
      studentId: billedStudentId,
      invoiceNumber: `INV-SPEC-${Date.now()}`,
      issueDate: new Date().toISOString().slice(0, 10),
      subtotal: "100000",
      total: "100000"
    });
  });

  afterAll(async () => {
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(students).where(eq(students.tenantId, tenantId));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await pool.end();
  });

  it("archive stamps archivedAt and restore clears it, preserving status", async () => {
    const archived = await service.archive(tenantId, billedStudentId);
    expect(archived.archivedAt).not.toBeNull();
    expect(archived.status).toBe("enrolled");

    const restored = await service.restore(tenantId, billedStudentId);
    expect(restored.archivedAt).toBeNull();
    expect(restored.status).toBe("enrolled");
  });

  it("permanent delete requires the student to be archived first", async () => {
    await expect(service.permanentlyDelete(tenantId, cleanStudentId)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("permanent delete is blocked while financial history exists (409 with dependency counts)", async () => {
    await service.archive(tenantId, billedStudentId);

    const error = await service
      .permanentlyDelete(tenantId, billedStudentId)
      .then(() => null)
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ConflictException);
    const payload = (error as ConflictException).getResponse() as {
      dependencies?: Record<string, number>;
    };
    expect(payload.dependencies?.invoices).toBe(1);

    // Still present.
    const [row] = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, billedStudentId));
    expect(row).toBeDefined();
  });

  it("permanent delete succeeds for an archived student without history", async () => {
    await service.archive(tenantId, cleanStudentId);
    const result = await service.permanentlyDelete(tenantId, cleanStudentId);
    expect(result).toEqual({ id: cleanStudentId, deleted: true });

    const rows = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, cleanStudentId));
    expect(rows).toHaveLength(0);
  });
});
