import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { enquiries, leadActivities } from "../db/schema.js";
import type {
  ConvertEnquiryDto,
  CreateEnquiryDto,
  CreateLeadActivityDto,
  ListEnquiriesQueryDto,
  UpdateEnquiryDto
} from "./dto.js";

@Injectable()
export class AdmissionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
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

  async convertEnquiry(
    tenantId: string,
    enquiryId: string,
    actorUserId: string,
    _dto: ConvertEnquiryDto
  ) {
    const existing = await this.getEnquiry(tenantId, enquiryId);

    await this.db
      .update(enquiries)
      .set({ status: "enrolled", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(enquiries.tenantId, tenantId), eq(enquiries.id, enquiryId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "enquiry.convert",
      recordType: "Enquiry",
      recordId: enquiryId,
      before: { status: existing.status },
      after: { status: "enrolled" }
    });

    return {
      enquiryId,
      status: "enrolled",
      message: "Enquiry converted to enrolled status. Create student record separately."
    };
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
