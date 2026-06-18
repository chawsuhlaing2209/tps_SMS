import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { classroomStudents, reportCards, students } from "../db/schema.js";
import type { GenerateReportCardsDto, ListReportCardsQueryDto } from "./dto.js";

@Injectable()
export class ReportCardsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  list(tenantId: string, query: ListReportCardsQueryDto) {
    const filters = [eq(reportCards.tenantId, tenantId)];
    if (query.classroomId) {
      filters.push(eq(reportCards.classroomId, query.classroomId));
    }
    if (query.status) {
      filters.push(eq(reportCards.status, query.status as "draft" | "submitted" | "reviewed" | "approved" | "published" | "archived" | "rejected"));
    }
    return this.db
      .select({
        id: reportCards.id,
        tenantId: reportCards.tenantId,
        studentId: reportCards.studentId,
        classroomId: reportCards.classroomId,
        academicYearId: reportCards.academicYearId,
        termId: reportCards.termId,
        data: reportCards.data,
        status: reportCards.status,
        publishedAt: reportCards.publishedAt,
        createdAt: reportCards.createdAt,
        updatedAt: reportCards.updatedAt,
        studentFullName: students.fullName
      })
      .from(reportCards)
      .leftJoin(students, eq(reportCards.studentId, students.id))
      .where(and(...filters));
  }

  async generate(
    tenantId: string,
    actorUserId: string | undefined,
    dto: GenerateReportCardsDto
  ) {
    // Get all students in the classroom
    const enrolledStudents = await this.db
      .select()
      .from(classroomStudents)
      .where(
        and(
          eq(classroomStudents.tenantId, tenantId),
          eq(classroomStudents.classroomId, dto.classroomId)
        )
      );

    const created = await Promise.all(
      enrolledStudents.map(async (cs) => {
        const rows = await this.db
          .insert(reportCards)
          .values({
            tenantId,
            studentId: cs.studentId,
            classroomId: dto.classroomId,
            academicYearId: dto.academicYearId,
            termId: dto.termId,
            createdBy: actorUserId,
            updatedBy: actorUserId
          })
          .returning();
        return rows[0]!;
      })
    );

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "report_card.generate",
      recordType: "ReportCard",
      recordId: dto.classroomId,
      after: { generated: created.length, classroomId: dto.classroomId } as Record<string, unknown>
    });

    return created;
  }

  async getById(tenantId: string, reportCardId: string) {
    const rows = await this.db
      .select()
      .from(reportCards)
      .where(and(eq(reportCards.tenantId, tenantId), eq(reportCards.id, reportCardId)));

    if (!rows[0]) {
      throw new NotFoundException("Report card not found.");
    }

    return rows[0];
  }

  async approve(
    tenantId: string,
    reportCardId: string,
    actorUserId: string | undefined
  ) {
    const existing = await this.getById(tenantId, reportCardId);

    const rows = await this.db
      .update(reportCards)
      .set({ status: "approved", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(reportCards.tenantId, tenantId), eq(reportCards.id, reportCardId)))
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "report_card.approve",
      recordType: "ReportCard",
      recordId: reportCardId,
      before: existing as Record<string, unknown>,
      after: row as Record<string, unknown>
    });

    return row;
  }

  async publish(
    tenantId: string,
    reportCardId: string,
    actorUserId: string | undefined
  ) {
    const existing = await this.getById(tenantId, reportCardId);

    const rows = await this.db
      .update(reportCards)
      .set({ status: "published", publishedAt: new Date(), updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(reportCards.tenantId, tenantId), eq(reportCards.id, reportCardId)))
      .returning();
    const row = rows[0]!;

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "report_card.publish",
      recordType: "ReportCard",
      recordId: reportCardId,
      before: existing as Record<string, unknown>,
      after: row as Record<string, unknown>
    });

    return row;
  }
}
