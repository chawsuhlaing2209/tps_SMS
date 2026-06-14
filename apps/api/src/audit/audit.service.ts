import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import { auditEventSchema } from "@sms/shared";
import { and, desc, eq } from "drizzle-orm";
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

  createAttendanceCorrectionEvent(input: {
    tenantId: string;
    actorUserId: string;
    attendanceRecordId: string;
    previousStatus: string;
    nextStatus: string;
    reason: string;
  }): AuditEvent {
    return this.createEvent({
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
    reason: string;
  }): Promise<AuditEvent> {
    return this.recordEvent({
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

  listForTenant(tenantId: string, recordType?: string) {
    const filters = [eq(auditLogs.tenantId, tenantId)];
    if (recordType) {
      filters.push(eq(auditLogs.recordType, recordType));
    }

    return this.db
      .select()
      .from(auditLogs)
      .where(and(...filters))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
  }
}
