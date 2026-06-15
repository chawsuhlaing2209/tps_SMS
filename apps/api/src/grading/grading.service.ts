import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { assessmentResults, classroomStudents, gradeRules, students } from "../db/schema.js";
import type { CreateGradeRuleDto } from "./dto.js";

@Injectable()
export class GradingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listGradeRules(tenantId: string) {
    return this.db
      .select()
      .from(gradeRules)
      .where(eq(gradeRules.tenantId, tenantId));
  }

  async createGradeRule(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateGradeRuleDto
  ) {
    const rows = await this.db
      .insert(gradeRules)
      .values({
        tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "grade_rule.create",
      recordType: "GradeRule",
      recordId: row.id,
      after: row as Record<string, unknown>
    });

    return row;
  }

  async getGradeSummary(tenantId: string, classroomId: string) {
    // Get all students in the classroom
    const classroomStudentRows = await this.db
      .select({
        studentId: classroomStudents.studentId,
        studentName: students.fullName
      })
      .from(classroomStudents)
      .innerJoin(students, eq(classroomStudents.studentId, students.id))
      .where(
        and(
          eq(classroomStudents.tenantId, tenantId),
          eq(classroomStudents.classroomId, classroomId)
        )
      );

    // Get assessment results for each student
    const summaries = await Promise.all(
      classroomStudentRows.map(async (cs) => {
        const results = await this.db
          .select()
          .from(assessmentResults)
          .where(
            and(
              eq(assessmentResults.tenantId, tenantId),
              eq(assessmentResults.studentId, cs.studentId)
            )
          );

        const marks = results
          .map((r) => (r.marks !== null ? Number(r.marks) : null))
          .filter((m): m is number => m !== null);

        const average = marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : null;

        return {
          studentId: cs.studentId,
          studentName: cs.studentName,
          assessmentCount: results.length,
          average: average !== null ? Math.round(average * 100) / 100 : null
        };
      })
    );

    return summaries;
  }
}
