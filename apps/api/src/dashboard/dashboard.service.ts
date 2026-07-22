import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import {
  academicYears,
  classrooms,
  classroomStudents,
  enquiries,
  enrollmentFeePlans,
  examSchedules,
  feeItems,
  gradeSubjects,
  grades,
  invoices,
  payments,
  staff,
  studentDiscounts,
  students,
  subjects,
  tenantSettings,
  terms,
  timetablePeriods,
  timetableSlots
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

export type DashboardHome = {
  academicYear: { id: string; name: string } | null;
  schoolName: string;
  currentTerm: { id: string; name: string; startsOn: string; endsOn: string } | null;
  termProgressPercent: number;
  weekLabel: string;
  approvals: { total: number; leave: number; feeWaivers: number };
  classrooms: Array<{
    id: string;
    name: string;
    homeroomTeacherName: string | null;
    studentCount: number;
  }>;
  todaySchedule: Array<{
    timeLabel: string;
    subjectName: string;
    classroomName: string;
  }>;
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

  private todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private jsDayToTimetableDay(): number {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }

  private computeTermProgress(term: { startsOn: string; endsOn: string }): {
    termProgressPercent: number;
    weekLabel: string;
  } {
    const start = new Date(`${term.startsOn}T00:00:00`);
    const end = new Date(`${term.endsOn}T00:00:00`);
    const today = new Date(`${this.todayIsoDate()}T00:00:00`);

    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = today.getTime() - start.getTime();
    const termProgressPercent =
      totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 0;

    const weekNumber = Math.max(1, Math.ceil(elapsedMs / (7 * 24 * 60 * 60 * 1000)));
    return { termProgressPercent, weekLabel: `Week ${weekNumber}` };
  }

  private async resolveCurrentTerm(tenantId: string, academicYearId: string) {
    const today = this.todayIsoDate();

    const [activeTerm] = await this.db
      .select({
        id: terms.id,
        name: terms.name,
        startsOn: terms.startsOn,
        endsOn: terms.endsOn
      })
      .from(terms)
      .where(
        and(
          eq(terms.tenantId, tenantId),
          eq(terms.academicYearId, academicYearId),
          sql`${terms.startsOn} <= ${today}`,
          sql`${terms.endsOn} >= ${today}`
        )
      )
      .orderBy(terms.startsOn)
      .limit(1);

    if (activeTerm) {
      return activeTerm;
    }

    const [upcomingTerm] = await this.db
      .select({
        id: terms.id,
        name: terms.name,
        startsOn: terms.startsOn,
        endsOn: terms.endsOn
      })
      .from(terms)
      .where(and(eq(terms.tenantId, tenantId), eq(terms.academicYearId, academicYearId)))
      .orderBy(terms.startsOn)
      .limit(1);

    return upcomingTerm ?? null;
  }

  /** Lightweight brand payload for the sidebar — readable by every tenant role. */
  async getSchoolBrand(tenantId: string) {
    const [settings] = await this.db
      .select({
        schoolName: tenantSettings.schoolName,
        logoFileId: tenantSettings.logoFileId
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    return {
      schoolName: settings?.schoolName ?? null,
      logoFileId: settings?.logoFileId ?? null
    };
  }

  async getHome(tenantId: string): Promise<DashboardHome> {
    const today = this.todayIsoDate();
    const dayOfWeek = this.jsDayToTimetableDay();

    const [year, settings] = await Promise.all([
      this.getCurrentAcademicYear(tenantId),
      this.db
        .select({ schoolName: tenantSettings.schoolName })
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, tenantId))
        .limit(1)
    ]);

    const schoolName = settings[0]?.schoolName ?? "School";
    const academicYear = year ? { id: year.id, name: year.name } : null;

    let currentTerm: DashboardHome["currentTerm"] = null;
    let termProgressPercent = 0;
    let weekLabel = "Week 1";

    if (year) {
      currentTerm = await this.resolveCurrentTerm(tenantId, year.id);
      if (currentTerm) {
        const progress = this.computeTermProgress(currentTerm);
        termProgressPercent = progress.termProgressPercent;
        weekLabel = progress.weekLabel;
      }
    }

    const [feeWaiversRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentDiscounts)
      .where(and(eq(studentDiscounts.tenantId, tenantId), eq(studentDiscounts.status, "submitted")));

    const feeWaivers = feeWaiversRow?.count ?? 0;
    const leave = 0;
    const approvals = { total: feeWaivers + leave, leave, feeWaivers };

    let classroomRows: DashboardHome["classrooms"] = [];
    if (year) {
      const rows = await this.db
        .select({
          id: classrooms.id,
          name: classrooms.name,
          homeroomTeacherName: staff.fullName,
          studentCount: sql<number>`count(distinct ${classroomStudents.studentId})::int`
        })
        .from(classrooms)
        .leftJoin(staff, eq(classrooms.classTeacherStaffId, staff.id))
        .leftJoin(
          classroomStudents,
          and(
            eq(classroomStudents.classroomId, classrooms.id),
            eq(classroomStudents.tenantId, tenantId),
            isNull(classroomStudents.effectiveTo)
          )
        )
        .where(
          and(
            eq(classrooms.tenantId, tenantId),
            eq(classrooms.academicYearId, year.id),
            eq(classrooms.status, "active")
          )
        )
        .groupBy(classrooms.id, classrooms.name, staff.fullName, classrooms.updatedAt)
        .orderBy(classrooms.name)
        .limit(6);

      classroomRows = rows.map((row) => ({
        id: row.id,
        name: row.name,
        homeroomTeacherName: row.homeroomTeacherName,
        studentCount: row.studentCount ?? 0
      }));
    }

    let todaySchedule: DashboardHome["todaySchedule"] = [];
    if (year) {
      const slots = await this.db
        .select({
          startsAt: timetablePeriods.startsAt,
          endsAt: timetablePeriods.endsAt,
          subjectName: subjects.name,
          classroomName: classrooms.name,
          sortOrder: timetablePeriods.sortOrder
        })
        .from(timetableSlots)
        .innerJoin(timetablePeriods, eq(timetableSlots.periodId, timetablePeriods.id))
        .innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
        .innerJoin(classrooms, eq(timetableSlots.classroomId, classrooms.id))
        .where(
          and(
            eq(timetableSlots.tenantId, tenantId),
            eq(timetableSlots.dayOfWeek, dayOfWeek),
            eq(timetablePeriods.academicYearId, year.id),
            isNotNull(timetableSlots.publishedAt),
            eq(timetablePeriods.isBreak, false),
            sql`${timetableSlots.effectiveFrom} <= ${today}`,
            or(isNull(timetableSlots.effectiveTo), sql`${timetableSlots.effectiveTo} >= ${today}`)
          )
        )
        .orderBy(timetablePeriods.sortOrder)
        .limit(12);

      todaySchedule = slots.map((slot) => ({
        timeLabel: `${slot.startsAt} – ${slot.endsAt}`,
        subjectName: slot.subjectName,
        classroomName: slot.classroomName
      }));
    }

    return {
      academicYear,
      schoolName,
      currentTerm,
      termProgressPercent,
      weekLabel,
      approvals,
      classrooms: classroomRows,
      todaySchedule
    };
  }

  /**
   * Actionable notifications for the top-bar bell, derived from pending work
   * queues (no notifications table). Each source is gated by the actor's
   * permissions so e.g. teachers never receive finance items.
   */
  async getNotifications(tenantId: string, permissions: string[]) {
    const canFinance = permissions.includes("finance.manage");
    const canAdmissions = permissions.includes("admissions.manage");

    const [discountRows, paymentRows, enquiryRows] = await Promise.all([
      canFinance
        ? this.db
            .select({
              id: studentDiscounts.id,
              name: students.fullName,
              createdAt: studentDiscounts.createdAt
            })
            .from(studentDiscounts)
            .leftJoin(students, eq(studentDiscounts.studentId, students.id))
            .where(
              and(eq(studentDiscounts.tenantId, tenantId), eq(studentDiscounts.status, "submitted"))
            )
            .orderBy(desc(studentDiscounts.createdAt))
            .limit(10)
        : Promise.resolve([]),
      canFinance
        ? this.db
            .select({
              id: payments.id,
              name: students.fullName,
              amount: payments.amount,
              createdAt: payments.createdAt
            })
            .from(payments)
            .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
            .leftJoin(students, eq(invoices.studentId, students.id))
            .where(
              and(
                eq(payments.tenantId, tenantId),
                eq(payments.kind, "payment"),
                isNull(payments.verifiedAt)
              )
            )
            .orderBy(desc(payments.createdAt))
            .limit(10)
        : Promise.resolve([]),
      canAdmissions
        ? this.db
            .select({
              id: enquiries.id,
              name: enquiries.prospectiveStudentName,
              createdAt: enquiries.createdAt
            })
            .from(enquiries)
            .where(and(eq(enquiries.tenantId, tenantId), eq(enquiries.status, "new")))
            .orderBy(desc(enquiries.createdAt))
            .limit(10)
        : Promise.resolve([])
    ]);

    const items = [
      ...discountRows.map((row) => ({
        id: `discount-${row.id}`,
        type: "discountRequest" as const,
        name: row.name ?? "",
        amount: null as number | null,
        href: "/dashboard/finance/discounts",
        createdAt: row.createdAt
      })),
      ...paymentRows.map((row) => ({
        id: `payment-${row.id}`,
        type: "paymentUnverified" as const,
        name: row.name ?? "",
        amount: Number(row.amount),
        href: "/dashboard/finance/payments",
        createdAt: row.createdAt
      })),
      ...enquiryRows.map((row) => ({
        id: `enquiry-${row.id}`,
        type: "newEnquiry" as const,
        name: row.name,
        amount: null as number | null,
        href: "/dashboard/admissions",
        createdAt: row.createdAt
      }))
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15);

    return { items, total: items.length };
  }
}
