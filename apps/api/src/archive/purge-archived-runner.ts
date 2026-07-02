import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import type { Database } from "../db/db.module.js";
import {
  assessmentResults,
  assignmentSubmissions,
  attendanceRecords,
  auditLogs,
  classroomStudents,
  classroomSubjectTeachers,
  classrooms,
  enrollments,
  gradeChiefAssignments,
  invoices,
  payrollRecords,
  reportCards,
  salaryRecords,
  staff,
  staffBenefitEnrollments,
  staffCompensationProfiles,
  staffIncentiveEligibility,
  students,
  studentDiscounts,
  studentDocuments,
  studentGuardians,
  studentServices,
  tenantSettings,
  timetableSlots
} from "../db/schema.js";

type Db = Database;

export type TenantPurgeResult = {
  tenantId: string;
  retentionDays: number;
  studentsPurged: number;
  studentsSkipped: number;
  staffPurged: number;
  staffSkipped: number;
};

const count = sql<number>`count(*)::int`;
const anyBlocked = (rows: { n: number }[][]) => rows.some((r) => (r[0]?.n ?? 0) > 0);

/**
 * Auto-purge archived records that are older than a tenant's retention window.
 * Mirrors the guarded permanentlyDelete logic: blocks (skips) records with
 * financial/academic dependents, cascades trivial owned rows, and writes an
 * audit tombstone. Safe to run repeatedly.
 */
export async function purgeArchivedForTenant(
  db: Db,
  tenantId: string,
  retentionDays: number
): Promise<TenantPurgeResult> {
  const result: TenantPurgeResult = {
    tenantId,
    retentionDays,
    studentsPurged: 0,
    studentsSkipped: 0,
    staffPurged: 0,
    staffSkipped: 0
  };

  if (!retentionDays || retentionDays <= 0) {
    return result;
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // ---- Students ----
  const archivedStudents = await db
    .select({
      id: students.id,
      fullName: students.fullName,
      admissionNumber: students.admissionNumber,
      status: students.status
    })
    .from(students)
    .where(
      and(
        eq(students.tenantId, tenantId),
        isNotNull(students.archivedAt),
        lt(students.archivedAt, cutoff)
      )
    );

  for (const student of archivedStudents) {
    const s = student.id;
    const blockers = await Promise.all([
      db.select({ n: count }).from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, s))),
      db.select({ n: count }).from(reportCards).where(and(eq(reportCards.tenantId, tenantId), eq(reportCards.studentId, s))),
      db.select({ n: count }).from(enrollments).where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.studentId, s))),
      db.select({ n: count }).from(classroomStudents).where(and(eq(classroomStudents.tenantId, tenantId), eq(classroomStudents.studentId, s))),
      db.select({ n: count }).from(attendanceRecords).where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.studentId, s))),
      db.select({ n: count }).from(assessmentResults).where(and(eq(assessmentResults.tenantId, tenantId), eq(assessmentResults.studentId, s)))
    ]);
    if (anyBlocked(blockers)) {
      result.studentsSkipped += 1;
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.delete(studentGuardians).where(and(eq(studentGuardians.tenantId, tenantId), eq(studentGuardians.studentId, student.id)));
      await tx.delete(studentDocuments).where(and(eq(studentDocuments.tenantId, tenantId), eq(studentDocuments.studentId, student.id)));
      await tx.delete(studentServices).where(and(eq(studentServices.tenantId, tenantId), eq(studentServices.studentId, student.id)));
      await tx.delete(studentDiscounts).where(and(eq(studentDiscounts.tenantId, tenantId), eq(studentDiscounts.studentId, student.id)));
      await tx.delete(assignmentSubmissions).where(and(eq(assignmentSubmissions.tenantId, tenantId), eq(assignmentSubmissions.studentId, student.id)));
      await tx.delete(students).where(and(eq(students.tenantId, tenantId), eq(students.id, student.id)));
    });

    await db.insert(auditLogs).values({
      tenantId,
      actorUserId: null,
      action: "student.delete",
      recordType: "student",
      recordId: student.id,
      before: { fullName: student.fullName, admissionNumber: student.admissionNumber, status: student.status },
      after: { deleted: true },
      reason: "auto-purge (retention policy)"
    });
    result.studentsPurged += 1;
  }

  // ---- Staff ----
  const archivedStaff = await db
    .select({
      id: staff.id,
      fullName: staff.fullName,
      employeeNumber: staff.employeeNumber,
      status: staff.status
    })
    .from(staff)
    .where(
      and(eq(staff.tenantId, tenantId), isNotNull(staff.archivedAt), lt(staff.archivedAt, cutoff))
    );

  for (const member of archivedStaff) {
    const m = member.id;
    const blockers = await Promise.all([
      db.select({ n: count }).from(classroomSubjectTeachers).where(and(eq(classroomSubjectTeachers.tenantId, tenantId), eq(classroomSubjectTeachers.teacherStaffId, m))),
      db.select({ n: count }).from(gradeChiefAssignments).where(and(eq(gradeChiefAssignments.tenantId, tenantId), eq(gradeChiefAssignments.staffId, m))),
      db.select({ n: count }).from(classrooms).where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.classTeacherStaffId, m))),
      db.select({ n: count }).from(timetableSlots).where(and(eq(timetableSlots.tenantId, tenantId), eq(timetableSlots.teacherStaffId, m))),
      db.select({ n: count }).from(salaryRecords).where(and(eq(salaryRecords.tenantId, tenantId), eq(salaryRecords.staffId, m))),
      db.select({ n: count }).from(payrollRecords).where(and(eq(payrollRecords.tenantId, tenantId), eq(payrollRecords.staffId, m)))
    ]);
    if (anyBlocked(blockers)) {
      result.staffSkipped += 1;
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.delete(staffCompensationProfiles).where(and(eq(staffCompensationProfiles.tenantId, tenantId), eq(staffCompensationProfiles.staffId, member.id)));
      await tx.delete(staffIncentiveEligibility).where(and(eq(staffIncentiveEligibility.tenantId, tenantId), eq(staffIncentiveEligibility.staffId, member.id)));
      await tx.delete(staffBenefitEnrollments).where(and(eq(staffBenefitEnrollments.tenantId, tenantId), eq(staffBenefitEnrollments.staffId, member.id)));
      await tx.delete(staff).where(and(eq(staff.tenantId, tenantId), eq(staff.id, member.id)));
    });

    await db.insert(auditLogs).values({
      tenantId,
      actorUserId: null,
      action: "staff.delete",
      recordType: "staff",
      recordId: member.id,
      before: { fullName: member.fullName, employeeNumber: member.employeeNumber, status: member.status },
      after: { deleted: true },
      reason: "auto-purge (retention policy)"
    });
    result.staffPurged += 1;
  }

  return result;
}

/** Purge every tenant that has a retention window configured. */
export async function purgeArchivedAllTenants(db: Db): Promise<TenantPurgeResult[]> {
  const rows = await db
    .select({ tenantId: tenantSettings.tenantId, days: tenantSettings.archiveRetentionDays })
    .from(tenantSettings)
    .where(and(isNotNull(tenantSettings.archiveRetentionDays)));

  const results: TenantPurgeResult[] = [];
  for (const row of rows) {
    if (row.days && row.days > 0) {
      results.push(await purgeArchivedForTenant(db, row.tenantId, row.days));
    }
  }
  return results;
}
