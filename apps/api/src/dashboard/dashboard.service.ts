import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import {
  academicYears,
  classrooms,
  enrollmentFeePlans,
  feeItems,
  gradeSubjects,
  staff,
  timetablePeriods
} from "../db/schema.js";

export type DashboardSummary = {
  activeAcademicYear: boolean;
  gradesWithSubjects: number;
  classrooms: number;
  teachersWithAssignments: number;
  timetablePeriods: number;
  feeItems: number;
  enrollmentPlans: number;
};

@Injectable()
export class DashboardService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getCurrentAcademicYear(tenantId: string) {
    const [year] = await this.db
      .select({
        id: academicYears.id,
        name: academicYears.name,
        startsOn: academicYears.startsOn,
        endsOn: academicYears.endsOn,
        status: academicYears.status
      })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, "active")))
      .limit(1);

    return year ?? null;
  }

  async getSummary(tenantId: string): Promise<DashboardSummary> {
    const [
      activeYear,
      gradesWithSubjects,
      classroomCount,
      teachersWithAssignments,
      periodCount,
      feeItemCount,
      planCount
    ] = await Promise.all([
      this.db
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, "active")))
        .limit(1),
      this.db
        .select({ count: sql<number>`count(distinct ${gradeSubjects.gradeId})::int` })
        .from(gradeSubjects)
        .where(eq(gradeSubjects.tenantId, tenantId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(classrooms)
        .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.status, "active"))),
      this.db.execute<{ count: number }>(sql`
        SELECT count(distinct s.id)::int AS count
        FROM staff s
        WHERE s.tenant_id = ${tenantId}
          AND s.employment_role = 'teacher'
          AND (
            EXISTS (
              SELECT 1 FROM classrooms c
              WHERE c.tenant_id = ${tenantId} AND c.class_teacher_staff_id = s.id
            )
            OR EXISTS (
              SELECT 1 FROM grade_chief_assignments g
              WHERE g.tenant_id = ${tenantId} AND g.staff_id = s.id
            )
            OR EXISTS (
              SELECT 1 FROM classroom_subject_teachers t
              WHERE t.tenant_id = ${tenantId} AND t.teacher_staff_id = s.id
            )
          )
      `),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(timetablePeriods)
        .where(eq(timetablePeriods.tenantId, tenantId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(feeItems)
        .where(eq(feeItems.tenantId, tenantId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollmentFeePlans)
        .where(eq(enrollmentFeePlans.tenantId, tenantId))
    ]);

    const teacherCount =
      (teachersWithAssignments as { rows: { count: number }[] }).rows[0]?.count ?? 0;

    return {
      activeAcademicYear: Boolean(activeYear[0]),
      gradesWithSubjects: gradesWithSubjects[0]?.count ?? 0,
      classrooms: classroomCount[0]?.count ?? 0,
      teachersWithAssignments: teacherCount,
      timetablePeriods: periodCount[0]?.count ?? 0,
      feeItems: feeItemCount[0]?.count ?? 0,
      enrollmentPlans: planCount[0]?.count ?? 0
    };
  }
}
