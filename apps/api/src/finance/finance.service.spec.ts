import { BadRequestException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service.js";
import {
  academicYears,
  auditLogs,
  enrollments,
  grades,
  invoices,
  payments,
  receipts,
  students,
  tenantSettings,
  tenants,
  users
} from "../db/schema.js";
import { FinanceService } from "./finance.service.js";

/**
 * P0 integration tests (localhost-test-plan.md Part B §1): payment collection
 * is the highest-risk code in the platform. Covered rules:
 * - payments apply to the oldest open invoice first; partial leaves balance
 * - overpayment beyond the recordable balance is rejected
 * - non-cash requires a transaction reference and awaits verification;
 *   pending amounts block double-collection
 * - receipts are issued with distinct numbers
 * - refunds create a cash-out line and never reopen a paid invoice
 * Requires a migrated PostgreSQL database; skipped unless DATABASE_URL is set.
 */
const databaseUrl = process.env.DATABASE_URL;

const stub = <T>() => ({}) as T;

describe.skipIf(!databaseUrl)("FinanceService collectPayment/refund (P0)", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const service = new FinanceService(
    db as never,
    new AuditService(db as never),
    stub(),
    stub(),
    stub()
  );

  const year = new Date().getFullYear();
  let actor: string;
  let tenantId: string;
  let studentId: string;
  let invoiceAId: string;
  let invoiceBId: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Finance Spec School", slug: `finance-spec-${Date.now()}` })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;

    await db.insert(tenantSettings).values({ tenantId, schoolName: "Finance Spec School" });

    // payments.verified_by_user_id and audit_logs.actor_user_id are FKs to
    // users — the acting cashier must be a real row.
    const [cashier] = await db
      .insert(users)
      .values({
        tenantId,
        displayName: "Spec Cashier",
        email: `cashier-${Date.now()}@finance-spec.example.edu.mm`,
        status: "active"
      })
      .returning({ id: users.id });
    actor = cashier!.id;

    const [academicYear] = await db
      .insert(academicYears)
      .values({
        tenantId,
        name: `${year}-${year + 1}`,
        startsOn: `${year}-01-01`,
        endsOn: `${year}-12-31`
      })
      .returning({ id: academicYears.id });

    const [grade] = await db
      .insert(grades)
      .values({ tenantId, name: "Grade Spec" })
      .returning({ id: grades.id });

    const [student] = await db
      .insert(students)
      .values({ tenantId, fullName: "Mg Pays Fees", admissionNumber: `SPEC-${Date.now()}-3`, status: "enrolled" })
      .returning({ id: students.id });
    studentId = student!.id;

    await db.insert(enrollments).values({
      tenantId,
      studentId,
      academicYearId: academicYear!.id,
      gradeId: grade!.id,
      status: "approved",
      confirmedAt: new Date()
    });

    // Invoice A is older, so collections apply to it first.
    const [invoiceA] = await db
      .insert(invoices)
      .values({
        tenantId,
        studentId,
        invoiceNumber: `INV-SPEC-A-${Date.now()}`,
        issueDate: `${year}-02-01`,
        subtotal: "100000",
        total: "100000"
      })
      .returning({ id: invoices.id });
    invoiceAId = invoiceA!.id;

    const [invoiceB] = await db
      .insert(invoices)
      .values({
        tenantId,
        studentId,
        invoiceNumber: `INV-SPEC-B-${Date.now()}`,
        issueDate: `${year}-03-01`,
        subtotal: "50000",
        total: "50000"
      })
      .returning({ id: invoices.id });
    invoiceBId = invoiceB!.id;
  });

  afterAll(async () => {
    await db.delete(receipts).where(eq(receipts.tenantId, tenantId));
    await db.delete(payments).where(eq(payments.tenantId, tenantId));
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(enrollments).where(eq(enrollments.tenantId, tenantId));
    await db.delete(students).where(eq(students.tenantId, tenantId));
    await db.delete(grades).where(eq(grades.tenantId, tenantId));
    await db.delete(academicYears).where(eq(academicYears.tenantId, tenantId));
    await db.delete(tenantSettings).where(eq(tenantSettings.tenantId, tenantId));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(users).where(eq(users.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await pool.end();
  });

  const invoiceStatus = async (invoiceId: string) => {
    const [row] = await db
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, invoiceId));
    return row!.status;
  };

  it("rejects non-cash payments without a transaction reference", async () => {
    await expect(
      service.collectPayment(tenantId, actor, {
        studentId,
        amount: 10_000,
        method: "kbzpay"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a zero or negative amount", async () => {
    await expect(
      service.collectPayment(tenantId, actor, { studentId, amount: 0, method: "cash" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("applies a partial cash payment to the oldest invoice and issues a receipt", async () => {
    await service.collectPayment(tenantId, actor, {
      studentId,
      amount: 40_000,
      method: "cash"
    });

    expect(await invoiceStatus(invoiceAId)).toBe("partial");
    expect(await invoiceStatus(invoiceBId)).toBe("unpaid");

    const paymentRows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.invoiceId, invoiceAId)));
    expect(paymentRows).toHaveLength(1);
    expect(Number(paymentRows[0]!.amount)).toBe(40_000);
    expect(paymentRows[0]!.verifiedAt).not.toBeNull(); // cash is instantly verified

    const receiptRows = await db
      .select({ receiptNumber: receipts.receiptNumber })
      .from(receipts)
      .where(eq(receipts.tenantId, tenantId));
    expect(receiptRows).toHaveLength(1);
    expect(receiptRows[0]!.receiptNumber).toBeTruthy();
  });

  it("rejects payment beyond the total recordable balance", async () => {
    // Open: A has 60,000 left, B has 50,000 → recordable 110,000.
    await expect(
      service.collectPayment(tenantId, actor, {
        studentId,
        amount: 200_000,
        method: "cash"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("settles the oldest invoice and issues a second, distinct receipt number", async () => {
    await service.collectPayment(tenantId, actor, {
      studentId,
      amount: 60_000,
      method: "cash"
    });

    expect(await invoiceStatus(invoiceAId)).toBe("paid");

    const receiptRows = await db
      .select({ receiptNumber: receipts.receiptNumber })
      .from(receipts)
      .where(eq(receipts.tenantId, tenantId));
    expect(receiptRows).toHaveLength(2);
    expect(receiptRows[0]!.receiptNumber).not.toBe(receiptRows[1]!.receiptNumber);
  });

  it("holds non-cash payments as pending verification (invoice stays unpaid)", async () => {
    await service.collectPayment(tenantId, actor, {
      studentId,
      amount: 20_000,
      method: "kbzpay",
      referenceNumber: "TX-SPEC-1"
    });

    const [pending] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.invoiceId, invoiceBId)));
    expect(pending!.verifiedAt).toBeNull();
    // Verified-only rule: the invoice does not move until verification.
    expect(await invoiceStatus(invoiceBId)).toBe("unpaid");
  });

  it("pending amounts block double-collection of the same balance", async () => {
    // B owes 50,000 with 20,000 pending → only 30,000 recordable.
    await expect(
      service.collectPayment(tenantId, actor, {
        studentId,
        amount: 40_000,
        method: "cash"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.collectPayment(tenantId, actor, {
      studentId,
      amount: 30_000,
      method: "cash"
    });
    expect(await invoiceStatus(invoiceBId)).toBe("partial");
  });

  it("refunds create a cash-out line and never reopen a paid invoice", async () => {
    const [firstCash] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.invoiceId, invoiceAId),
          eq(payments.kind, "payment")
        )
      )
      .orderBy(asc(payments.paidAt));

    const refund = await service.refundPayment(tenantId, firstCash!.id, actor, {
      reason: "Duplicate collection during the P0 test pass."
    });

    expect(refund!.kind).toBe("refund");
    expect(refund!.refundedPaymentId).toBe(firstCash!.id);
    // Gross-based rule: the refund is an outflow, not a re-opened debt.
    expect(await invoiceStatus(invoiceAId)).toBe("paid");
  });

  it("rejects refunding an already fully refunded payment", async () => {
    const [firstCash] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.invoiceId, invoiceAId),
          eq(payments.kind, "payment")
        )
      )
      .orderBy(asc(payments.paidAt));

    await expect(
      service.refundPayment(tenantId, firstCash!.id, actor, {
        reason: "Second refund attempt must fail."
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
