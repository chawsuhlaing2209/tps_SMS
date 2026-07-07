import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { assignments, learningMaterials, staff } from "../db/schema.js";
import type { CreateAssignmentDto, CreateMaterialDto, UpdateAssignmentDto } from "./dto.js";

@Injectable()
export class LmsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  private async resolveTeacherStaffId(tenantId: string, actorUserId?: string, override?: string) {
    if (override) {
      const [member] = await this.db
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, override)));
      if (!member) {
        throw new NotFoundException("Staff member not found.");
      }
      return member.id;
    }

    if (!actorUserId) {
      throw new BadRequestException("Teacher staff profile is required.");
    }

    const [member] = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.userId, actorUserId)));

    if (!member) {
      throw new NotFoundException("No staff profile is linked to your account.");
    }

    return member.id;
  }

  listMaterials(tenantId: string, classroomId: string) {
    return this.db
      .select()
      .from(learningMaterials)
      .where(
        and(
          eq(learningMaterials.tenantId, tenantId),
          eq(learningMaterials.classroomId, classroomId)
        )
      )
      .limit(100);
  }

  async createMaterial(
    tenantId: string,
    classroomId: string,
    actorUserId: string | undefined,
    dto: CreateMaterialDto
  ) {
    const teacherStaffId = await this.resolveTeacherStaffId(
      tenantId,
      actorUserId,
      dto.uploadedByStaffId
    );

    const rows = await this.db
      .insert(learningMaterials)
      .values({
        tenantId,
        classroomId,
        subjectId: dto.subjectId,
        teacherStaffId,
        title: dto.title,
        fileId: dto.fileId,
        description: dto.topicTag,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "lms.material.create",
      recordType: "LearningMaterial",
      recordId: row.id,
      after: row as Record<string, unknown>
    });

    return row;
  }

  listAssignments(tenantId: string, classroomId: string) {
    return this.db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.tenantId, tenantId),
          eq(assignments.classroomId, classroomId)
        )
      )
      .limit(100);
  }

  async createAssignment(
    tenantId: string,
    classroomId: string,
    actorUserId: string | undefined,
    dto: CreateAssignmentDto
  ) {
    const teacherStaffId = await this.resolveTeacherStaffId(tenantId, actorUserId);

    const rows = await this.db
      .insert(assignments)
      .values({
        tenantId,
        classroomId,
        subjectId: dto.subjectId,
        teacherStaffId,
        title: dto.title,
        instructions: dto.instructions,
        dueAt: dto.dueDate ? new Date(dto.dueDate) : null,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "lms.assignment.create",
      recordType: "Assignment",
      recordId: row.id,
      after: row as Record<string, unknown>
    });

    return row;
  }

  async updateAssignment(
    tenantId: string,
    assignmentId: string,
    actorUserId: string | undefined,
    dto: UpdateAssignmentDto
  ) {
    const [row] = await this.db
      .update(assignments)
      .set({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.dueDate !== undefined && {
          dueAt: dto.dueDate ? new Date(dto.dueDate) : null
        }),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(assignments.tenantId, tenantId), eq(assignments.id, assignmentId)))
      .returning();

    if (!row) {
      throw new NotFoundException("Assignment not found.");
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "lms.assignment.update",
      recordType: "Assignment",
      recordId: assignmentId,
      after: dto as Record<string, unknown>
    });

    return row;
  }
}
