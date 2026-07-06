import { BadRequestException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service.js";
import {
  auditLogs,
  benefitPackages,
  payComponents,
  payrollLineItems,
  payrollRecords,
  payrollRuns,
  staff,
  staffBenefitEnrollments,
  staffCompensationComponents,
  staffCompensationProfiles,
  tenants
} from "../db/schema.js";
import { PayrollService } from "./payroll.service.js";

/**
 * P0 integration tests (localhost-test-plan.md Part B §2): payroll math is
 * real money — gross/net composition, percent-of-basic deductions, and the
 * draft → approved(pending) → paid lifecycle with paid records read-only.
 * Requires a migrated PostgreSQL database; skipped unless DATABASE_URL is set.
 */
const databaseUrl = process.env.DATABASE_URL;

const stub = <T>() => ({}) as T;
/** markPayrollPaid enqueues a payslip render; the queue is out of scope here. */
const payslipQueueStub = { enqueueRenderPayslipPdf: async () => undefined };

describe.skipIf(!databaseUrl)("PayrollService (P0)", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const service = new PayrollService(
    db as never,
    new AuditService(db as never),
    payslipQueueStub as never,
    stub(),
    stub()
  );

  const BASE = 300_000;
  const FIXED_DEDUCTION = 30_000;
  const PERCENT = 10; // percent-of-basic → 30,000 on a 300,000 base
  const PACKAGE_VALUE = 80_000;

  let tenantId: string;
  let staffId: string;
  let recordId: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Payroll Spec School", slug: `payroll-spec-${Date.now()}` })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;

    const [member] = await db
      .insert(staff)
      .values({ tenantId, fullName: "U Payroll Case", employmentRole: "teacher" })
      .returning({ id: staff.id });
    staffId = member!.id;

    const [ssb] = await db
      .insert(payComponents)
      .values({
        tenantId,
        code: "SSB-SPEC",
        name: "SSB",
        kind: "deduction",
        calculation: "fixed",
        defaultAmount: String(FIXED_DEDUCTION)
      })
      .returning({ id: payComponents.id });

    const [tax] = await db
      .insert(payComponents)
      .values({
        tenantId,
        code: "TAX-SPEC",
        name: "Income tax",
        kind: "deduction",
        calculation: "percent_of_basic",
        defaultAmount: String(PERCENT)
      })
      .returning({ id: payComponents.id });

    const [transport] = await db
      .insert(benefitPackages)
      .values({
        tenantId,
        name: "Transport package",
        monthlyValue: String(PACKAGE_VALUE),
        eligibilityScope: "all_staff"
      })
      .returning({ id: benefitPackages.id });

    await service.upsertStaffCompensation(tenantId, staffId, undefined, {
      baseSalary: BASE,
      payComponentIds: [ssb!.id, tax!.id],
      benefitPackageIds: [transport!.id]
    });
  });

  afterAll(async () => {
    await db.delete(payrollLineItems).where(eq(payrollLineItems.tenantId, tenantId));
    await db.delete(payrollRecords).where(eq(payrollRecords.tenantId, tenantId));
    await db.delete(payrollRuns).where(eq(payrollRuns.tenantId, tenantId));
    await db
      .delete(staffCompensationComponents)
      .where(eq(staffCompensationComponents.tenantId, tenantId));
    await db
      .delete(staffBenefitEnrollments)
      .where(eq(staffBenefitEnrollments.tenantId, tenantId));
    await db
      .delete(staffCompensationProfiles)
      .where(eq(staffCompensationProfiles.tenantId, tenantId));
    await db.delete(benefitPackages).where(eq(benefitPackages.tenantId, tenantId));
    await db.delete(payComponents).where(eq(payComponents.tenantId, tenantId));
    await db.delete(staff).where(eq(staff.tenantId, tenantId));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await pool.end();
  });

  it("generates a run record with correct gross/net composition", async () => {
    const run = await service.createPayrollRun(tenantId, undefined, {
      periodYear: 2026,
      periodMonth: 1
    });
    await service.generatePayrollRun(tenantId, run.id, undefined);

    const [record] = await db
      .select()
      .from(payrollRecords)
      .where(
        and(eq(payrollRecords.tenantId, tenantId), eq(payrollRecords.staffId, staffId))
      );
    expect(record).toBeDefined();
    recordId = record!.id;

    const expectedDeductions = FIXED_DEDUCTION + (BASE * PERCENT) / 100;
    expect(Number(record!.baseAmount)).toBe(BASE);
    expect(Number(record!.allowancesAmount)).toBe(PACKAGE_VALUE);
    expect(Number(record!.deductionsAmount)).toBe(expectedDeductions);
    // net = base + allowances + bonuses − deductions
    expect(Number(record!.netAmount)).toBe(BASE + PACKAGE_VALUE - expectedDeductions);
    expect(record!.status).toBe("draft");
  });

  it("regenerating the same run does not duplicate records", async () => {
    const run = await service.createPayrollRun(tenantId, undefined, {
      periodYear: 2026,
      periodMonth: 1
    });
    await service.generatePayrollRun(tenantId, run.id, undefined);

    const records = await db
      .select({ id: payrollRecords.id })
      .from(payrollRecords)
      .where(
        and(eq(payrollRecords.tenantId, tenantId), eq(payrollRecords.staffId, staffId))
      );
    expect(records).toHaveLength(1);
  });

  it("approve moves the record to pending, mark-paid to paid", async () => {
    await service.approvePayrollRecord(tenantId, recordId, undefined, {});

    let [record] = await db
      .select({ status: payrollRecords.status })
      .from(payrollRecords)
      .where(eq(payrollRecords.id, recordId));
    expect(record!.status).toBe("pending");

    await service.markPayrollPaid(tenantId, recordId, undefined, {
      paymentMethod: "bank_transfer",
      paymentRef: "TRX-SPEC-1"
    });

    [record] = await db
      .select({ status: payrollRecords.status })
      .from(payrollRecords)
      .where(eq(payrollRecords.id, recordId));
    expect(record!.status).toBe("paid");
  });

  it("paid records are read-only", async () => {
    await expect(
      service.patchPayrollRecord(tenantId, recordId, undefined, {
        componentSelections: []
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
