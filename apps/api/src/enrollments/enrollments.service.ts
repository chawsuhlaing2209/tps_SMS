import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { enrollments, studentServices } from "../db/schema.js";
import type {
  CreateEnrollmentDto,
  CreateStudentServiceDto,
  ListEnrollmentsQueryDto,
  ListStudentServicesQueryDto,
  UpdateEnrollmentDto
} from "./dto.js";

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listEnrollments(tenantId: string, query: ListEnrollmentsQueryDto) {
    const filters = [eq(enrollments.tenantId, tenantId)];
    if (query.academicYearId) {
      filters.push(eq(enrollments.academicYearId, query.academicYearId));
    }
    if (query.studentId) {
      filters.push(eq(enrollments.studentId, query.studentId));
    }
    if (query.status) {
      filters.push(eq(enrollments.status, query.status as "draft" | "submitted" | "reviewed" | "approved" | "published" | "archived" | "rejected"));
    }
    return this.db.select().from(enrollments).where(and(...filters));
  }

  async createEnrollment(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateEnrollmentDto
  ) {
    const rows = await this.db
      .insert(enrollments)
      .values({
        tenantId,
        studentId: dto.studentId,
        classroomId: dto.classroomId,
        academicYearId: dto.academicYearId,
        gradeId: dto.gradeId,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "enrollment.create",
      recordType: "Enrollment",
      recordId: row.id,
      after: row as Record<string, unknown>
    });

    return row;
  }

  async updateEnrollment(
    tenantId: string,
    enrollmentId: string,
    actorUserId: string | undefined,
    dto: UpdateEnrollmentDto
  ) {
    const existing = await this.db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)));

    if (!existing[0]) {
      throw new NotFoundException("Enrollment not found.");
    }

    const rows = await this.db
      .update(enrollments)
      .set({
        ...(dto.status ? { status: dto.status as "draft" | "submitted" | "reviewed" | "approved" | "published" | "archived" | "rejected" } : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)))
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "enrollment.update",
      recordType: "Enrollment",
      recordId: enrollmentId,
      before: existing[0] as Record<string, unknown>,
      after: row as Record<string, unknown>
    });

    return row;
  }

  listStudentServices(tenantId: string, query: ListStudentServicesQueryDto) {
    const filters = [eq(studentServices.tenantId, tenantId)];
    if (query.studentId) {
      filters.push(eq(studentServices.studentId, query.studentId));
    }
    return this.db.select().from(studentServices).where(and(...filters));
  }

  async createStudentService(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateStudentServiceDto
  ) {
    const rows = await this.db
      .insert(studentServices)
      .values({
        tenantId,
        studentId: dto.studentId,
        feeItemId: dto.feeItemId,
        effectiveFrom: dto.startDate,
        effectiveTo: dto.endDate,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student_service.create",
      recordType: "StudentService",
      recordId: row.id,
      after: row as Record<string, unknown>
    });

    return row;
  }

  async removeStudentService(
    tenantId: string,
    serviceId: string,
    actorUserId: string | undefined
  ) {
    const existing = await this.db
      .select()
      .from(studentServices)
      .where(and(eq(studentServices.tenantId, tenantId), eq(studentServices.id, serviceId)));

    if (!existing[0]) {
      throw new NotFoundException("Student service not found.");
    }

    // Set effectiveTo to today to mark as inactive
    const today = new Date().toISOString().slice(0, 10);
    const rows = await this.db
      .update(studentServices)
      .set({ effectiveTo: today, updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(studentServices.tenantId, tenantId), eq(studentServices.id, serviceId)))
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student_service.remove",
      recordType: "StudentService",
      recordId: serviceId,
      before: existing[0] as Record<string, unknown>,
      after: row as Record<string, unknown>
    });

    return { removed: true };
  }
}
