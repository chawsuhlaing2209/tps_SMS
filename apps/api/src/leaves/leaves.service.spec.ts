import { ConflictException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service.js";
import {
  auditLogs,
  leaveRecords,
  leaveTypes,
  staff,
  staffLeaveBalances,
  tenants
} from "../db/schema.js";
import { LeavesService } from "./leaves.service.js";

/**
 * P0 integration tests (localhost-test-plan.md Part B §3): leave balance math
 * is money-adjacent — unpaid-leave deductions feed payroll — so allocation,
 * overdraw, and refund-on-delete must be provably correct.
 * Requires a migrated PostgreSQL database; skipped unless DATABASE_URL is set.
 */
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("LeavesService (P0)", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const service = new LeavesService(db as never, new AuditService(db as never));

  const year = new Date().getFullYear();
  let tenantId: string;
  let staffId: string;
  let annualTypeId: string;

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Leaves Spec School", slug: `leaves-spec-${Date.now()}` })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;

    const [member] = await db
      .insert(staff)
      .values({ tenantId, fullName: "Daw Test Leave", employmentRole: "admin" })
      .returning({ id: staff.id });
    staffId = member!.id;

    const type = await service.createLeaveType(tenantId, undefined, {
      name: "Annual",
      yearlyQuota: 10
    });
    annualTypeId = type.id;
  });

  afterAll(async () => {
    await db.delete(leaveRecords).where(eq(leaveRecords.tenantId, tenantId));
    await db.delete(staffLeaveBalances).where(eq(staffLeaveBalances.tenantId, tenantId));
    await db.delete(leaveTypes).where(eq(leaveTypes.tenantId, tenantId));
    await db.delete(staff).where(eq(staff.tenantId, tenantId));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await pool.end();
  });

  it("defaults allocation to the type quota", async () => {
    const summary = await service.getStaffLeaveSummary(tenantId, staffId, year);
    const annual = summary.find((row) => row.leaveTypeId === annualTypeId);
    expect(annual).toMatchObject({ allocated: 10, used: 0, remaining: 10, isOverride: false });
  });

  it("per-staff yearly override wins over the type quota", async () => {
    await service.setLeaveBalances(tenantId, undefined, {
      staffId,
      calendarYear: year,
      entries: [{ leaveTypeId: annualTypeId, allocatedDays: 15 }]
    });

    const summary = await service.getStaffLeaveSummary(tenantId, staffId, year);
    const annual = summary.find((row) => row.leaveTypeId === annualTypeId);
    expect(annual).toMatchObject({ allocated: 15, remaining: 15, isOverride: true });
  });

  it("recording leave deducts from remaining (half days included)", async () => {
    await service.createLeaveRecord(tenantId, undefined, {
      staffId,
      leaveTypeId: annualTypeId,
      startDate: `${year}-03-02`,
      endDate: `${year}-03-05`,
      days: 3.5
    });

    const summary = await service.getStaffLeaveSummary(tenantId, staffId, year);
    const annual = summary.find((row) => row.leaveTypeId === annualTypeId);
    expect(annual?.used).toBe(3.5);
    expect(annual?.remaining).toBe(11.5);
  });

  it("rejects recording more days than remain", async () => {
    await expect(
      service.createLeaveRecord(tenantId, undefined, {
        staffId,
        leaveTypeId: annualTypeId,
        startDate: `${year}-04-01`,
        endDate: `${year}-04-30`,
        days: 20
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("deleting a record returns the days to the balance", async () => {
    const [record] = await db
      .select({ id: leaveRecords.id })
      .from(leaveRecords)
      .where(and(eq(leaveRecords.tenantId, tenantId), eq(leaveRecords.staffId, staffId)));

    await service.deleteLeaveRecord(tenantId, record!.id, undefined);

    const summary = await service.getStaffLeaveSummary(tenantId, staffId, year);
    const annual = summary.find((row) => row.leaveTypeId === annualTypeId);
    expect(annual?.used).toBe(0);
    expect(annual?.remaining).toBe(15);
  });

  it("overview lists active staff with per-type entries and consistent totals", async () => {
    const overview = await service.getLeaveOverview(tenantId, year);

    expect(overview.leaveTypes.map((type) => type.id)).toContain(annualTypeId);
    const row = overview.rows.find((entry) => entry.staffId === staffId);
    expect(row).toBeDefined();

    const allocatedSum = row!.byType.reduce((sum, entry) => sum + entry.allocated, 0);
    const usedSum = row!.byType.reduce((sum, entry) => sum + entry.used, 0);
    expect(row!.totals.allocated).toBe(allocatedSum);
    expect(row!.totals.used).toBe(usedSum);
    expect(row!.totals.remaining).toBe(allocatedSum - usedSum);
  });

  it("archived leave types are excluded from summaries", async () => {
    const type = await service.createLeaveType(tenantId, undefined, {
      name: "Study",
      yearlyQuota: 5
    });
    await service.archiveLeaveType(tenantId, type.id, undefined);

    const summary = await service.getStaffLeaveSummary(tenantId, staffId, year);
    expect(summary.some((row) => row.leaveTypeId === type.id)).toBe(false);

    // cleanup of the extra type happens in afterAll via tenant-wide deletes
    expect(
      await db
        .select({ id: leaveTypes.id })
        .from(leaveTypes)
        .where(inArray(leaveTypes.id, [type.id]))
    ).toHaveLength(1);
  });
});
