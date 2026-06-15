import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  academicYears,
  classroomSubjectTeachers,
  classrooms,
  grades,
  subjects
} from "../db/schema.js";
import { TeacherAssignmentService } from "../identity/teacher-assignment.service.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import type { CreateClassroomDto, UpdateClassroomDto } from "./dto.js";

@Injectable()
export class ClassroomsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly teacherAssignmentService: TeacherAssignmentService,
    private readonly auditService: AuditService
  ) {}

  async listClassrooms(context: TenantContext) {
    const assignedIds = await this.teacherAssignmentService.assignedClassroomIds(context);

    const conditions = [eq(classrooms.tenantId, context.tenantId)];
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
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, dto.academicYearId)));

    if (!year) {
      throw new NotFoundException("Academic year not found.");
    }

    const [grade] = await this.db
      .select({ id: grades.id })
      .from(grades)
      .where(and(eq(grades.tenantId, tenantId), eq(grades.id, dto.gradeId)));

    if (!grade) {
      throw new NotFoundException("Grade not found.");
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

    const [classroom] = await this.db
      .update(classrooms)
      .set({
        academicYearId: dto.academicYearId ?? previous.academicYearId,
        gradeId: dto.gradeId ?? previous.gradeId,
        name: dto.name ?? previous.name,
        capacity: dto.capacity === undefined ? previous.capacity : dto.capacity,
        room: dto.room === undefined ? previous.room : dto.room,
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

  async listClassroomSubjects(context: TenantContext, classroomId: string) {
    const assignedIds = await this.teacherAssignmentService.assignedClassroomIds(context);

    if (assignedIds !== null && !assignedIds.includes(classroomId)) {
      return [];
    }

    const rows = await this.db
      .select({
        subjectId: classroomSubjectTeachers.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherStaffId: classroomSubjectTeachers.teacherStaffId
      })
      .from(classroomSubjectTeachers)
      .innerJoin(subjects, eq(classroomSubjectTeachers.subjectId, subjects.id))
      .where(
        and(
          eq(classroomSubjectTeachers.tenantId, context.tenantId),
          eq(classroomSubjectTeachers.classroomId, classroomId)
        )
      )
      .orderBy(subjects.name);

    if (assignedIds === null) {
      return rows;
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
      return rows;
    }

    return rows.filter((row) => row.teacherStaffId === staffId);
  }
}
