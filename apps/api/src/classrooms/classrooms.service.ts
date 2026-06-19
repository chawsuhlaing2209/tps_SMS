import { Injectable, Inject, BadRequestException, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  academicYears,
  attendanceRecords,
  attendanceSessions,
  classroomStudents,
  classroomSubjectTeachers,
  classrooms,
  gradeSubjects,
  grades,
  staff,
  students,
  subjects,
  timetableSlots
} from "../db/schema.js";
import { TeacherAssignmentService } from "../identity/teacher-assignment.service.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import type { CreateClassroomDto, UpdateClassroomDto, AssignClassroomSubjectTeacherDto } from "./dto.js";

@Injectable()
export class ClassroomsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly teacherAssignmentService: TeacherAssignmentService,
    private readonly auditService: AuditService
  ) {}

  private dedupeSubjectsByCode<
    T extends { subjectId: string; subjectCode: string | null }
  >(rows: T[]): T[] {
    const seen = new Set<string>();
    const unique: T[] = [];

    for (const row of rows) {
      const key = row.subjectCode?.trim().toLowerCase() || row.subjectId;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(row);
    }

    return unique;
  }

  async listClassrooms(context: TenantContext) {
    const assignedIds = await this.teacherAssignmentService.assignedClassroomIds(context);

    const [currentYear] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(
        and(eq(academicYears.tenantId, context.tenantId), eq(academicYears.status, "active"))
      )
      .limit(1);

    if (!currentYear) {
      return [];
    }

    const conditions = [
      eq(classrooms.tenantId, context.tenantId),
      eq(classrooms.academicYearId, currentYear.id)
    ];
    if (assignedIds !== null) {
      if (assignedIds.length === 0) {
        return [];
      }
      conditions.push(inArray(classrooms.id, assignedIds));
    }

    return this.db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        academicYearId: classrooms.academicYearId,
        academicYearName: academicYears.name,
        gradeId: classrooms.gradeId,
        gradeName: grades.name,
        sectionId: classrooms.sectionId,
        capacity: classrooms.capacity,
        room: classrooms.room,
        classTeacherStaffId: classrooms.classTeacherStaffId,
        status: classrooms.status,
        updatedAt: classrooms.updatedAt
      })
      .from(classrooms)
      .innerJoin(academicYears, eq(classrooms.academicYearId, academicYears.id))
      .innerJoin(grades, eq(classrooms.gradeId, grades.id))
      .where(and(...conditions))
      .orderBy(classrooms.name);
  }

  async createClassroom(
    tenantId: string,
    dto: CreateClassroomDto,
    actorUserId?: string
  ) {
    const [year] = await this.db
      .select({ id: academicYears.id, status: academicYears.status })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, dto.academicYearId)));

    if (!year) {
      throw new NotFoundException("Academic year not found.");
    }
    if (year.status !== "active") {
      throw new NotFoundException("Classrooms can only be created for the current academic year.");
    }

    const [grade] = await this.db
      .select({ id: grades.id })
      .from(grades)
      .where(and(eq(grades.tenantId, tenantId), eq(grades.id, dto.gradeId)));

    if (!grade) {
      throw new NotFoundException("Grade not found.");
    }

    if (dto.classTeacherStaffId) {
      const [teacher] = await this.db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, dto.classTeacherStaffId)));

      if (!teacher) {
        throw new NotFoundException("Staff member not found.");
      }
    }

    const [classroom] = await this.db
      .insert(classrooms)
      .values({
        tenantId,
        academicYearId: dto.academicYearId,
        gradeId: dto.gradeId,
        name: dto.name,
        capacity: dto.capacity ?? null,
        room: dto.room ?? null,
        classTeacherStaffId: dto.classTeacherStaffId ?? null,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "classroom.create",
      recordType: "Classroom",
      recordId: classroom!.id,
      after: { name: classroom!.name, gradeId: dto.gradeId, academicYearId: dto.academicYearId }
    });

    return classroom;
  }

  private async getClassroomOrThrow(tenantId: string, classroomId: string) {
    const [classroom] = await this.db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)));

    if (!classroom) {
      throw new NotFoundException("Classroom not found.");
    }

    return classroom;
  }

  async updateClassroom(
    tenantId: string,
    classroomId: string,
    dto: UpdateClassroomDto,
    actorUserId?: string
  ) {
    const previous = await this.getClassroomOrThrow(tenantId, classroomId);

    if (dto.academicYearId) {
      const [year] = await this.db
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, dto.academicYearId)));

      if (!year) {
        throw new NotFoundException("Academic year not found.");
      }
    }

    if (dto.gradeId) {
      const [grade] = await this.db
        .select({ id: grades.id })
        .from(grades)
        .where(and(eq(grades.tenantId, tenantId), eq(grades.id, dto.gradeId)));

      if (!grade) {
        throw new NotFoundException("Grade not found.");
      }
    }

    if (dto.classTeacherStaffId) {
      const [teacher] = await this.db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, dto.classTeacherStaffId)));

      if (!teacher) {
        throw new NotFoundException("Staff member not found.");
      }
    }

    const [classroom] = await this.db
      .update(classrooms)
      .set({
        academicYearId: dto.academicYearId ?? previous.academicYearId,
        gradeId: dto.gradeId ?? previous.gradeId,
        name: dto.name ?? previous.name,
        capacity: dto.capacity === undefined ? previous.capacity : dto.capacity,
        room: dto.room === undefined ? previous.room : dto.room,
        classTeacherStaffId:
          dto.classTeacherStaffId === undefined
            ? previous.classTeacherStaffId
            : dto.classTeacherStaffId,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "classroom.update",
      recordType: "Classroom",
      recordId: classroomId,
      before: {
        name: previous.name,
        gradeId: previous.gradeId,
        academicYearId: previous.academicYearId
      },
      after: {
        name: classroom!.name,
        gradeId: classroom!.gradeId,
        academicYearId: classroom!.academicYearId
      }
    });

    return classroom;
  }

  async archiveClassroom(tenantId: string, classroomId: string, actorUserId?: string) {
    const previous = await this.getClassroomOrThrow(tenantId, classroomId);

    if (previous.status === "archived") {
      return previous;
    }

    const [classroom] = await this.db
      .update(classrooms)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "classroom.archive",
      recordType: "Classroom",
      recordId: classroomId,
      before: { status: previous.status },
      after: { status: "archived" }
    });

    return classroom;
  }

  async reactivateClassroom(tenantId: string, classroomId: string, actorUserId?: string) {
    const previous = await this.getClassroomOrThrow(tenantId, classroomId);

    if (previous.status === "active") {
      return previous;
    }

    const [classroom] = await this.db
      .update(classrooms)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "classroom.reactivate",
      recordType: "Classroom",
      recordId: classroomId,
      before: { status: previous.status },
      after: { status: "active" }
    });

    return classroom;
  }

  async getClassroom(context: TenantContext, classroomId: string) {
    const [classroom] = await this.db
      .select()
      .from(classrooms)
      .where(
        and(eq(classrooms.tenantId, context.tenantId), eq(classrooms.id, classroomId))
      );

    if (!classroom) {
      throw new NotFoundException("Classroom not found.");
    }

    return classroom;
  }

  async getClassroomRoomDetail(tenantId: string, classroomId: string) {
    const classroom = await this.getClassroomOrThrow(tenantId, classroomId);

    const [grade] = await this.db
      .select({ id: grades.id, name: grades.name })
      .from(grades)
      .where(and(eq(grades.tenantId, tenantId), eq(grades.id, classroom.gradeId)));

    const [year] = await this.db
      .select({ id: academicYears.id, name: academicYears.name })
      .from(academicYears)
      .where(
        and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, classroom.academicYearId))
      );

    let homeroomTeacher: {
      id: string;
      fullName: string;
      department: string | null;
      employeeNumber: string | null;
    } | null = null;

    if (classroom.classTeacherStaffId) {
      const [teacher] = await this.db
        .select({
          id: staff.id,
          fullName: staff.fullName,
          department: staff.department,
          employeeNumber: staff.employeeNumber
        })
        .from(staff)
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, classroom.classTeacherStaffId)));

      homeroomTeacher = teacher ?? null;
    }

    const [studentCountRow] = await this.db
      .select({ count: sql<number>`count(distinct ${classroomStudents.studentId})::int` })
      .from(classroomStudents)
      .where(
        and(
          eq(classroomStudents.tenantId, tenantId),
          eq(classroomStudents.classroomId, classroomId),
          isNull(classroomStudents.effectiveTo)
        )
      );

    const [attendanceRow] = await this.db
      .select({
        rate: sql<number>`round(
          100.0 * count(*) filter (
            where ${attendanceRecords.status} in ('present', 'late', 'half_day')
          ) / nullif(count(*)::numeric, 0)
        )::int`
      })
      .from(attendanceRecords)
      .innerJoin(
        attendanceSessions,
        eq(attendanceRecords.attendanceSessionId, attendanceSessions.id)
      )
      .where(
        and(
          eq(attendanceRecords.tenantId, tenantId),
          eq(attendanceSessions.classroomId, classroomId),
          sql`${attendanceSessions.submittedAt} IS NOT NULL`
        )
      );

    const subjectRows = await this.db
      .select({
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        subjectColorKey: subjects.colorKey,
        teacherStaffId: classroomSubjectTeachers.teacherStaffId,
        teacherName: staff.fullName
      })
      .from(gradeSubjects)
      .innerJoin(subjects, eq(gradeSubjects.subjectId, subjects.id))
      .leftJoin(
        classroomSubjectTeachers,
        and(
          eq(classroomSubjectTeachers.tenantId, tenantId),
          eq(classroomSubjectTeachers.classroomId, classroomId),
          eq(classroomSubjectTeachers.subjectId, subjects.id)
        )
      )
      .leftJoin(staff, eq(classroomSubjectTeachers.teacherStaffId, staff.id))
      .where(
        and(
          eq(gradeSubjects.tenantId, tenantId),
          eq(gradeSubjects.academicYearId, classroom.academicYearId),
          eq(gradeSubjects.gradeId, classroom.gradeId)
        )
      )
      .orderBy(subjects.name);

    const uniqueSubjects = this.dedupeSubjectsByCode(subjectRows);

    const slotCounts = await this.db
      .select({
        subjectId: timetableSlots.subjectId,
        count: sql<number>`count(*)::int`
      })
      .from(timetableSlots)
      .where(
        and(
          eq(timetableSlots.tenantId, tenantId),
          eq(timetableSlots.classroomId, classroomId),
          sql`${timetableSlots.publishedAt} IS NOT NULL`
        )
      )
      .groupBy(timetableSlots.subjectId);

    const periodsBySubject = new Map(slotCounts.map((row) => [row.subjectId, row.count]));

    return {
      id: classroom.id,
      name: classroom.name,
      room: classroom.room,
      capacity: classroom.capacity,
      status: classroom.status,
      gradeId: classroom.gradeId,
      gradeName: grade?.name ?? null,
      academicYearId: classroom.academicYearId,
      academicYearName: year?.name ?? null,
      classTeacherStaffId: classroom.classTeacherStaffId,
      homeroomTeacher,
      studentCount: studentCountRow?.count ?? 0,
      avgAttendanceRate: attendanceRow?.rate ?? null,
      subjects: uniqueSubjects.map((row) => ({
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        subjectCode: row.subjectCode,
        subjectColorKey: row.subjectColorKey,
        teacherStaffId: row.teacherStaffId,
        teacherName: row.teacherName,
        periodsPerWeek: periodsBySubject.get(row.subjectId) ?? 0
      }))
    };
  }

  async listClassroomSubjects(context: TenantContext, classroomId: string) {
    const assignedIds = await this.teacherAssignmentService.assignedClassroomIds(context);

    if (assignedIds !== null && !assignedIds.includes(classroomId)) {
      return [];
    }

    const classroom = await this.getClassroom(context, classroomId);

    const rows = await this.db
      .select({
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherStaffId: classroomSubjectTeachers.teacherStaffId
      })
      .from(gradeSubjects)
      .innerJoin(subjects, eq(gradeSubjects.subjectId, subjects.id))
      .leftJoin(
        classroomSubjectTeachers,
        and(
          eq(classroomSubjectTeachers.tenantId, context.tenantId),
          eq(classroomSubjectTeachers.classroomId, classroomId),
          eq(classroomSubjectTeachers.subjectId, subjects.id)
        )
      )
      .where(
        and(
          eq(gradeSubjects.tenantId, context.tenantId),
          eq(gradeSubjects.academicYearId, classroom.academicYearId),
          eq(gradeSubjects.gradeId, classroom.gradeId)
        )
      )
      .orderBy(subjects.name);

    const curriculum = this.dedupeSubjectsByCode(rows);

    if (assignedIds === null) {
      return curriculum;
    }

    const staffId = await this.teacherAssignmentService.resolveStaffId(
      context.tenantId,
      context.actorUserId
    );

    if (!staffId) {
      return [];
    }

    const isClassTeacher = await this.teacherAssignmentService.isClassTeacher(
      context.tenantId,
      staffId,
      classroomId
    );

    const isGradeChief = await this.teacherAssignmentService.isGradeChiefOfClassroom(
      context.tenantId,
      staffId,
      classroomId
    );

    if (isClassTeacher || isGradeChief) {
      return curriculum;
    }

    return curriculum.filter((row) => row.teacherStaffId === staffId);
  }

  private async listGradeSubjectSummaries(
    tenantId: string,
    academicYearId: string,
    gradeId: string
  ) {
    const rows = await this.db
      .select({
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
        colorKey: subjects.colorKey
      })
      .from(gradeSubjects)
      .innerJoin(subjects, eq(gradeSubjects.subjectId, subjects.id))
      .where(
        and(
          eq(gradeSubjects.tenantId, tenantId),
          eq(gradeSubjects.academicYearId, academicYearId),
          eq(gradeSubjects.gradeId, gradeId)
        )
      )
      .orderBy(subjects.name);

    const seen = new Set<string>();
    const unique: { id: string; name: string; code: string | null; colorKey: string | null }[] = [];

    for (const row of rows) {
      const key = row.code?.trim().toLowerCase() || row.id;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(row);
    }

    return unique;
  }

  async listClassroomsForGrade(
    tenantId: string,
    academicYearId: string,
    gradeId: string
  ) {
    const rows = await this.db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        room: classrooms.room,
        capacity: classrooms.capacity,
        status: classrooms.status,
        updatedAt: classrooms.updatedAt,
        classTeacherStaffId: classrooms.classTeacherStaffId,
        classTeacherName: staff.fullName
      })
      .from(classrooms)
      .leftJoin(staff, eq(classrooms.classTeacherStaffId, staff.id))
      .where(
        and(
          eq(classrooms.tenantId, tenantId),
          eq(classrooms.academicYearId, academicYearId),
          eq(classrooms.gradeId, gradeId)
        )
      )
      .orderBy(classrooms.name);

    const withCounts = await this.attachStudentCounts(tenantId, rows);
    const subjects = await this.listGradeSubjectSummaries(tenantId, academicYearId, gradeId);

    return withCounts.map((row) => ({ ...row, subjects }));
  }

  async listClassroomsForYear(tenantId: string, academicYearId: string) {
    const [year] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)));

    if (!year) {
      throw new NotFoundException("Academic year not found.");
    }

    const rows = await this.db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        room: classrooms.room,
        capacity: classrooms.capacity,
        status: classrooms.status,
        updatedAt: classrooms.updatedAt,
        gradeId: classrooms.gradeId,
        gradeName: grades.name,
        academicYearId: classrooms.academicYearId
      })
      .from(classrooms)
      .innerJoin(grades, eq(classrooms.gradeId, grades.id))
      .where(
        and(eq(classrooms.tenantId, tenantId), eq(classrooms.academicYearId, academicYearId))
      )
      .orderBy(grades.name, classrooms.name);

    return this.attachStudentCounts(tenantId, rows);
  }

  private async attachStudentCounts<
    T extends { id: string; updatedAt?: Date | null }
  >(tenantId: string, rows: T[]) {
    const results = [];

    for (const row of rows) {
      const [countRow] = await this.db
        .select({ count: sql<number>`count(distinct ${classroomStudents.studentId})::int` })
        .from(classroomStudents)
        .where(
          and(
            eq(classroomStudents.tenantId, tenantId),
            eq(classroomStudents.classroomId, row.id),
            isNull(classroomStudents.effectiveTo)
          )
        );

      results.push({ ...row, studentCount: countRow?.count ?? 0 });
    }

    return results;
  }

  async listClassroomStudents(tenantId: string, classroomId: string) {
    await this.getClassroomOrThrow(tenantId, classroomId);

    return this.db
      .select({
        id: students.id,
        fullName: students.fullName,
        admissionNumber: students.admissionNumber,
        status: students.status
      })
      .from(classroomStudents)
      .innerJoin(students, eq(classroomStudents.studentId, students.id))
      .where(
        and(
          eq(classroomStudents.tenantId, tenantId),
          eq(classroomStudents.classroomId, classroomId),
          isNull(classroomStudents.effectiveTo)
        )
      )
      .orderBy(students.fullName);
  }

  async assignSubjectTeacher(
    tenantId: string,
    classroomId: string,
    subjectId: string,
    dto: AssignClassroomSubjectTeacherDto,
    actorUserId?: string
  ) {
    const classroom = await this.getClassroomOrThrow(tenantId, classroomId);

    const [mapping] = await this.db
      .select({ id: gradeSubjects.id })
      .from(gradeSubjects)
      .where(
        and(
          eq(gradeSubjects.tenantId, tenantId),
          eq(gradeSubjects.academicYearId, classroom.academicYearId),
          eq(gradeSubjects.gradeId, classroom.gradeId),
          eq(gradeSubjects.subjectId, subjectId)
        )
      );

    if (!mapping) {
      throw new BadRequestException(
        "Subject is not part of this classroom's grade curriculum for the academic year."
      );
    }

    if (dto.teacherStaffId) {
      const [member] = await this.db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, dto.teacherStaffId)));

      if (!member) {
        throw new NotFoundException("Staff member not found.");
      }
    }

    const [previous] = await this.db
      .select({
        id: classroomSubjectTeachers.id,
        teacherStaffId: classroomSubjectTeachers.teacherStaffId
      })
      .from(classroomSubjectTeachers)
      .where(
        and(
          eq(classroomSubjectTeachers.tenantId, tenantId),
          eq(classroomSubjectTeachers.classroomId, classroomId),
          eq(classroomSubjectTeachers.subjectId, subjectId)
        )
      );

    await this.db
      .delete(classroomSubjectTeachers)
      .where(
        and(
          eq(classroomSubjectTeachers.tenantId, tenantId),
          eq(classroomSubjectTeachers.classroomId, classroomId),
          eq(classroomSubjectTeachers.subjectId, subjectId)
        )
      );

    if (dto.teacherStaffId) {
      await this.db.insert(classroomSubjectTeachers).values({
        tenantId,
        classroomId,
        subjectId,
        teacherStaffId: dto.teacherStaffId,
        createdBy: actorUserId,
        updatedBy: actorUserId
      });
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "classroom_subject_teacher.assign",
      recordType: "Classroom",
      recordId: classroomId,
      before: previous
        ? { subjectId, teacherStaffId: previous.teacherStaffId }
        : undefined,
      after: { subjectId, teacherStaffId: dto.teacherStaffId ?? null }
    });

    return {
      classroomId,
      subjectId,
      teacherStaffId: dto.teacherStaffId ?? null
    };
  }
}
