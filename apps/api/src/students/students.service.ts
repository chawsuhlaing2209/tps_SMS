import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  auditLogs,
  classroomStudents,
  classrooms,
  guardians,
  studentGuardians,
  students
} from "../db/schema.js";
import type {
  CreateGuardianDto,
  CreateStudentDto,
  EnrollStudentDto,
  LinkGuardianDto,
  ListStudentsQueryDto,
  TransferStudentDto,
  UpdateStudentDto,
  WithdrawStudentDto
} from "./dto.js";

@Injectable()
export class StudentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  async list(tenantId: string, query: ListStudentsQueryDto) {
    const filters: ReturnType<typeof eq>[] = [eq(students.tenantId, tenantId)];

    if (query.status) {
      filters.push(eq(students.status, query.status));
    }

    if (query.search) {
      filters.push(ilike(students.fullName, `%${query.search}%`));
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const rows = await this.db
      .select()
      .from(students)
      .where(and(...filters))
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(and(...filters));

    return { data: rows, total: countRow?.count ?? 0 };
  }

  async getById(tenantId: string, studentId: string) {
    const [student] = await this.db
      .select()
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    const guardianLinks = await this.db
      .select()
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .where(and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.tenantId, tenantId)));

    const classroomLinks = await this.db
      .select()
      .from(classroomStudents)
      .innerJoin(classrooms, eq(classroomStudents.classroomId, classrooms.id))
      .where(and(eq(classroomStudents.studentId, studentId), eq(classroomStudents.tenantId, tenantId)));

    return { ...student, guardians: guardianLinks, classrooms: classroomLinks };
  }

  private async getStudentOrThrow(tenantId: string, studentId: string) {
    const [student] = await this.db
      .select()
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    return student;
  }

  async create(tenantId: string, actorUserId: string | undefined, dto: CreateStudentDto) {
    const admissionNumber = dto.admissionNumber ?? `A-${Date.now()}`;
    const fullName = `${dto.firstName} ${dto.lastName}`;

    const [student] = await this.db
      .insert(students)
      .values({
        tenantId,
        fullName,
        dateOfBirth: dto.dateOfBirth,
        gender: dto.gender,
        admissionNumber,
        photoFileId: dto.photoFileId,
        address: dto.address,
        medicalNotes: dto.medicalNotes,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.create",
      recordType: "student",
      recordId: student!.id,
      after: student as Record<string, unknown>
    });

    return student!;
  }

  async update(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: UpdateStudentDto
  ) {
    const before = await this.getStudentOrThrow(tenantId, studentId);

    const fullName =
      dto.firstName || dto.lastName
        ? `${dto.firstName ?? before.fullName.split(" ")[0]} ${dto.lastName ?? before.fullName.split(" ").slice(1).join(" ")}`
        : undefined;

    const [updated] = await this.db
      .update(students)
      .set({
        ...(fullName ? { fullName } : {}),
        ...(dto.dateOfBirth ? { dateOfBirth: dto.dateOfBirth } : {}),
        ...(dto.gender ? { gender: dto.gender } : {}),
        ...(dto.admissionNumber ? { admissionNumber: dto.admissionNumber } : {}),
        ...(dto.photoFileId !== undefined ? { photoFileId: dto.photoFileId } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.medicalNotes !== undefined ? { medicalNotes: dto.medicalNotes } : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.update",
      recordType: "student",
      recordId: studentId,
      before: before as Record<string, unknown>,
      after: updated as Record<string, unknown>
    });

    return updated!;
  }

  async enroll(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: EnrollStudentDto
  ) {
    await this.getStudentOrThrow(tenantId, studentId);

    const effectiveFrom = dto.enrollmentDate ?? new Date().toISOString().slice(0, 10);

    await this.db.insert(classroomStudents).values({
      tenantId,
      classroomId: dto.classroomId,
      studentId,
      effectiveFrom,
      createdBy: actorUserId,
      updatedBy: actorUserId
    });

    const [updated] = await this.db
      .update(students)
      .set({ status: "enrolled", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.enroll",
      recordType: "student",
      recordId: studentId,
      after: { classroomId: dto.classroomId, academicYearId: dto.academicYearId }
    });

    return updated!;
  }

  async transfer(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: TransferStudentDto
  ) {
    await this.getStudentOrThrow(tenantId, studentId);

    const effectiveTo = dto.effectiveDate ?? new Date().toISOString().slice(0, 10);

    // Mark existing as inactive
    await this.db
      .update(classroomStudents)
      .set({ effectiveTo, updatedBy: actorUserId, updatedAt: new Date() })
      .where(
        and(
          eq(classroomStudents.studentId, studentId),
          eq(classroomStudents.tenantId, tenantId)
        )
      );

    // Insert new classroom_student
    await this.db.insert(classroomStudents).values({
      tenantId,
      classroomId: dto.toClassroomId,
      studentId,
      effectiveFrom: effectiveTo,
      movementReason: dto.reason,
      createdBy: actorUserId,
      updatedBy: actorUserId
    });

    const [updated] = await this.db
      .update(students)
      .set({ status: "transferred", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.transfer",
      recordType: "student",
      recordId: studentId,
      after: { toClassroomId: dto.toClassroomId, reason: dto.reason }
    });

    return updated!;
  }

  async withdraw(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: WithdrawStudentDto
  ) {
    await this.getStudentOrThrow(tenantId, studentId);

    const effectiveTo = dto.withdrawDate ?? new Date().toISOString().slice(0, 10);

    await this.db
      .update(classroomStudents)
      .set({ effectiveTo, updatedBy: actorUserId, updatedAt: new Date() })
      .where(
        and(
          eq(classroomStudents.studentId, studentId),
          eq(classroomStudents.tenantId, tenantId)
        )
      );

    const [updated] = await this.db
      .update(students)
      .set({ status: "withdrawn", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.withdraw",
      recordType: "student",
      recordId: studentId,
      after: { reason: dto.reason }
    });

    return updated!;
  }

  listGuardians(tenantId: string) {
    return this.db.select().from(guardians).where(eq(guardians.tenantId, tenantId));
  }

  async createGuardian(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateGuardianDto
  ) {
    const [guardian] = await this.db
      .insert(guardians)
      .values({
        tenantId,
        fullName: `${dto.firstName} ${dto.lastName}`,
        relationshipLabel: dto.relationship,
        phone: dto.phone,
        email: dto.email,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return guardian!;
  }

  async linkGuardian(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: LinkGuardianDto
  ) {
    await this.getStudentOrThrow(tenantId, studentId);

    const [link] = await this.db
      .insert(studentGuardians)
      .values({
        tenantId,
        studentId,
        guardianId: dto.guardianId,
        relationship: dto.relationship,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.link_guardian",
      recordType: "student",
      recordId: studentId,
      after: { guardianId: dto.guardianId, relationship: dto.relationship }
    });

    return link!;
  }

  getTimeline(tenantId: string, studentId: string) {
    return this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.recordId, studentId)))
      .orderBy(desc(auditLogs.createdAt));
  }
}
