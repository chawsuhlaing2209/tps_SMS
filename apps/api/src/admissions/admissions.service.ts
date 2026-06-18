import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, count, desc, eq, ilike, isNull, isNotNull } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  academicYears,
  enquiries,
  enrollments,
  grades,
  leadActivities,
  students
} from "../db/schema.js";
import { EnrollmentsService } from "../enrollments/enrollments.service.js";
import { EnrollmentBillingService } from "../enrollments/enrollment-billing.service.js";
import { StudentsService } from "../students/students.service.js";
import type {
  ConvertEnquiryDto,
  CreateEnquiryDto,
  CreateLeadActivityDto,
  ListEnquiriesQueryDto,
  StartEnrollmentDto,
  UpdateEnquiryDto
} from "./dto.js";

@Injectable()
export class AdmissionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly enrollmentBillingService: EnrollmentBillingService,
    private readonly studentsService: StudentsService
  ) {}

  async listEnquiries(tenantId: string, query: ListEnquiriesQueryDto) {
    const filters = [eq(enquiries.tenantId, tenantId)];

    if (query.status) {
      filters.push(eq(enquiries.status, query.status as typeof enquiries.status._.data));
    }
    if (query.assignedToUserId) {
      filters.push(eq(enquiries.assignedStaffId, query.assignedToUserId));
    }
    if (query.source) {
      filters.push(eq(enquiries.source, query.source));
    }
    if (query.search) {
      filters.push(ilike(enquiries.prospectiveStudentName, `%${query.search}%`));
    }

    const whereClause = and(...filters);

    const [rows, totalRows] = await Promise.all([
      this.db
        .select()
        .from(enquiries)
        .where(whereClause)
        .orderBy(desc(enquiries.createdAt))
        .limit(query.limit ?? 50)
        .offset(query.offset ?? 0),
      this.db
        .select({ total: count() })
        .from(enquiries)
        .where(whereClause)
    ]);

    return { data: rows, total: totalRows[0]?.total ?? 0 };
  }

  async getEnquiry(tenantId: string, enquiryId: string) {
    const [enquiry] = await this.db
      .select()
      .from(enquiries)
      .where(and(eq(enquiries.tenantId, tenantId), eq(enquiries.id, enquiryId)));

    if (!enquiry) {
      throw new NotFoundException("Enquiry not found.");
    }

    const activities = await this.db
      .select()
      .from(leadActivities)
      .where(
        and(eq(leadActivities.tenantId, tenantId), eq(leadActivities.enquiryId, enquiryId))
      )
      .orderBy(desc(leadActivities.createdAt));

    return { ...enquiry, activities };
  }

  async createEnquiry(tenantId: string, actorUserId: string, dto: CreateEnquiryDto) {
    const result = await this.db
      .insert(enquiries)
      .values({
        tenantId,
        prospectiveStudentName: dto.prospectName,
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
        targetGrade: dto.interestedGrade,
        source: dto.source ?? "other",
        notes: dto.notes,
        assignedStaffId: dto.assignedToUserId,
        followUpDate: dto.followUpDate,
        status: "new",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    const enquiry = result[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "enquiry.create",
      recordType: "Enquiry",
      recordId: enquiry.id,
      after: { status: "new" }
    });

    return enquiry;
  }

  async updateEnquiry(
    tenantId: string,
    enquiryId: string,
    actorUserId: string,
    dto: UpdateEnquiryDto
  ) {
    const existing = await this.getEnquiry(tenantId, enquiryId);
    const before = dto.status !== undefined ? { status: existing.status } : undefined;

    const [updated] = await this.db
      .update(enquiries)
      .set({
        ...(dto.prospectName !== undefined && { prospectiveStudentName: dto.prospectName }),
        ...(dto.guardianName !== undefined && { guardianName: dto.guardianName }),
        ...(dto.guardianPhone !== undefined && { guardianPhone: dto.guardianPhone }),
        ...(dto.interestedGrade !== undefined && { targetGrade: dto.interestedGrade }),
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.assignedToUserId !== undefined && { assignedStaffId: dto.assignedToUserId }),
        ...(dto.followUpDate !== undefined && { followUpDate: dto.followUpDate }),
        ...(dto.status !== undefined && {
          status: dto.status as typeof enquiries.status._.data
        }),
        ...(dto.lostReason !== undefined && { lostReason: dto.lostReason }),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(enquiries.tenantId, tenantId), eq(enquiries.id, enquiryId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "enquiry.update",
      recordType: "Enquiry",
      recordId: enquiryId,
      before: before ?? null,
      after: dto.status !== undefined ? { status: dto.status } : null
    });

    return updated;
  }

  async addActivity(
    tenantId: string,
    enquiryId: string,
    actorUserId: string,
    dto: CreateLeadActivityDto
  ) {
    const [existing] = await this.db
      .select({ id: enquiries.id })
      .from(enquiries)
      .where(and(eq(enquiries.tenantId, tenantId), eq(enquiries.id, enquiryId)));

    if (!existing) {
      throw new NotFoundException("Enquiry not found.");
    }

    const [activity] = await this.db
      .insert(leadActivities)
      .values({
        tenantId,
        enquiryId,
        activityType: dto.activityType,
        notes: dto.notes,
        dueAt: dto.activityDate ? new Date(dto.activityDate) : undefined,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return activity;
  }

  async startEnrollment(
    tenantId: string,
    enquiryId: string,
    actorUserId: string,
    dto: StartEnrollmentDto
  ) {
    const enquiry = await this.getEnquiry(tenantId, enquiryId);

    if (enquiry.status === "lost") {
      throw new BadRequestException("Cannot start enrollment for a lost enquiry.");
    }

    const [completedEnrollment] = await this.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.enquiryId, enquiryId),
          isNotNull(enrollments.confirmedAt)
        )
      )
      .limit(1);

    if (completedEnrollment || enquiry.status === "enrolled") {
      throw new ConflictException("This enquiry is already enrolled.");
    }

    const [draftEnrollment] = await this.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.enquiryId, enquiryId),
          isNull(enrollments.confirmedAt)
        )
      )
      .limit(1);

    if (draftEnrollment) {
      const [existing] = await this.db
        .select({
          id: enrollments.id,
          studentId: enrollments.studentId,
          academicYearId: enrollments.academicYearId,
          gradeId: enrollments.gradeId,
          classroomId: enrollments.classroomId,
          status: enrollments.status,
          studentFullName: students.fullName
        })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(
          and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, draftEnrollment.id))
        );

      return {
        enrollmentId: existing!.id,
        studentId: existing!.studentId,
        studentName: existing!.studentFullName,
        academicYearId: existing!.academicYearId,
        gradeId: existing!.gradeId,
        classroomId: existing!.classroomId,
        enquiryId,
        status: existing!.status
      };
    }

    const [activeYear] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, "active")))
      .limit(1);

    if (!activeYear) {
      throw new BadRequestException("No active academic year — set one in Academic Setup first.");
    }

    const gradeId = await this.resolveGradeId(tenantId, dto.gradeId, enquiry.targetGrade);
    if (!gradeId) {
      throw new BadRequestException(
        "Could not resolve target grade. Pass gradeId or set a matching target grade on the enquiry."
      );
    }

    if (dto.classroomId) {
      await this.enrollmentBillingService.assertClassroomPlacement(
        tenantId,
        dto.classroomId,
        activeYear.id,
        gradeId
      );
    }

    const nameParts = enquiry.prospectiveStudentName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? enquiry.prospectiveStudentName;
    const lastName = nameParts.slice(1).join(" ") || "-";

    const student = await this.studentsService.create(tenantId, actorUserId, {
      firstName,
      lastName,
      dateOfBirth: "2010-01-01",
      gender: "other"
    });

    if (enquiry.guardianName && enquiry.guardianPhone) {
      const guardianParts = enquiry.guardianName.trim().split(/\s+/);
      const guardian = await this.studentsService.createGuardian(tenantId, actorUserId, {
        firstName: guardianParts[0] ?? enquiry.guardianName,
        lastName: guardianParts.slice(1).join(" ") || "-",
        phone: enquiry.guardianPhone,
        relationship: "guardian"
      });
      await this.studentsService.linkGuardian(tenantId, student.id, actorUserId, {
        guardianId: guardian.id,
        relationship: "guardian"
      });
      await this.studentsService.ensureFamilyGroupForStudent(tenantId, student.id, actorUserId, {
        guardianId: guardian.id,
        familyName: `${enquiry.guardianName.trim()} family`
      });
    }

    const enrollment = await this.enrollmentsService.createEnrollment(tenantId, actorUserId, {
      studentId: student.id,
      enquiryId,
      academicYearId: activeYear.id,
      gradeId,
      classroomId: dto.classroomId
    });

    if (enquiry.status !== "offered" && enquiry.status !== "assessment_scheduled") {
      await this.db
        .update(enquiries)
        .set({ status: "offered", updatedBy: actorUserId, updatedAt: new Date() })
        .where(and(eq(enquiries.tenantId, tenantId), eq(enquiries.id, enquiryId)));
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "enquiry.start_enrollment",
      recordType: "Enquiry",
      recordId: enquiryId,
      after: { enrollmentId: enrollment.id, studentId: student.id }
    });

    return {
      enrollmentId: enrollment.id,
      studentId: student.id,
      studentName: student.fullName,
      academicYearId: activeYear.id,
      gradeId,
      classroomId: dto.classroomId ?? null,
      enquiryId,
      status: enrollment.status
    };
  }

  async convertEnquiry(
    tenantId: string,
    enquiryId: string,
    actorUserId: string,
    dto: ConvertEnquiryDto
  ) {
    void dto;
    return this.startEnrollment(tenantId, enquiryId, actorUserId, {});
  }

  private async resolveGradeId(
    tenantId: string,
    gradeId: string | undefined,
    targetGrade: string | null
  ): Promise<string | null> {
    if (gradeId) {
      const [grade] = await this.db
        .select({ id: grades.id })
        .from(grades)
        .where(and(eq(grades.tenantId, tenantId), eq(grades.id, gradeId)));
      return grade?.id ?? null;
    }

    if (!targetGrade?.trim()) {
      return null;
    }

    const trimmed = targetGrade.trim();
    const [exact] = await this.db
      .select({ id: grades.id })
      .from(grades)
      .where(and(eq(grades.tenantId, tenantId), ilike(grades.name, trimmed)))
      .limit(1);

    if (exact) {
      return exact.id;
    }

    const [partial] = await this.db
      .select({ id: grades.id })
      .from(grades)
      .where(and(eq(grades.tenantId, tenantId), ilike(grades.name, `%${trimmed}%`)))
      .limit(1);

    return partial?.id ?? null;
  }

  async getDashboard(tenantId: string) {
    const rows = await this.db
      .select({
        status: enquiries.status,
        count: count()
      })
      .from(enquiries)
      .where(eq(enquiries.tenantId, tenantId))
      .groupBy(enquiries.status);

    const byStatus: Record<string, number> = {
      new: 0,
      contacted: 0,
      visit_scheduled: 0,
      assessment_scheduled: 0,
      offered: 0,
      enrolled: 0,
      lost: 0
    };

    let totalEnquiries = 0;

    for (const row of rows) {
      const n = Number(row.count);
      byStatus[row.status] = n;
      totalEnquiries += n;
    }

    const enrolledCount = byStatus["enrolled"] ?? 0;
    const conversionRate =
      totalEnquiries > 0
        ? Number(((enrolledCount / totalEnquiries) * 100).toFixed(2))
        : 0;

    return { byStatus, totalEnquiries, conversionRate };
  }
}
