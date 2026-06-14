import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import {
  classroomSubjectTeachers,
  classrooms,
  subjects
} from "../db/schema.js";
import { TeacherAssignmentService } from "../identity/teacher-assignment.service.js";
import type { TenantContext } from "../tenancy/tenant-context.js";

@Injectable()
export class ClassroomsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly teacherAssignmentService: TeacherAssignmentService
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
        gradeId: classrooms.gradeId,
        sectionId: classrooms.sectionId,
        capacity: classrooms.capacity,
        room: classrooms.room,
        classTeacherStaffId: classrooms.classTeacherStaffId,
        status: classrooms.status
      })
      .from(classrooms)
      .where(and(...conditions))
      .orderBy(classrooms.name);
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

    if (isClassTeacher) {
      return rows;
    }

    return rows.filter((row) => row.teacherStaffId === staffId);
  }
}
