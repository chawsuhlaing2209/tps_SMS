import { ConflictException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AuditService } from "../audit/audit.service.js";
import type { ClassroomsService } from "../classrooms/classrooms.service.js";
import * as schema from "../db/schema.js";
import {
  academicYears,
  classrooms,
  gradeSubjects,
  grades,
  staff,
  subjects,
  tenants,
  timetablePeriods,
  timetableSlots,
  users
} from "../db/schema.js";
import { SchoolScheduleService } from "../school-schedule/school-schedule.service.js";
import { TimetableService } from "./timetable.service.js";

const databaseUrl = process.env.DATABASE_URL;

const classroomsService = {
  async listEligibleSubjectTeachers(
    _tenantId: string,
    _classroomId: string,
    _subjectId: string,
    includeStaffId?: string | null
  ) {
    if (!includeStaffId) {
      return { data: [] };
    }
    return { data: [{ id: includeStaffId, fullName: "Teacher" }] };
  }
} as ClassroomsService;

describe.skipIf(!databaseUrl)("TimetableService schedule conflicts", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const auditService = new AuditService(db);
  const schoolScheduleService = new SchoolScheduleService(db, auditService);
  const service = new TimetableService(db, auditService, schoolScheduleService, classroomsService);

  const suffix = `tt-conflict-${Date.now()}`;
  let tenantId = "";
  let actorUserId = "";
  let academicYearId = "";
  let classroomAId = "";
  let classroomBId = "";
  let subjectId = "";
  let teacherStaffId = "";
  let periodId = "";

  beforeAll(async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Timetable Conflict School", slug: `${suffix}-school`, status: "active" })
      .returning({ id: tenants.id });
    tenantId = tenant!.id;

    const [actor] = await db
      .insert(users)
      .values({
        tenantId,
        email: `owner@${suffix}.example.edu.mm`,
        displayName: "Owner",
        status: "active"
      })
      .returning({ id: users.id });
    actorUserId = actor!.id;

    const [year] = await db
      .insert(academicYears)
      .values({
        tenantId,
        name: "2026",
        startsOn: "2026-01-01",
        endsOn: "2026-12-31",
        status: "active"
      })
      .returning({ id: academicYears.id });
    academicYearId = year!.id;

    const [grade] = await db
      .insert(grades)
      .values({ tenantId, name: "Grade 5", sortOrder: 5, status: "active" })
      .returning({ id: grades.id });

    const [classroomA, classroomB] = await db
      .insert(classrooms)
      .values([
        {
          tenantId,
          academicYearId,
          gradeId: grade!.id,
          name: "G5-A",
          status: "active"
        },
        {
          tenantId,
          academicYearId,
          gradeId: grade!.id,
          name: "G5-B",
          status: "active"
        }
      ])
      .returning({ id: classrooms.id });
    classroomAId = classroomA!.id;
    classroomBId = classroomB!.id;

    const [subject] = await db
      .insert(subjects)
      .values({ tenantId, name: "Mathematics", code: "MATH", status: "active" })
      .returning({ id: subjects.id });
    subjectId = subject!.id;

    await db.insert(gradeSubjects).values({
      tenantId,
      academicYearId,
      gradeId: grade!.id,
      subjectId
    });

    const [teacherUser] = await db
      .insert(users)
      .values({
        tenantId,
        email: `teacher@${suffix}.example.edu.mm`,
        displayName: "Teacher One",
        status: "active"
      })
      .returning({ id: users.id });

    const [teacher] = await db
      .insert(staff)
      .values({
        tenantId,
        userId: teacherUser!.id,
        fullName: "Teacher One",
        employmentRole: "teacher",
        status: "active"
      })
      .returning({ id: staff.id });
    teacherStaffId = teacher!.id;

    const [period] = await db
      .insert(timetablePeriods)
      .values({
        tenantId,
        academicYearId,
        name: "P1",
        startsAt: "08:00",
        endsAt: "08:45",
        sortOrder: 1,
        periodType: "lesson",
        isBreak: false,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning({ id: timetablePeriods.id });
    periodId = period!.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await db.delete(timetableSlots).where(eq(timetableSlots.tenantId, tenantId));
      await db.delete(timetablePeriods).where(eq(timetablePeriods.tenantId, tenantId));
      await db.delete(classrooms).where(eq(classrooms.tenantId, tenantId));
      await db.delete(gradeSubjects).where(eq(gradeSubjects.tenantId, tenantId));
      await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
      await db.delete(staff).where(eq(staff.tenantId, tenantId));
      await db.delete(grades).where(eq(grades.tenantId, tenantId));
      await db.delete(academicYears).where(eq(academicYears.tenantId, tenantId));
      await db.delete(users).where(eq(users.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
    await pool.end();
  });

  it("rejects creating a second class for the same teacher at the same day and period", async () => {
    await db
      .delete(timetableSlots)
      .where(and(eq(timetableSlots.tenantId, tenantId), eq(timetableSlots.classroomId, classroomAId)));

    await service.createSlot(tenantId, actorUserId, {
      classroomId: classroomAId,
      subjectId,
      staffId: teacherStaffId,
      periodId,
      dayOfWeek: 1
    });

    await expect(
      service.createSlot(tenantId, actorUserId, {
        classroomId: classroomBId,
        subjectId,
        staffId: teacherStaffId,
        periodId,
        dayOfWeek: 1
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects updating a slot when the teacher already has another class at that time", async () => {
    const first = await service.createSlot(tenantId, actorUserId, {
      classroomId: classroomAId,
      subjectId,
      staffId: teacherStaffId,
      periodId,
      dayOfWeek: 2
    });

    const second = await service.createSlot(tenantId, actorUserId, {
      classroomId: classroomBId,
      subjectId,
      periodId,
      dayOfWeek: 2
    });

    await expect(
      service.updateSlot(tenantId, second!.id, actorUserId, {
        subjectId,
        staffId: teacherStaffId
      })
    ).rejects.toBeInstanceOf(ConflictException);

    await db.delete(timetableSlots).where(eq(timetableSlots.id, first!.id));
    await db.delete(timetableSlots).where(eq(timetableSlots.id, second!.id));
  });

  it("rejects publishing when duplicate teacher schedules exist", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await db.insert(timetableSlots).values([
      {
        tenantId,
        classroomId: classroomAId,
        subjectId,
        teacherStaffId,
        periodId,
        dayOfWeek: 3,
        effectiveFrom: today,
        createdBy: actorUserId,
        updatedBy: actorUserId
      },
      {
        tenantId,
        classroomId: classroomBId,
        subjectId,
        teacherStaffId,
        periodId,
        dayOfWeek: 3,
        effectiveFrom: today,
        createdBy: actorUserId,
        updatedBy: actorUserId
      }
    ]);

    await expect(
      service.publishTimetable(tenantId, actorUserId, { academicYearId })
    ).rejects.toBeInstanceOf(ConflictException);

    await db
      .delete(timetableSlots)
      .where(and(eq(timetableSlots.tenantId, tenantId), eq(timetableSlots.dayOfWeek, 3)));
  });
});
