import { ConflictException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service.js";
import {
  academicYears,
  auditLogs,
  discountRules,
  enrollmentFeePlanGrades,
  enrollmentFeePlans,
  enrollments,
  familyGroups,
  feeItems,
  grades,
  invoiceDiscountLines,
  invoiceItems,
  invoices,
  students,
  tenants,
  users
} from "../db/schema.js";
import { EnrollmentBillingService } from "./enrollment-billing.service.js";

/**
 * P1 integration tests (localhost-test-plan.md Part B §5): the unified
 * enrollment ceremony is the core product rule — fee preview with sibling
 * discount via family_group_id, then an atomic confirm that creates the
 * invoice and approves the enrollment in one step (no manual invoice path).
 * Requires a migrated PostgreSQL database; skipped unless DATABASE_URL is set.
 */
const databaseUrl = process.env.DATABASE_URL;

const ADMISSION_FEE = 200_000;
const SIBLING_PERCENT = 10;

describe.skipIf(!databaseUrl)("Enrollment ceremony (P1)", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const service = new EnrollmentBillingService(db as never, new AuditService(db as never));

  const year = new Date().getFullYear();
  let tenantId: string;
  let academicYearId: string;
  let gradeId: string;
  let newStudentId: string;
  let newEnrollmentId: string;
  let actor: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Ceremony Spec School", slug: `ceremony-spec-${Date.now()}` })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;

    const [registrar] = await db
      .insert(users)
      .values({
        tenantId,
        displayName: "Spec Registrar",
        email: `registrar-${Date.now()}@ceremony-spec.example.edu.mm`,
        status: "active"
      })
      .returning({ id: users.id });
    actor = registrar!.id;

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
      .values({ tenantId, name: "Ceremony Grade" })
      .returning({ id: grades.id });
    gradeId = grade!.id;

    // Fee plan: one admission fee for this grade.
    const [registration] = await db
      .insert(feeItems)
      .values({ tenantId, name: "Registration fee", feeType: "registration", billingType: "one_time" })
      .returning({ id: feeItems.id });
    const [plan] = await db
      .insert(enrollmentFeePlans)
      .values({ tenantId, academicYearId, feeItemId: registration!.id, amount: String(ADMISSION_FEE) })
      .returning({ id: enrollmentFeePlans.id });
    await db.insert(enrollmentFeePlanGrades).values({ tenantId, planId: plan!.id, gradeId });

    // Family with one already-enrolled sibling.
    const [family] = await db
      .insert(familyGroups)
      .values({ tenantId, name: "Ceremony Family" })
      .returning({ id: familyGroups.id });

    const [sibling] = await db
      .insert(students)
      .values({
        tenantId,
        fullName: "Ma Elder Sibling",
        admissionNumber: `SPEC-CER-${Date.now()}-1`,
        status: "enrolled",
        familyGroupId: family!.id
      })
      .returning({ id: students.id });
    await db.insert(enrollments).values({
      tenantId,
      studentId: sibling!.id,
      academicYearId,
      gradeId,
      status: "approved",
      confirmedAt: new Date()
    });

    const [newStudent] = await db
      .insert(students)
      .values({
        tenantId,
        fullName: "Mg Younger Sibling",
        admissionNumber: `SPEC-CER-${Date.now()}-2`,
        status: "draft",
        familyGroupId: family!.id
      })
      .returning({ id: students.id });
    newStudentId = newStudent!.id;

    const [pending] = await db
      .insert(enrollments)
      .values({
        tenantId,
        studentId: newStudentId,
        academicYearId,
        gradeId,
        status: "submitted"
      })
      .returning({ id: enrollments.id });
    newEnrollmentId = pending!.id;

    // Auto sibling discount: 10% for the 2nd+ enrolled child of a family.
    await db.insert(discountRules).values({
      tenantId,
      name: "Sibling 10%",
      discountType: "sibling",
      valueType: "percentage",
      value: String(SIBLING_PERCENT),
      triggerMode: "auto",
      criteria: {
        type: "sibling",
        appliesTo: { billingContexts: ["enrollment"], feeTypes: [] },
        minEnrolledSiblings: 1
      }
    });
  });

  afterAll(async () => {
    await db.delete(invoiceDiscountLines).where(eq(invoiceDiscountLines.tenantId, tenantId));
    await db.delete(invoiceItems).where(eq(invoiceItems.tenantId, tenantId));
    // enrollments.invoice_id ↔ invoices.enrollment_id are mutually referencing;
    // break the cycle before deleting either side.
    await db
      .update(enrollments)
      .set({ invoiceId: null })
      .where(eq(enrollments.tenantId, tenantId));
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(enrollments).where(eq(enrollments.tenantId, tenantId));
    await db.delete(discountRules).where(eq(discountRules.tenantId, tenantId));
    await db.delete(enrollmentFeePlanGrades).where(eq(enrollmentFeePlanGrades.tenantId, tenantId));
    await db.delete(enrollmentFeePlans).where(eq(enrollmentFeePlans.tenantId, tenantId));
    await db.delete(feeItems).where(eq(feeItems.tenantId, tenantId));
    await db.delete(students).where(eq(students.tenantId, tenantId));
    await db.delete(familyGroups).where(eq(familyGroups.tenantId, tenantId));
    await db.delete(grades).where(eq(grades.tenantId, tenantId));
    await db.delete(academicYears).where(eq(academicYears.tenantId, tenantId));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await pool.end();
  });

  it("preview applies the sibling discount from the family group", async () => {
    const preview = await service.preview(tenantId, {
      studentId: newStudentId,
      academicYearId,
      gradeId,
      optionalFeeItemIds: []
    });

    expect(preview.subtotal).toBe(ADMISSION_FEE);
    expect(preview.siblingSummary.eligible).toBe(true);
    expect(preview.discountTotal).toBe((ADMISSION_FEE * SIBLING_PERCENT) / 100);
    expect(preview.total).toBe(ADMISSION_FEE - preview.discountTotal);
    expect(preview.discounts.some((d) => d.name === "Sibling 10%")).toBe(true);
  });

  it("confirm atomically creates the invoice and approves the enrollment", async () => {
    const result = await service.confirm(
      tenantId,
      newEnrollmentId,
      actor,
      { collectPayment: false },
      ["student.manage", "finance.manage", "discount.approve"]
    );

    expect(result.invoiceId).toBeTruthy();
    expect(result.invoiceNumber).toBeTruthy();

    const [enrollmentRow] = await db
      .select({
        status: enrollments.status,
        invoiceId: enrollments.invoiceId,
        confirmedAt: enrollments.confirmedAt
      })
      .from(enrollments)
      .where(eq(enrollments.id, newEnrollmentId));
    expect(enrollmentRow!.status).toBe("approved");
    expect(enrollmentRow!.invoiceId).toBe(result.invoiceId);
    expect(enrollmentRow!.confirmedAt).not.toBeNull();

    const [invoiceRow] = await db
      .select({ total: invoices.total, source: invoices.source, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, result.invoiceId)));
    expect(invoiceRow!.source).toBe("enrollment");
    expect(Number(invoiceRow!.total)).toBe(ADMISSION_FEE - (ADMISSION_FEE * SIBLING_PERCENT) / 100);
  });

  it("confirming the same enrollment twice is rejected", async () => {
    await expect(
      service.confirm(
        tenantId,
        newEnrollmentId,
        actor,
        { collectPayment: false },
        ["student.manage", "finance.manage", "discount.approve"]
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
