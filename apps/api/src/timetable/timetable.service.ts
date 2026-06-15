import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { subjects, timetablePeriods, timetableSlots } from "../db/schema.js";
import type { CreatePeriodDto, CreateTimetableSlotDto, ListTimetableSlotsQueryDto, PublishTimetableDto } from "./dto.js";

@Injectable()
export class TimetableService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listPeriods(tenantId: string) {
    return this.db
      .select()
      .from(timetablePeriods)
      .where(eq(timetablePeriods.tenantId, tenantId))
      .orderBy(timetablePeriods.sortOrder);
  }

  async createPeriod(tenantId: string, actorUserId: string, dto: CreatePeriodDto) {
    const [period] = await this.db
      .insert(timetablePeriods)
      .values({
        tenantId,
        name: dto.name,
        startsAt: dto.startTime,
        endsAt: dto.endTime,
        sortOrder: dto.sortOrder,
        academicYearId: dto.academicYearId!,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return period;
  }

  async listSlots(tenantId: string, query: ListTimetableSlotsQueryDto) {
    const filters = [eq(timetableSlots.tenantId, tenantId)];

    if (query.classroomId) {
      filters.push(eq(timetableSlots.classroomId, query.classroomId));
    }

    if (query.staffId) {
      filters.push(eq(timetableSlots.teacherStaffId, query.staffId));
    }

    return this.db
      .select({
        id: timetableSlots.id,
        tenantId: timetableSlots.tenantId,
        classroomId: timetableSlots.classroomId,
        subjectId: timetableSlots.subjectId,
        teacherStaffId: timetableSlots.teacherStaffId,
        periodId: timetableSlots.periodId,
        room: timetableSlots.room,
        dayOfWeek: timetableSlots.dayOfWeek,
        effectiveFrom: timetableSlots.effectiveFrom,
        effectiveTo: timetableSlots.effectiveTo,
        publishedAt: timetableSlots.publishedAt,
        createdAt: timetableSlots.createdAt,
        updatedAt: timetableSlots.updatedAt,
        subjectName: subjects.name
      })
      .from(timetableSlots)
      .leftJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
      .where(and(...filters));
  }

  async createSlot(tenantId: string, actorUserId: string, dto: CreateTimetableSlotDto) {
    // Check classroom conflict
    const [classroomConflict] = await this.db
      .select()
      .from(timetableSlots)
      .where(
        and(
          eq(timetableSlots.tenantId, tenantId),
          eq(timetableSlots.classroomId, dto.classroomId),
          eq(timetableSlots.periodId, dto.periodId),
          eq(timetableSlots.dayOfWeek, dto.dayOfWeek)
        )
      );

    if (classroomConflict) {
      throw new ConflictException("Classroom already has a class in this period");
    }

    // Check teacher conflict
    const [teacherConflict] = await this.db
      .select()
      .from(timetableSlots)
      .where(
        and(
          eq(timetableSlots.tenantId, tenantId),
          eq(timetableSlots.teacherStaffId, dto.staffId),
          eq(timetableSlots.periodId, dto.periodId),
          eq(timetableSlots.dayOfWeek, dto.dayOfWeek)
        )
      );

    if (teacherConflict) {
      throw new ConflictException("Teacher already assigned in this period");
    }

    const today = new Date().toISOString().slice(0, 10);

    const [slot] = await this.db
      .insert(timetableSlots)
      .values({
        tenantId,
        classroomId: dto.classroomId,
        subjectId: dto.subjectId,
        teacherStaffId: dto.staffId,
        periodId: dto.periodId,
        dayOfWeek: dto.dayOfWeek,
        room: dto.roomLabel ?? null,
        effectiveFrom: dto.effectiveFrom ?? today,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "timetable_slot.create",
      recordType: "TimetableSlot",
      recordId: slot!.id,
      after: { classroomId: dto.classroomId, periodId: dto.periodId, dayOfWeek: dto.dayOfWeek }
    });

    return slot;
  }

  async deleteSlot(tenantId: string, slotId: string, actorUserId: string) {
    const [existing] = await this.db
      .select()
      .from(timetableSlots)
      .where(and(eq(timetableSlots.id, slotId), eq(timetableSlots.tenantId, tenantId)));

    if (!existing) {
      throw new NotFoundException("Timetable slot not found.");
    }

    await this.db
      .delete(timetableSlots)
      .where(and(eq(timetableSlots.id, slotId), eq(timetableSlots.tenantId, tenantId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "timetable_slot.delete",
      recordType: "TimetableSlot",
      recordId: slotId,
      before: { classroomId: existing.classroomId, periodId: existing.periodId }
    });

    return { deleted: true };
  }

  async publishTimetable(tenantId: string, actorUserId: string, dto: PublishTimetableDto) {
    const filters = [eq(timetableSlots.tenantId, tenantId)];

    const result = await this.db
      .update(timetableSlots)
      .set({
        publishedAt: new Date(),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(...filters))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "timetable.publish",
      recordType: "Timetable",
      recordId: tenantId,
      after: { count: result.length }
    });

    return { published: result.length };
  }
}
