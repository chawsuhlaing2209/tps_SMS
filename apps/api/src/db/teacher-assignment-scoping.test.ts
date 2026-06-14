import argon2 from "argon2";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { RbacService } from "../identity/rbac.service.js";
import { TeacherAssignmentService } from "../identity/teacher-assignment.service.js";
import * as schema from "./schema.js";
import {
  academicYears,
  attendanceRecords,
  attendanceSessions,
  classroomSubjectTeachers,
  classrooms,
  grades,
  roles,
  sections,
  staff,
  subjects,
  tenants,
  userRoles,
  users
} from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("teacher assignment scoping", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const teacherAssignmentService = new TeacherAssignmentService(db, new RbacService());

  const suffix = `scope-${Date.now()}`;
  const slug = `${suffix}-school`;
  let tenantId = "";
  let classroomAId = "";
  let classroomBId = "";
  let subjectId = "";
  let teacherUserId = "";
  let adminUserId = "";
  let attendanceSessionId = "";
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const passwordHash = await argon2.hash("ChangeMe123!", { type: argon2.argon2id });

    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Scope Test School", slug, status: "active" })
      .returning({ id: tenants.id });

    tenantId = tenant!.id;

    const [year] = await db
      .insert(academicYears)
      .values({
        tenantId,
        name: "2026-2027",
        startsOn: "2026-06-01",
        endsOn: "2027-03-31",
        status: "active"
      })
      .returning({ id: academicYears.id });

    const [grade] = await db
      .insert(grades)
      .values({ tenantId, name: "Grade 1", sortOrder: 1 })
      .returning({ id: grades.id });

    const [section] = await db
      .insert(sections)
      .values({ tenantId, name: "A" })
      .returning({ id: sections.id });

    const [subject] = await db
      .insert(subjects)
      .values({ tenantId, name: "Mathematics", code: "MATH" })
      .returning({ id: subjects.id });

    subjectId = subject!.id;

    const [classroomA] = await db
      .insert(classrooms)
      .values({
        tenantId,
        academicYearId: year!.id,
        gradeId: grade!.id,
        sectionId: section!.id,
        name: "Grade 1 A",
        status: "active"
      })
      .returning({ id: classrooms.id });

    const [classroomB] = await db
      .insert(classrooms)
      .values({
        tenantId,
        academicYearId: year!.id,
        gradeId: grade!.id,
        sectionId: section!.id,
        name: "Grade 1 B",
        status: "active"
      })
      .returning({ id: classrooms.id });

    classroomAId = classroomA!.id;
    classroomBId = classroomB!.id;

    const [teacherRole] = await db
      .insert(roles)
      .values({
        tenantId,
        key: "teacher",
        name: "Teacher",
        permissions: ["student.view", "attendance.mark"]
      })
      .returning({ id: roles.id });

    const [adminRole] = await db
      .insert(roles)
      .values({
        tenantId,
        key: "school_admin",
        name: "School Admin",
        permissions: ["student.manage", "classroom.manage", "attendance.audit.view"]
      })
      .returning({ id: roles.id });

    const [teacherUser] = await db
      .insert(users)
      .values({
        tenantId,
        email: `teacher@${slug}.example.edu.mm`,
        displayName: "Assigned Teacher",
        status: "active",
        passwordHash
      })
      .returning({ id: users.id });

    const [adminUser] = await db
      .insert(users)
      .values({
        tenantId,
        email: `admin@${slug}.example.edu.mm`,
        displayName: "School Admin",
        status: "active",
        passwordHash
      })
      .returning({ id: users.id });

    teacherUserId = teacherUser!.id;
    adminUserId = adminUser!.id;
    createdUserIds.push(teacherUserId, adminUserId);

    const [teacherStaff] = await db
      .insert(staff)
      .values({
        tenantId,
        userId: teacherUserId,
        fullName: "Assigned Teacher",
        employmentRole: "teacher",
        status: "active"
      })
      .returning({ id: staff.id });

    await db.insert(userRoles).values([
      { tenantId, userId: teacherUserId, roleId: teacherRole!.id },
      { tenantId, userId: adminUserId, roleId: adminRole!.id }
    ]);

    await db.insert(classroomSubjectTeachers).values({
      tenantId,
      classroomId: classroomAId,
      subjectId,
      teacherStaffId: teacherStaff!.id
    });

    const [session] = await db
      .insert(attendanceSessions)
      .values({
        tenantId,
        classroomId: classroomAId,
        subjectId,
        sessionDate: "2026-06-15"
      })
      .returning({ id: attendanceSessions.id });

    attendanceSessionId = session!.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await db.delete(attendanceRecords).where(eq(attendanceRecords.tenantId, tenantId));
      await db.delete(attendanceSessions).where(eq(attendanceSessions.tenantId, tenantId));
      await db.delete(classroomSubjectTeachers).where(eq(classroomSubjectTeachers.tenantId, tenantId));
      await db.delete(classrooms).where(eq(classrooms.tenantId, tenantId));
      await db.delete(staff).where(eq(staff.tenantId, tenantId));
      if (createdUserIds.length > 0) {
        await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
      await db.delete(roles).where(eq(roles.tenantId, tenantId));
      await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
      await db.delete(sections).where(eq(sections.tenantId, tenantId));
      await db.delete(grades).where(eq(grades.tenantId, tenantId));
      await db.delete(academicYears).where(eq(academicYears.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
    await pool.end();
  });

  it("limits teachers to assigned classrooms", async () => {
    const teacherContext = {
      tenantId,
      tenantSlug: slug,
      actorUserId: teacherUserId,
      roles: ["teacher"],
      permissions: ["student.view", "attendance.mark"]
    };

    const assigned = await teacherAssignmentService.assignedClassroomIds(teacherContext);
    expect(assigned).toEqual([classroomAId]);

    await expect(
      teacherAssignmentService.assertClassroomAccess(teacherContext, classroomBId)
    ).rejects.toThrow(/assigned classes and subjects/);
  });

  it("allows admins to bypass assignment scoping", async () => {
    const adminContext = {
      tenantId,
      tenantSlug: slug,
      actorUserId: adminUserId,
      roles: ["school_admin"],
      permissions: ["student.manage", "classroom.manage", "attendance.audit.view"]
    };

    expect(teacherAssignmentService.requiresAssignmentScoping(adminContext)).toBe(false);

    await expect(
      teacherAssignmentService.assertClassroomAccess(adminContext, classroomBId)
    ).resolves.toBeUndefined();
  });

  it("scopes attendance session reads to assigned classroom subjects", async () => {
    const teacherContext = {
      tenantId,
      tenantSlug: slug,
      actorUserId: teacherUserId,
      roles: ["teacher"],
      permissions: ["attendance.mark"]
    };

    await expect(
      teacherAssignmentService.assertAttendanceSessionAccess(teacherContext, attendanceSessionId)
    ).resolves.toBeUndefined();

    const [otherSession] = await db
      .insert(attendanceSessions)
      .values({
        tenantId,
        classroomId: classroomBId,
        subjectId,
        sessionDate: "2026-06-16"
      })
      .returning({ id: attendanceSessions.id });

    await expect(
      teacherAssignmentService.assertAttendanceSessionAccess(teacherContext, otherSession!.id)
    ).rejects.toThrow(/assigned classes and subjects/);
  });
});
