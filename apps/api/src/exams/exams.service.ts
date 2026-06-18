import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { assessmentResults, examCycles, examSchedules } from "../db/schema.js";
import type {
  BulkResultsDto,
  CorrectAssessmentResultDto,
  CreateExamCycleDto,
  CreateExamScheduleDto,
  ListExamSchedulesQueryDto
} from "./dto.js";

@Injectable()
export class ExamsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listCycles(tenantId: string) {
    return this.db
      .select()
      .from(examCycles)
      .where(eq(examCycles.tenantId, tenantId));
  }

  async createCycle(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateExamCycleDto
  ) {
    const rows = await this.db
      .insert(examCycles)
      .values({
        tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        examType: dto.examType,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "exam.cycle.create",
      recordType: "ExamCycle",
      recordId: row.id,
      after: row as Record<string, unknown>
    });

    return row;
  }

  listSchedules(tenantId: string, query: ListExamSchedulesQueryDto) {
    const filters = [eq(examSchedules.tenantId, tenantId)];
    if (query.cycleId) {
      filters.push(eq(examSchedules.examCycleId, query.cycleId));
    }
    if (query.classroomId) {
      filters.push(eq(examSchedules.classroomId, query.classroomId));
    }
    return this.db
      .select()
      .from(examSchedules)
      .where(and(...filters));
  }

  async createSchedule(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateExamScheduleDto
  ) {
    const rows = await this.db
      .insert(examSchedules)
      .values({
        tenantId,
        examCycleId: dto.examCycleId,
        classroomId: dto.classroomId,
        subjectId: dto.subjectId,
        examDate: dto.examDate,
        startsAt: dto.startTime,
        endsAt: dto.endTime,
        fullMarks: String(dto.maxMarks),
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "exam.schedule.create",
      recordType: "ExamSchedule",
      recordId: row.id,
      after: row as Record<string, unknown>
    });

    return row;
  }

  async bulkEnterResults(
    tenantId: string,
    scheduleId: string,
    actorUserId: string | undefined,
    dto: BulkResultsDto
  ) {
    const scheduleRows = await this.db
      .select()
      .from(examSchedules)
      .where(and(eq(examSchedules.tenantId, tenantId), eq(examSchedules.id, scheduleId)));

    if (!scheduleRows[0]) {
      throw new NotFoundException("Exam schedule not found.");
    }

    const inserted = await Promise.all(
      dto.results.map(async (r) => {
        const rows = await this.db
          .insert(assessmentResults)
          .values({
            tenantId,
            examScheduleId: scheduleId,
            studentId: r.studentId,
            marks: r.marksObtained !== undefined ? String(r.marksObtained) : undefined,
            teacherRemarks: r.remarks,
            createdBy: actorUserId,
            updatedBy: actorUserId
          })
          .returning();
        return rows[0]!;
      })
    );

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "exam.results.bulk_enter",
      recordType: "ExamSchedule",
      recordId: scheduleId,
      after: { count: inserted.length } as Record<string, unknown>
    });

    return inserted;
  }

  async lockSchedule(
    tenantId: string,
    scheduleId: string,
    actorUserId: string | undefined
  ) {
    const scheduleRows = await this.db
      .select()
      .from(examSchedules)
      .where(and(eq(examSchedules.tenantId, tenantId), eq(examSchedules.id, scheduleId)));

    if (!scheduleRows[0]) {
      throw new NotFoundException("Exam schedule not found.");
    }

    // Lock all results for this schedule
    const rows = await this.db
      .update(assessmentResults)
      .set({ status: "approved", updatedBy: actorUserId, updatedAt: new Date() })
      .where(
        and(
          eq(assessmentResults.tenantId, tenantId),
          eq(assessmentResults.examScheduleId, scheduleId)
        )
      )
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "exam.results.lock",
      recordType: "ExamSchedule",
      recordId: scheduleId,
      after: { locked: true } as Record<string, unknown>
    });

    return { locked: true, updatedCount: rows.length };
  }

  async correctAssessmentResult(
    tenantId: string,
    scheduleId: string,
    resultId: string,
    actorUserId: string | undefined,
    dto: CorrectAssessmentResultDto
  ) {
    if (!actorUserId) {
      throw new NotFoundException("Actor user id is required.");
    }

    const [existing] = await this.db
      .select()
      .from(assessmentResults)
      .where(
        and(
          eq(assessmentResults.tenantId, tenantId),
          eq(assessmentResults.examScheduleId, scheduleId),
          eq(assessmentResults.id, resultId)
        )
      );

    if (!existing) {
      throw new NotFoundException("Assessment result not found.");
    }

    if (existing.status === "approved") {
      throw new BadRequestException("Locked assessment results cannot be corrected.");
    }

    const before = {
      marks: existing.marks,
      teacherRemarks: existing.teacherRemarks
    };

    const [updated] = await this.db
      .update(assessmentResults)
      .set({
        ...(dto.marksObtained !== undefined ? { marks: String(dto.marksObtained) } : {}),
        ...(dto.grade !== undefined ? { resultStatus: dto.grade } : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(assessmentResults.tenantId, tenantId), eq(assessmentResults.id, resultId)))
      .returning();

    await this.auditService.recordSensitiveCorrection({
      tenantId,
      actorUserId,
      action: "assessment.correct",
      recordType: "AssessmentResult",
      recordId: resultId,
      reason: dto.correctionReason,
      before,
      after: {
        marks: updated!.marks,
        teacherRemarks: updated!.teacherRemarks,
        resultStatus: updated!.resultStatus
      }
    });

    return updated;
  }
}
