import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ilike } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { classroomSubjectTeachers, staff } from "../db/schema.js";
import type { CreateStaffDto, LinkStaffUserDto, ListStaffQueryDto, UpdateStaffDto } from "./dto.js";

@Injectable()
export class HrService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listStaff(tenantId: string, query: ListStaffQueryDto) {
    const filters = [eq(staff.tenantId, tenantId)];

    if (query.status) {
      filters.push(eq(staff.status, query.status as typeof staff.status._.data));
    }
    if (query.department) {
      filters.push(eq(staff.department, query.department));
    }
    if (query.search) {
      filters.push(ilike(staff.fullName, `%${query.search}%`));
    }

    const q = this.db
      .select()
      .from(staff)
      .where(and(...filters));

    if (query.limit !== undefined) {
      q.limit(query.limit);
    }
    if (query.offset !== undefined) {
      q.offset(query.offset);
    }

    return q;
  }

  async getStaff(tenantId: string, staffId: string) {
    const [member] = await this.db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));

    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }

    const teachingAssignments = await this.db
      .select()
      .from(classroomSubjectTeachers)
      .where(
        and(
          eq(classroomSubjectTeachers.tenantId, tenantId),
          eq(classroomSubjectTeachers.teacherStaffId, staffId)
        )
      );

    return { ...member, teachingAssignments };
  }

  async createStaff(tenantId: string, actorUserId: string | undefined, dto: CreateStaffDto) {
    const [member] = await this.db
      .insert(staff)
      .values({
        tenantId,
        fullName: dto.fullName,
        employmentRole: dto.employmentRole ?? "staff",
        email: dto.email,
        phone: dto.phone,
        department: dto.department,
        joinDate: dto.joinDate,
        salaryBasis: dto.salaryBasis,
        address: dto.address,
        status: (dto.employmentStatus as typeof staff.status._.data) ?? "active",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.create",
      recordType: "Staff",
      recordId: member!.id,
      after: { fullName: member!.fullName }
    });

    return member;
  }

  async updateStaff(
    tenantId: string,
    staffId: string,
    actorUserId: string | undefined,
    dto: UpdateStaffDto
  ) {
    const [member] = await this.db
      .update(staff)
      .set({
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.employmentRole !== undefined && { employmentRole: dto.employmentRole }),
        ...(dto.employmentStatus !== undefined && {
          status: dto.employmentStatus as typeof staff.status._.data
        }),
        ...(dto.joinDate !== undefined && { joinDate: dto.joinDate }),
        ...(dto.salaryBasis !== undefined && { salaryBasis: dto.salaryBasis }),
        ...(dto.address !== undefined && { address: dto.address }),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning();

    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.update",
      recordType: "Staff",
      recordId: staffId,
      after: dto as Record<string, unknown>
    });

    return member;
  }

  async linkUser(
    tenantId: string,
    staffId: string,
    actorUserId: string | undefined,
    dto: LinkStaffUserDto
  ) {
    const [member] = await this.db
      .update(staff)
      .set({ userId: dto.userId, updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning();

    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.link_user",
      recordType: "Staff",
      recordId: staffId,
      after: { userId: dto.userId }
    });

    return member;
  }
}
