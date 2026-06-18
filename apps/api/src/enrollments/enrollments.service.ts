import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { EnrollmentConfirmInput } from "@sms/shared";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  classroomStudents,
  enrollments,
  studentServices,
  students
} from "../db/schema.js";
import type {
  CreateEnrollmentDto,
  CreateStudentServiceDto,
  ListEnrollmentsQueryDto,
  ListStudentServicesQueryDto,
  PreviewEnrollmentDto,
  UpdateEnrollmentDto,
  ConfirmEnrollmentDto
} from "./dto.js";
import { EnrollmentBillingService } from "./enrollment-billing.service.js";

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly enrollmentBillingService: EnrollmentBillingService
  ) {}

  private static readonly ACTIVE_ENROLLMENT_STATUSES = [
    "draft",
    "submitted",
    "reviewed",
    "approved",
    "published"
  ] as const;

  private async assertNoDuplicateEnrollment(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    classroomId: string | null | undefined,
    excludeEnrollmentId?: string
  ) {
    const filters = [
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.studentId, studentId),
      eq(enrollments.academicYearId, academicYearId),
      inArray(enrollments.status, [...EnrollmentsService.ACTIVE_ENROLLMENT_STATUSES])
    ];

    if (classroomId) {
      filters.push(eq(enrollments.classroomId, classroomId));
    }

    if (excludeEnrollmentId) {
      filters.push(ne(enrollments.id, excludeEnrollmentId));
    }

    const [existing] = await this.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(...filters))
      .limit(1);

    if (existing) {
      throw new ConflictException(
        classroomId
          ? "This student already has an active enrollment for this classroom."
          : "This student already has an active enrollment for this academic year."
      );
    }
  }

  previewEnrollment(tenantId: string, dto: PreviewEnrollmentDto) {
    return this.enrollmentBillingService.preview(tenantId, {
      studentId: dto.studentId,
      academicYearId: dto.academicYearId,
      gradeId: dto.gradeId,
      classroomId: dto.classroomId,
      optionalFeeItemIds: dto.optionalFeeItemIds ?? []
    });
  }

  async getEnrollment(tenantId: string, enrollmentId: string) {
    const [row] = await this.db
      .select({
        id: enrollments.id,
        tenantId: enrollments.tenantId,
        studentId: enrollments.studentId,
        enquiryId: enrollments.enquiryId,
        classroomId: enrollments.classroomId,
        academicYearId: enrollments.academicYearId,
        gradeId: enrollments.gradeId,
        invoiceId: enrollments.invoiceId,
        status: enrollments.status,
        billingSnapshot: enrollments.billingSnapshot,
        confirmedAt: enrollments.confirmedAt,
        createdAt: enrollments.createdAt,
        updatedAt: enrollments.updatedAt,
        studentFullName: students.fullName
      })
      .from(enrollments)
      .leftJoin(students, eq(enrollments.studentId, students.id))
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)));

    if (!row) {
      throw new NotFoundException("Enrollment not found.");
    }

    return row;
  }

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
    return this.db
      .select({
        id: enrollments.id,
        tenantId: enrollments.tenantId,
        studentId: enrollments.studentId,
        classroomId: enrollments.classroomId,
        academicYearId: enrollments.academicYearId,
        gradeId: enrollments.gradeId,
        invoiceId: enrollments.invoiceId,
        status: enrollments.status,
        billingSnapshot: enrollments.billingSnapshot,
        createdAt: enrollments.createdAt,
        updatedAt: enrollments.updatedAt,
        studentFullName: students.fullName
      })
      .from(enrollments)
      .leftJoin(students, eq(enrollments.studentId, students.id))
      .where(and(...filters));
  }

  async createEnrollment(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateEnrollmentDto
  ) {
    if (dto.classroomId) {
      await this.enrollmentBillingService.assertClassroomPlacement(
        tenantId,
        dto.classroomId,
        dto.academicYearId,
        dto.gradeId
      );
    }

    await this.assertNoDuplicateEnrollment(
      tenantId,
      dto.studentId,
      dto.academicYearId,
      dto.classroomId
    );

    const rows = await this.db
      .insert(enrollments)
      .values({
        tenantId,
        enquiryId: dto.enquiryId,
        studentId: dto.studentId,
        classroomId: dto.classroomId ?? null,
        academicYearId: dto.academicYearId,
        gradeId: dto.gradeId,
        billingSnapshot: {
          optionalFeeItemIds: dto.optionalFeeItemIds ?? []
        },
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

  confirmEnrollment(
    tenantId: string,
    enrollmentId: string,
    actorUserId: string | undefined,
    dto: ConfirmEnrollmentDto,
    actorPermissions: string[]
  ) {
    if (!actorUserId) {
      throw new UnauthorizedException("Missing actor user id.");
    }

    return this.enrollmentBillingService.confirm(
      tenantId,
      enrollmentId,
      actorUserId,
      dto as EnrollmentConfirmInput,
      actorPermissions
    );
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

    if (dto.status === "approved" && !existing[0].invoiceId) {
      throw new BadRequestException(
        "Use POST /enrollments/:id/confirm to approve placement and create the invoice together."
      );
    }

    if (existing[0].confirmedAt) {
      throw new BadRequestException("Confirmed enrollments cannot be edited.");
    }

    const nextClassroomId =
      dto.classroomId !== undefined ? dto.classroomId : existing[0].classroomId;
    const nextGradeId = dto.gradeId ?? existing[0].gradeId;
    const nextYearId = dto.academicYearId ?? existing[0].academicYearId;

    if (nextClassroomId) {
      await this.enrollmentBillingService.assertClassroomPlacement(
        tenantId,
        nextClassroomId,
        nextYearId,
        nextGradeId
      );
    }

    if (
      dto.classroomId !== undefined ||
      dto.gradeId !== undefined ||
      dto.academicYearId !== undefined
    ) {
      await this.assertNoDuplicateEnrollment(
        tenantId,
        existing[0].studentId,
        nextYearId,
        nextClassroomId,
        enrollmentId
      );
    }

    const nextSnapshot =
      dto.optionalFeeItemIds !== undefined
        ? {
            ...existing[0].billingSnapshot,
            optionalFeeItemIds: dto.optionalFeeItemIds
          }
        : existing[0].billingSnapshot;

    const rows = await this.db
      .update(enrollments)
      .set({
        ...(dto.status
          ? {
              status: dto.status as
                | "draft"
                | "submitted"
                | "reviewed"
                | "approved"
                | "published"
                | "archived"
                | "rejected"
            }
          : {}),
        ...(dto.classroomId !== undefined ? { classroomId: dto.classroomId || null } : {}),
        ...(dto.gradeId !== undefined ? { gradeId: dto.gradeId } : {}),
        ...(dto.academicYearId !== undefined ? { academicYearId: dto.academicYearId } : {}),
        ...(dto.optionalFeeItemIds !== undefined ? { billingSnapshot: nextSnapshot } : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)))
      .returning();
    const row = rows[0]!;

    if (dto.status === "approved" && existing[0].status !== "approved") {
      await this.syncClassroomPlacement(tenantId, row, actorUserId);
    }

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

  /** Places the student in the classroom when an enrollment is approved. */
  private async syncClassroomPlacement(
    tenantId: string,
    enrollment: typeof enrollments.$inferSelect,
    actorUserId: string | undefined
  ) {
    if (!enrollment.classroomId) {
      throw new BadRequestException("Enrollment has no classroom — cannot approve placement.");
    }

    const today = new Date().toISOString().slice(0, 10);

    const activePlacements = await this.db
      .select()
      .from(classroomStudents)
      .where(
        and(
          eq(classroomStudents.tenantId, tenantId),
          eq(classroomStudents.studentId, enrollment.studentId),
          isNull(classroomStudents.effectiveTo)
        )
      );

    for (const placement of activePlacements) {
      if (placement.classroomId === enrollment.classroomId) {
        continue;
      }
      await this.db
        .update(classroomStudents)
        .set({ effectiveTo: today, updatedBy: actorUserId, updatedAt: new Date() })
        .where(eq(classroomStudents.id, placement.id));
    }

    const alreadyInClassroom = activePlacements.some(
      (p) => p.classroomId === enrollment.classroomId
    );

    if (!alreadyInClassroom) {
      await this.db.insert(classroomStudents).values({
        tenantId,
        classroomId: enrollment.classroomId,
        studentId: enrollment.studentId,
        effectiveFrom: today,
        movementReason: "enrollment_approved",
        createdBy: actorUserId,
        updatedBy: actorUserId
      });
    }

    await this.db
      .update(students)
      .set({ status: "enrolled", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, enrollment.studentId)));
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
