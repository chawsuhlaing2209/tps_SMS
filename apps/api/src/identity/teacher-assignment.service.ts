import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Permission } from "@sms/shared";
import { and, eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module.js";
import {
  attendanceSessions,
  classroomSubjectTeachers,
  classrooms,
  gradeChiefAssignments,
  staff
} from "../db/schema.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import { RbacService } from "./rbac.service.js";
import type { TeacherScopeOptions } from "./teacher-scope.decorator.js";

/** Roles with these permissions bypass teacher assignment filters. */
const BYPASS_ASSIGNMENT_SCOPING: Permission[] = [
  "classroom.manage",
  "academic_setup.manage",
  "student.manage"
];

interface ScopedRequest {
  params?: Record<string, string | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

@Injectable()
export class TeacherAssignmentService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly rbac: RbacService
  ) {}

  requiresAssignmentScoping(context: TenantContext): boolean {
    return !BYPASS_ASSIGNMENT_SCOPING.some((permission) =>
      context.permissions.includes(permission)
    );
  }

  async resolveStaffId(tenantId: string, userId: string): Promise<string | null> {
    const [record] = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.userId, userId)));

    return record?.id ?? null;
  }

  async listClassroomIdsForStaff(tenantId: string, staffId: string): Promise<string[]> {
    const asClassTeacher = await this.db
      .select({ classroomId: classrooms.id })
      .from(classrooms)
      .where(
        and(
          eq(classrooms.tenantId, tenantId),
          eq(classrooms.classTeacherStaffId, staffId)
        )
      );

    const asSubjectTeacher = await this.db
      .select({ classroomId: classroomSubjectTeachers.classroomId })
      .from(classroomSubjectTeachers)
      .where(
        and(
          eq(classroomSubjectTeachers.tenantId, tenantId),
          eq(classroomSubjectTeachers.teacherStaffId, staffId)
        )
      );

    const asGradeChief = await this.db
      .select({ classroomId: classrooms.id })
      .from(classrooms)
      .innerJoin(
        gradeChiefAssignments,
        and(
          eq(gradeChiefAssignments.tenantId, tenantId),
          eq(gradeChiefAssignments.staffId, staffId),
          eq(gradeChiefAssignments.academicYearId, classrooms.academicYearId),
          eq(gradeChiefAssignments.gradeId, classrooms.gradeId)
        )
      )
      .where(eq(classrooms.tenantId, tenantId));

    return [
      ...new Set([
        ...asClassTeacher.map((row) => row.classroomId),
        ...asSubjectTeacher.map((row) => row.classroomId),
        ...asGradeChief.map((row) => row.classroomId)
      ])
    ];
  }

  /**
   * Returns classroom ids the actor may access, or null when no filter applies.
   */
  async assignedClassroomIds(context: TenantContext): Promise<string[] | null> {
    if (!this.requiresAssignmentScoping(context)) {
      return null;
    }

    const staffId = await this.resolveStaffId(context.tenantId, context.actorUserId);
    if (!staffId) {
      return [];
    }

    return this.listClassroomIdsForStaff(context.tenantId, staffId);
  }

  async isClassTeacher(
    tenantId: string,
    staffId: string,
    classroomId: string
  ): Promise<boolean> {
    const [classroom] = await this.db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(
        and(
          eq(classrooms.tenantId, tenantId),
          eq(classrooms.id, classroomId),
          eq(classrooms.classTeacherStaffId, staffId)
        )
      );

    return Boolean(classroom);
  }

  async isGradeChiefOfClassroom(
    tenantId: string,
    staffId: string,
    classroomId: string
  ): Promise<boolean> {
    const [classroom] = await this.db
      .select({
        academicYearId: classrooms.academicYearId,
        gradeId: classrooms.gradeId
      })
      .from(classrooms)
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)));

    if (!classroom) {
      return false;
    }

    const [assignment] = await this.db
      .select({ id: gradeChiefAssignments.id })
      .from(gradeChiefAssignments)
      .where(
        and(
          eq(gradeChiefAssignments.tenantId, tenantId),
          eq(gradeChiefAssignments.staffId, staffId),
          eq(gradeChiefAssignments.academicYearId, classroom.academicYearId),
          eq(gradeChiefAssignments.gradeId, classroom.gradeId)
        )
      );

    return Boolean(assignment);
  }

  async hasFullClassroomSubjectAccess(
    tenantId: string,
    staffId: string,
    classroomId: string
  ): Promise<boolean> {
    if (await this.isClassTeacher(tenantId, staffId, classroomId)) {
      return true;
    }

    return this.isGradeChiefOfClassroom(tenantId, staffId, classroomId);
  }

  async isAssignedToClassroom(
    tenantId: string,
    staffId: string,
    classroomId: string
  ): Promise<boolean> {
    const classroomIds = await this.listClassroomIdsForStaff(tenantId, staffId);
    return classroomIds.includes(classroomId);
  }

  async isAssignedToClassroomSubject(
    tenantId: string,
    staffId: string,
    classroomId: string,
    subjectId: string
  ): Promise<boolean> {
    if (await this.hasFullClassroomSubjectAccess(tenantId, staffId, classroomId)) {
      return true;
    }

    const [assignment] = await this.db
      .select({ id: classroomSubjectTeachers.id })
      .from(classroomSubjectTeachers)
      .where(
        and(
          eq(classroomSubjectTeachers.tenantId, tenantId),
          eq(classroomSubjectTeachers.classroomId, classroomId),
          eq(classroomSubjectTeachers.subjectId, subjectId),
          eq(classroomSubjectTeachers.teacherStaffId, staffId)
        )
      );

    return Boolean(assignment);
  }

  async assertClassroomAccess(context: TenantContext, classroomId: string): Promise<void> {
    if (!this.requiresAssignmentScoping(context)) {
      return;
    }

    const staffId = await this.resolveStaffId(context.tenantId, context.actorUserId);
    if (!staffId) {
      this.rbac.assertTeacherAssignment(false);
      return;
    }

    const assigned = await this.isAssignedToClassroom(context.tenantId, staffId, classroomId);
    this.rbac.assertTeacherAssignment(assigned);
  }

  async assertClassroomSubjectAccess(
    context: TenantContext,
    classroomId: string,
    subjectId: string
  ): Promise<void> {
    if (!this.requiresAssignmentScoping(context)) {
      return;
    }

    const staffId = await this.resolveStaffId(context.tenantId, context.actorUserId);
    if (!staffId) {
      this.rbac.assertTeacherAssignment(false);
      return;
    }

    const assigned = await this.isAssignedToClassroomSubject(
      context.tenantId,
      staffId,
      classroomId,
      subjectId
    );
    this.rbac.assertTeacherAssignment(assigned);
  }

  async assertAttendanceSessionAccess(
    context: TenantContext,
    sessionId: string
  ): Promise<void> {
    const [session] = await this.db
      .select({
        classroomId: attendanceSessions.classroomId,
        subjectId: attendanceSessions.subjectId
      })
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, context.tenantId),
          eq(attendanceSessions.id, sessionId)
        )
      );

    if (!session) {
      throw new NotFoundException("Attendance session not found.");
    }

    if (session.subjectId) {
      await this.assertClassroomSubjectAccess(context, session.classroomId, session.subjectId);
      return;
    }

    await this.assertClassroomAccess(context, session.classroomId);
  }

  async enforceScope(context: TenantContext, request: ScopedRequest, scope: TeacherScopeOptions) {
    if (!this.requiresAssignmentScoping(context)) {
      return;
    }

    if (scope.attendanceSessionIdParam) {
      const sessionId = request.params?.[scope.attendanceSessionIdParam];
      if (!sessionId) {
        throw new ForbiddenException("Attendance session context is required.");
      }
      await this.assertAttendanceSessionAccess(context, sessionId);
      return;
    }

    const classroomId = scope.classroomIdParam
      ? request.params?.[scope.classroomIdParam]
      : undefined;

    if (!classroomId) {
      throw new ForbiddenException("Classroom context is required.");
    }

    const subjectId =
      (scope.subjectIdParam ? request.params?.[scope.subjectIdParam] : undefined) ??
      readQueryParam(request.query, scope.subjectIdQuery);

    if (subjectId) {
      await this.assertClassroomSubjectAccess(context, classroomId, subjectId);
      return;
    }

    await this.assertClassroomAccess(context, classroomId);
  }
}

function readQueryParam(
  query: Record<string, string | string[] | undefined> | undefined,
  key: string | undefined
): string | undefined {
  if (!key || !query) {
    return undefined;
  }

  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}
