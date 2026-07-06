import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  academicYears,
  auditLogs,
  enrollmentFeePlanGrades,
  enrollmentFeePlans,
  enrollments,
  feeItems,
  grades,
  invoiceDiscountLines,
  invoiceItems,
  invoices,
  studentServices,
  students,
  tenants
} from "../db/schema.js";
import { ensureRecurringInvoiceForStudent } from "./recurring-billing.logic.js";

/**
 * P1 integration tests (localhost-test-plan.md Part B §7): recurring billing
 * must never double-invoice a student for the same month — the duplicate
 * guard is what makes the one-click Collect flow safe to call repeatedly.
 * Requires a migrated PostgreSQL database; skipped unless DATABASE_URL is set.
 */
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("ensureRecurringInvoiceForStudent (P1)", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const year = new Date().getFullYear();
  const billingMonth = `${year}-06`;
  const MONTHLY_FEE = 50_000;

  let tenantId: string;
  let studentId: string;
  let academicYearId: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Recurring Spec School", slug: `recurring-spec-${Date.now()}` })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;

    const [academicYear] = await db
      .insert(academicYears)
      .values({
        tenantId,
        name: `${year}-${year + 1}`,
        startsOn: `${year}-01-01`,
        endsOn: `${year}-12-31`
      })
      .returning({ id: academicYears.id });
    academicYearId = academicYear!.id;

    const [grade] = await db
      .insert(grades)
      .values({ tenantId, name: "Recurring Grade" })
      .returning({ id: grades.id });

    const [student] = await db
      .insert(students)
      .values({
        tenantId,
        fullName: "Ma Monthly Fee",
        admissionNumber: `SPEC-REC-${Date.now()}`,
        status: "enrolled"
      })
      .returning({ id: students.id });
    studentId = student!.id;

    await db.insert(enrollments).values({
      tenantId,
      studentId,
      academicYearId,
      gradeId: grade!.id,
      status: "approved",
      confirmedAt: new Date()
    });

    const [tuition] = await db
      .insert(feeItems)
      .values({ tenantId, name: "Monthly tuition", feeType: "tuition", billingType: "monthly" })
      .returning({ id: feeItems.id });

    const [plan] = await db
      .insert(enrollmentFeePlans)
      .values({ tenantId, academicYearId, feeItemId: tuition!.id, amount: String(MONTHLY_FEE) })
      .returning({ id: enrollmentFeePlans.id });
    await db.insert(enrollmentFeePlanGrades).values({
      tenantId,
      planId: plan!.id,
      gradeId: grade!.id
    });

    await db.insert(studentServices).values({
      tenantId,
      studentId,
      feeItemId: tuition!.id,
      effectiveFrom: `${year}-01-01`
    });
  });

  afterAll(async () => {
    await db.delete(invoiceDiscountLines).where(eq(invoiceDiscountLines.tenantId, tenantId));
    await db.delete(invoiceItems).where(eq(invoiceItems.tenantId, tenantId));
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(studentServices).where(eq(studentServices.tenantId, tenantId));
    await db.delete(enrollmentFeePlanGrades).where(eq(enrollmentFeePlanGrades.tenantId, tenantId));
    await db.delete(enrollmentFeePlans).where(eq(enrollmentFeePlans.tenantId, tenantId));
    await db.delete(feeItems).where(eq(feeItems.tenantId, tenantId));
    await db.delete(enrollments).where(eq(enrollments.tenantId, tenantId));
    await db.delete(students).where(eq(students.tenantId, tenantId));
    await db.delete(grades).where(eq(grades.tenantId, tenantId));
    await db.delete(academicYears).where(eq(academicYears.tenantId, tenantId));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await pool.end();
  });

  it("creates the month's recurring invoice once, then guards against duplicates", async () => {
    const firstId = await ensureRecurringInvoiceForStudent(db as never, {
      tenantId,
      studentId,
      academicYearId,
      billingMonth,
      actorUserId: null
    });
    expect(firstId).toBeTruthy();

    // Second call must NOT create another invoice — it returns the existing
    // one so the caller can collect against it.
    const secondId = await ensureRecurringInvoiceForStudent(db as never, {
      tenantId,
      studentId,
      academicYearId,
      billingMonth,
      actorUserId: null
    });
    expect(secondId).toBe(firstId);

    const rows = await db
      .select({ id: invoices.id, total: invoices.total, source: invoices.source })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId)));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe("recurring");
    expect(Number(rows[0]!.total)).toBe(MONTHLY_FEE);
  });

  it("a different month is billable again", async () => {
    const nextMonthId = await ensureRecurringInvoiceForStudent(db as never, {
      tenantId,
      studentId,
      academicYearId,
      billingMonth: `${year}-07`,
      actorUserId: null
    });
    expect(nextMonthId).toBeTruthy();

    const rows = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId)));
    expect(rows).toHaveLength(2);
  });
});
