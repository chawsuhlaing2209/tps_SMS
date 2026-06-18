import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import { auditEventSchema, parseCorrectionReason } from "@sms/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import { auditLogs } from "../db/schema.js";

type AuditEventInput = z.input<typeof auditEventSchema> & {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export interface AuditEvent extends z.output<typeof auditEventSchema> {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}

type SensitiveCorrectionInput = Omit<AuditEventInput, "reason"> & { reason: unknown };

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  createEvent(input: AuditEventInput): AuditEvent {
    const parsed = auditEventSchema.parse(input);
    return {
      ...parsed,
      before: input.before ?? null,
      after: input.after ?? null,
      createdAt: new Date()
    };
  }

  requireCorrectionReason(reason: unknown): string {
    try {
      return parseCorrectionReason(reason);
    } catch {
      throw new BadRequestException("A correction reason is required.");
    }
  }

  createSensitiveCorrectionEvent(input: SensitiveCorrectionInput): AuditEvent {
    const { reason: rawReason, ...rest } = input;
    const reason = this.requireCorrectionReason(rawReason);
    return this.createEvent({ ...rest, reason });
  }

  async recordEvent(input: AuditEventInput): Promise<AuditEvent> {
    const event = this.createEvent(input);

    await this.db.insert(auditLogs).values({
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      action: event.action,
      recordType: event.recordType,
      recordId: event.recordId,
      before: event.before,
      after: event.after,
      reason: event.reason ?? null
    });

    return event;
  }

  async recordSensitiveCorrection(input: SensitiveCorrectionInput): Promise<AuditEvent> {
    const event = this.createSensitiveCorrectionEvent(input);
    await this.db.insert(auditLogs).values({
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      action: event.action,
      recordType: event.recordType,
      recordId: event.recordId,
      before: event.before,
      after: event.after,
      reason: event.reason
    });
    return event;
  }

  createAttendanceCorrectionEvent(input: {
    tenantId: string;
    actorUserId: string;
    attendanceRecordId: string;
    previousStatus: string;
    nextStatus: string;
    reason: unknown;
  }): AuditEvent {
    return this.createSensitiveCorrectionEvent({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: "attendance.correct",
      recordType: "AttendanceRecord",
      recordId: input.attendanceRecordId,
      reason: input.reason,
      before: { status: input.previousStatus },
      after: { status: input.nextStatus }
    });
  }

  recordAttendanceCorrection(input: {
    tenantId: string;
    actorUserId: string;
    attendanceRecordId: string;
    previousStatus: string;
    nextStatus: string;
    reason: unknown;
  }): Promise<AuditEvent> {
    return this.recordSensitiveCorrection({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: "attendance.correct",
      recordType: "AttendanceRecord",
      recordId: input.attendanceRecordId,
      reason: input.reason,
      before: { status: input.previousStatus },
      after: { status: input.nextStatus }
    });
  }

  async listForTenant(
    tenantId: string,
    options?: { recordType?: string; limit?: number; offset?: number }
  ) {
    const filters = [eq(auditLogs.tenantId, tenantId)];
    if (options?.recordType) {
      filters.push(eq(auditLogs.recordType, options.recordType));
    }

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(and(...filters))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(...filters));

    return { data: rows, total: countRow?.count ?? 0, limit, offset };
  }
}
