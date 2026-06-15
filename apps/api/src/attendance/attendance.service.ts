import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import { attendanceRecords, attendanceSessions } from "../db/schema.js";
import { TeacherAssignmentService } from "../identity/teacher-assignment.service.js";
import { AuditService } from "../audit/audit.service.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import type {
  OpenAttendanceSessionDto,
  BulkMarkRecordsDto,
  CorrectAttendanceRecordDto,
  AttendanceReportQueryDto
} from "./dto.js";

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly teacherAssignmentService: TeacherAssignmentService,
    private readonly auditService: AuditService
  ) {}

  async listSessions(context: TenantContext, classroomId: string, subjectId?: string) {
    const conditions = [
      eq(attendanceSessions.tenantId, context.tenantId),
      eq(attendanceSessions.classroomId, classroomId)
    ];

    if (subjectId) {
      conditions.push(eq(attendanceSessions.subjectId, subjectId));
    }

    return this.db
      .select({
        id: attendanceSessions.id,
        classroomId: attendanceSessions.classroomId,
        subjectId: attendanceSessions.subjectId,
        sessionDate: attendanceSessions.sessionDate,
        submittedByStaffId: attendanceSessions.submittedByStaffId,
        submittedAt: attendanceSessions.submittedAt
      })
      .from(attendanceSessions)
      .where(and(...conditions))
      .orderBy(attendanceSessions.sessionDate);
  }

  async getSession(context: TenantContext, sessionId: string) {
    const [session] = await this.db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, context.tenantId),
          eq(attendanceSessions.id, sessionId)
        )
      );

    if (!session) {
      throw new NotFoundException("Attendance session not found.");
    }

    const records = await this.db
      .select({
        id: attendanceRecords.id,
        studentId: attendanceRecords.studentId,
        status: attendanceRecords.status,
        correctionReason: attendanceRecords.correctionReason
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.tenantId, context.tenantId),
          eq(attendanceRecords.attendanceSessionId, sessionId)
        )
      );

    return { session, records };
  }

  async openSession(tenantId: string, classroomId: string, dto: OpenAttendanceSessionDto, userId: string) {
    const rows = await this.db
      .insert(attendanceSessions)
      .values({
        tenantId,
        classroomId,
        subjectId: dto.subjectId ?? null,
        sessionDate: dto.sessionDate,
        submittedByStaffId: dto.submittedByStaffId ?? null,
        submittedAt: null,
        createdBy: userId,
        updatedBy: userId
      })
      .returning();
    const row = rows[0]!;
    return row;
  }

  async bulkMarkRecords(tenantId: string, sessionId: string, dto: BulkMarkRecordsDto, userId: string) {
    if (dto.records.length === 0) return [];

    const rows = await this.db
      .insert(attendanceRecords)
      .values(
        dto.records.map((r) => ({
          tenantId,
          attendanceSessionId: sessionId,
          studentId: r.studentId,
          status: r.status as typeof attendanceRecords.status._.data,
          createdBy: userId,
          updatedBy: userId
        }))
      )
      .returning();
    return rows;
  }

  async correctRecord(
    tenantId: string,
    sessionId: string,
    recordId: string,
    dto: CorrectAttendanceRecordDto,
    userId: string
  ) {
    const [existing] = await this.db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.tenantId, tenantId),
          eq(attendanceRecords.attendanceSessionId, sessionId),
          eq(attendanceRecords.id, recordId)
        )
      );

    if (!existing) {
      throw new NotFoundException("Attendance record not found.");
    }

    const previousStatus = existing.status;

    const rows = await this.db
      .update(attendanceRecords)
      .set({
        status: dto.status as typeof attendanceRecords.status._.data,
        correctionReason: dto.correctionReason,
        updatedBy: userId
      })
      .where(
        and(
          eq(attendanceRecords.tenantId, tenantId),
          eq(attendanceRecords.id, recordId)
        )
      )
      .returning();
    const row = rows[0]!;

    await this.auditService.recordAttendanceCorrection({
      tenantId,
      actorUserId: userId,
      attendanceRecordId: recordId,
      previousStatus,
      nextStatus: dto.status,
      reason: dto.correctionReason
    });

    return row;
  }

  async closeSession(tenantId: string, sessionId: string, userId: string) {
    const [existing] = await this.db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, tenantId),
          eq(attendanceSessions.id, sessionId)
        )
      );

    if (!existing) {
      throw new NotFoundException("Attendance session not found.");
    }

    const rows = await this.db
      .update(attendanceSessions)
      .set({
        submittedAt: new Date(),
        updatedBy: userId
      })
      .where(
        and(
          eq(attendanceSessions.tenantId, tenantId),
          eq(attendanceSessions.id, sessionId)
        )
      )
      .returning();
    const row = rows[0]!;
    return row;
  }

  async getAttendanceReport(tenantId: string, query: AttendanceReportQueryDto) {
    const conditions = [eq(attendanceSessions.tenantId, tenantId)];

    if (query.classroomId) {
      conditions.push(eq(attendanceSessions.classroomId, query.classroomId));
    }
    if (query.dateFrom) {
      conditions.push(gte(attendanceSessions.sessionDate, query.dateFrom));
    }
    if (query.dateTo) {
      conditions.push(lte(attendanceSessions.sessionDate, query.dateTo));
    }

    const sessions = await this.db
      .select({
        id: attendanceSessions.id,
        classroomId: attendanceSessions.classroomId,
        sessionDate: attendanceSessions.sessionDate,
        submittedAt: attendanceSessions.submittedAt
      })
      .from(attendanceSessions)
      .where(and(...conditions))
      .orderBy(attendanceSessions.sessionDate);

    if (sessions.length === 0) return { sessions: [], summary: { total: 0, submitted: 0 } };

    const sessionIds = sessions.map((s) => s.id);

    const statusCounts = await this.db
      .select({
        sessionId: attendanceRecords.attendanceSessionId,
        status: attendanceRecords.status,
        total: count()
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.tenantId, tenantId),
          sql`${attendanceRecords.attendanceSessionId} = ANY(${sql.raw(`ARRAY[${sessionIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`
        )
      )
      .groupBy(attendanceRecords.attendanceSessionId, attendanceRecords.status);

    return {
      sessions,
      statusCounts,
      summary: {
        total: sessions.length,
        submitted: sessions.filter((s) => s.submittedAt !== null).length
      }
    };
  }
}
