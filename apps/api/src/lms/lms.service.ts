import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { assignments, learningMaterials } from "../db/schema.js";
import type { CreateAssignmentDto, CreateMaterialDto, UpdateAssignmentDto } from "./dto.js";

@Injectable()
export class LmsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listMaterials(tenantId: string, classroomId: string) {
    return this.db
      .select()
      .from(learningMaterials)
      .where(
        and(
          eq(learningMaterials.tenantId, tenantId),
          eq(learningMaterials.classroomId, classroomId)
        )
      );
  }

  async createMaterial(
    tenantId: string,
    classroomId: string,
    actorUserId: string | undefined,
    dto: CreateMaterialDto
  ) {
    const rows = await this.db
      .insert(learningMaterials)
      .values({
        tenantId,
        classroomId,
        subjectId: dto.fileId, // fileId used as placeholder — subjectId required by schema
        teacherStaffId: dto.uploadedByStaffId,
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
      );
  }

  async createAssignment(
    tenantId: string,
    classroomId: string,
    actorUserId: string | undefined,
    dto: CreateAssignmentDto
  ) {
    const rows = await this.db
      .insert(assignments)
      .values({
        tenantId,
        classroomId,
        subjectId: dto.subjectId,
        teacherStaffId: actorUserId ?? "00000000-0000-0000-0000-000000000000",
        title: dto.title,
        instructions: dto.instructions,
        dueAt: dto.dueDate ? new Date(dto.dueDate) : undefined,
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
    const existing = await this.db
      .select()
      .from(assignments)
      .where(and(eq(assignments.tenantId, tenantId), eq(assignments.id, assignmentId)));

    if (!existing[0]) {
      throw new NotFoundException("Assignment not found.");
    }

    const rows = await this.db
      .update(assignments)
      .set({
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
        ...(dto.dueDate !== undefined ? { dueAt: new Date(dto.dueDate) } : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(assignments.tenantId, tenantId), eq(assignments.id, assignmentId)))
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "lms.assignment.update",
      recordType: "Assignment",
      recordId: assignmentId,
      before: existing[0] as Record<string, unknown>,
      after: row as Record<string, unknown>
    });

    return row;
  }
}
