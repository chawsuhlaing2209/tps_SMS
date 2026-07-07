import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { leaveRecords, leaveTypes, staff, staffLeaveBalances } from "../db/schema.js";
import type {
  CreateLeaveRecordDto,
  CreateLeaveTypeDto,
  SetLeaveBalancesDto,
  UpdateLeaveTypeDto
} from "./dto.js";

@Injectable()
export class LeavesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  // ── Leave types ────────────────────────────────────────────────────────────

  listLeaveTypes(tenantId: string) {
    return this.db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.tenantId, tenantId))
      .orderBy(asc(leaveTypes.name));
  }

  private async getLeaveTypeOrThrow(tenantId: string, leaveTypeId: string) {
    const [type] = await this.db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.id, leaveTypeId)));
    if (!type) {
      throw new NotFoundException("Leave type not found.");
    }
    return type;
  }

  async createLeaveType(tenantId: string, actorUserId: string | undefined, dto: CreateLeaveTypeDto) {
    const name = dto.name.trim();
    const [existing] = await this.db
      .select({ id: leaveTypes.id })
      .from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.name, name)));
    if (existing) {
      throw new ConflictException(`Leave type "${name}" already exists.`);
    }

    const [type] = await this.db
      .insert(leaveTypes)
      .values({
        tenantId,
        name,
        yearlyQuota: String(dto.yearlyQuota),
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "leave_type.create",
      recordType: "LeaveType",
      recordId: type!.id,
      after: { name, yearlyQuota: dto.yearlyQuota }
    });

    return type!;
  }

  async updateLeaveType(
    tenantId: string,
    leaveTypeId: string,
    actorUserId: string | undefined,
    dto: UpdateLeaveTypeDto
  ) {
    const previous = await this.getLeaveTypeOrThrow(tenantId, leaveTypeId);

    const [type] = await this.db
      .update(leaveTypes)
      .set({
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.yearlyQuota != null ? { yearlyQuota: String(dto.yearlyQuota) } : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.id, leaveTypeId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "leave_type.update",
      recordType: "LeaveType",
      recordId: leaveTypeId,
      before: { name: previous.name, yearlyQuota: previous.yearlyQuota },
      after: { name: type!.name, yearlyQuota: type!.yearlyQuota }
    });

    return type!;
  }

  private async setLeaveTypeStatus(
    tenantId: string,
    leaveTypeId: string,
    status: "active" | "archived",
    action: string,
    actorUserId: string | undefined
  ) {
    const previous = await this.getLeaveTypeOrThrow(tenantId, leaveTypeId);

    const [type] = await this.db
      .update(leaveTypes)
      .set({ status, updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.id, leaveTypeId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action,
      recordType: "LeaveType",
      recordId: leaveTypeId,
      before: { status: previous.status },
      after: { status }
    });

    return type!;
  }

  archiveLeaveType(tenantId: string, leaveTypeId: string, actorUserId: string | undefined) {
    return this.setLeaveTypeStatus(tenantId, leaveTypeId, "archived", "leave_type.archive", actorUserId);
  }

  restoreLeaveType(tenantId: string, leaveTypeId: string, actorUserId: string | undefined) {
    return this.setLeaveTypeStatus(tenantId, leaveTypeId, "active", "leave_type.restore", actorUserId);
  }

  async deleteLeaveType(tenantId: string, leaveTypeId: string, actorUserId: string | undefined) {
    const type = await this.getLeaveTypeOrThrow(tenantId, leaveTypeId);

    // Two-step safety: archive the type before deleting it permanently.
    if (type.status !== "archived") {
      throw new BadRequestException("Archive the leave type before deleting it.");
    }

    const [used] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(leaveRecords)
      .where(and(eq(leaveRecords.tenantId, tenantId), eq(leaveRecords.leaveTypeId, leaveTypeId)));
    if ((used?.n ?? 0) > 0) {
      throw new ConflictException({
        message: "This leave type has recorded leaves and cannot be deleted. Keep it archived instead.",
        dependencies: { leaveRecords: used?.n ?? 0 }
      });
    }

    await this.db
      .delete(staffLeaveBalances)
      .where(and(eq(staffLeaveBalances.tenantId, tenantId), eq(staffLeaveBalances.leaveTypeId, leaveTypeId)));
    await this.db
      .delete(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.id, leaveTypeId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "leave_type.delete",
      recordType: "LeaveType",
      recordId: leaveTypeId,
      before: { name: type.name, status: type.status },
      after: { deleted: true }
    });

    return { id: leaveTypeId, deleted: true };
  }

  // ── Balances & summary ─────────────────────────────────────────────────────

  /**
   * Per-type summary for a staff member and calendar year:
   * allocated (override or the type's default quota), used (sum of records),
   * remaining.
   */
  async getStaffLeaveSummary(tenantId: string, staffId: string, year: number) {
    const types = await this.db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.status, "active")))
      .orderBy(asc(leaveTypes.name));

    const balances = await this.db
      .select()
      .from(staffLeaveBalances)
      .where(
        and(
          eq(staffLeaveBalances.tenantId, tenantId),
          eq(staffLeaveBalances.staffId, staffId),
          eq(staffLeaveBalances.calendarYear, year)
        )
      );

    const usedRows = await this.db
      .select({
        leaveTypeId: leaveRecords.leaveTypeId,
        used: sql<number>`coalesce(sum(${leaveRecords.days}), 0)::float`
      })
      .from(leaveRecords)
      .where(
        and(
          eq(leaveRecords.tenantId, tenantId),
          eq(leaveRecords.staffId, staffId),
          gte(leaveRecords.startDate, `${year}-01-01`),
          lte(leaveRecords.startDate, `${year}-12-31`)
        )
      )
      .groupBy(leaveRecords.leaveTypeId);

    const usedByType = new Map(usedRows.map((row) => [row.leaveTypeId, row.used]));
    const balanceByType = new Map(balances.map((row) => [row.leaveTypeId, Number(row.allocatedDays)]));

    return types.map((type) => {
      const allocated = balanceByType.get(type.id) ?? Number(type.yearlyQuota);
      const used = usedByType.get(type.id) ?? 0;
      return {
        leaveTypeId: type.id,
        name: type.name,
        allocated,
        used,
        remaining: allocated - used,
        isOverride: balanceByType.has(type.id)
      };
    });
  }

  /**
   * Roster view: every active staff member with their per-type allocation, used
   * days, and remaining balance for a calendar year — plus totals. Powers the
   * all-staff leave table so managers don't have to select one person at a time.
   */
  async getLeaveOverview(tenantId: string, year: number) {
    const types = await this.db
      .select({ id: leaveTypes.id, name: leaveTypes.name, yearlyQuota: leaveTypes.yearlyQuota })
      .from(leaveTypes)
      .where(and(eq(leaveTypes.tenantId, tenantId), eq(leaveTypes.status, "active")))
      .orderBy(asc(leaveTypes.name));

    const staffRows = await this.db
      .select({
        id: staff.id,
        fullName: staff.fullName,
        employmentRole: staff.employmentRole,
        department: staff.department
      })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.status, "active")))
      .orderBy(asc(staff.fullName));

    const balances = await this.db
      .select({
        staffId: staffLeaveBalances.staffId,
        leaveTypeId: staffLeaveBalances.leaveTypeId,
        allocatedDays: staffLeaveBalances.allocatedDays
      })
      .from(staffLeaveBalances)
      .where(
        and(
          eq(staffLeaveBalances.tenantId, tenantId),
          eq(staffLeaveBalances.calendarYear, year)
        )
      );

    const usedRows = await this.db
      .select({
        staffId: leaveRecords.staffId,
        leaveTypeId: leaveRecords.leaveTypeId,
        used: sql<number>`coalesce(sum(${leaveRecords.days}), 0)::float`
      })
      .from(leaveRecords)
      .where(
        and(
          eq(leaveRecords.tenantId, tenantId),
          gte(leaveRecords.startDate, `${year}-01-01`),
          lte(leaveRecords.startDate, `${year}-12-31`)
        )
      )
      .groupBy(leaveRecords.staffId, leaveRecords.leaveTypeId);

    const key = (staffId: string, leaveTypeId: string) => `${staffId}:${leaveTypeId}`;
    const overrideByKey = new Map(
      balances.map((row) => [key(row.staffId, row.leaveTypeId), Number(row.allocatedDays)])
    );
    const usedByKey = new Map(usedRows.map((row) => [key(row.staffId, row.leaveTypeId), row.used]));

    const rows = staffRows.map((member) => {
      let allocatedTotal = 0;
      let usedTotal = 0;
      const byType = types.map((type) => {
        const override = overrideByKey.get(key(member.id, type.id));
        const allocated = override ?? Number(type.yearlyQuota);
        const used = usedByKey.get(key(member.id, type.id)) ?? 0;
        allocatedTotal += allocated;
        usedTotal += used;
        return {
          leaveTypeId: type.id,
          allocated,
          used,
          remaining: allocated - used,
          isOverride: override != null
        };
      });
      return {
        staffId: member.id,
        fullName: member.fullName,
        employmentRole: member.employmentRole,
        department: member.department,
        byType,
        totals: {
          allocated: allocatedTotal,
          used: usedTotal,
          remaining: allocatedTotal - usedTotal
        }
      };
    });

    return {
      year,
      leaveTypes: types.map((type) => ({
        id: type.id,
        name: type.name,
        yearlyQuota: Number(type.yearlyQuota)
      })),
      rows
    };
  }

  async setLeaveBalances(tenantId: string, actorUserId: string | undefined, dto: SetLeaveBalancesDto) {
    for (const entry of dto.entries) {
      await this.getLeaveTypeOrThrow(tenantId, entry.leaveTypeId);
      await this.db
        .insert(staffLeaveBalances)
        .values({
          tenantId,
          staffId: dto.staffId,
          leaveTypeId: entry.leaveTypeId,
          calendarYear: dto.calendarYear,
          allocatedDays: String(entry.allocatedDays),
          createdBy: actorUserId,
          updatedBy: actorUserId
        })
        .onConflictDoUpdate({
          target: [
            staffLeaveBalances.tenantId,
            staffLeaveBalances.staffId,
            staffLeaveBalances.leaveTypeId,
            staffLeaveBalances.calendarYear
          ],
          set: {
            allocatedDays: String(entry.allocatedDays),
            updatedBy: actorUserId,
            updatedAt: new Date()
          }
        });
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "leave_balance.set",
      recordType: "StaffLeaveBalance",
      recordId: dto.staffId,
      after: { calendarYear: dto.calendarYear, entries: dto.entries }
    });

    return this.getStaffLeaveSummary(tenantId, dto.staffId, dto.calendarYear);
  }

  // ── Leave records ──────────────────────────────────────────────────────────

  listLeaveRecords(tenantId: string, staffId?: string, year?: number) {
    const filters = [eq(leaveRecords.tenantId, tenantId)];
    if (staffId) filters.push(eq(leaveRecords.staffId, staffId));
    if (year) {
      filters.push(gte(leaveRecords.startDate, `${year}-01-01`));
      filters.push(lte(leaveRecords.startDate, `${year}-12-31`));
    }
    return this.db
      .select()
      .from(leaveRecords)
      .where(and(...filters))
      .orderBy(asc(leaveRecords.startDate));
  }

  async createLeaveRecord(tenantId: string, actorUserId: string | undefined, dto: CreateLeaveRecordDto) {
    const type = await this.getLeaveTypeOrThrow(tenantId, dto.leaveTypeId);
    if (type.status !== "active") {
      throw new BadRequestException("This leave type is archived.");
    }
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException("End date must be on or after the start date.");
    }

    const year = Number(dto.startDate.slice(0, 4));
    const summary = await this.getStaffLeaveSummary(tenantId, dto.staffId, year);
    const typeSummary = summary.find((entry) => entry.leaveTypeId === dto.leaveTypeId);
    const remaining = typeSummary?.remaining ?? 0;
    if (dto.days > remaining) {
      throw new ConflictException({
        message: `Not enough balance: ${remaining} day(s) remaining for ${type.name}.`,
        remaining
      });
    }

    const [record] = await this.db
      .insert(leaveRecords)
      .values({
        tenantId,
        staffId: dto.staffId,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        days: String(dto.days),
        note: dto.note?.trim() || null,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "leave_record.create",
      recordType: "LeaveRecord",
      recordId: record!.id,
      after: {
        staffId: dto.staffId,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        days: dto.days
      }
    });

    return record!;
  }

  async deleteLeaveRecord(tenantId: string, recordId: string, actorUserId: string | undefined) {
    const [record] = await this.db
      .select()
      .from(leaveRecords)
      .where(and(eq(leaveRecords.tenantId, tenantId), eq(leaveRecords.id, recordId)));
    if (!record) {
      throw new NotFoundException("Leave record not found.");
    }

    await this.db
      .delete(leaveRecords)
      .where(and(eq(leaveRecords.tenantId, tenantId), eq(leaveRecords.id, recordId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "leave_record.delete",
      recordType: "LeaveRecord",
      recordId,
      before: {
        staffId: record.staffId,
        leaveTypeId: record.leaveTypeId,
        startDate: record.startDate,
        days: record.days
      },
      after: { deleted: true }
    });

    return { id: recordId, deleted: true };
  }
}
