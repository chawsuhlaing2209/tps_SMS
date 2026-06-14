import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import { attendanceRecords, attendanceSessions } from "../db/schema.js";
import { TeacherAssignmentService } from "../identity/teacher-assignment.service.js";
import type { TenantContext } from "../tenancy/tenant-context.js";

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly teacherAssignmentService: TeacherAssignmentService
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
}
