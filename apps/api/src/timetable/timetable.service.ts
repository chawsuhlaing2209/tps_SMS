import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  classrooms,
  schoolOperatingHourBlocks,
  schoolScheduleSettings,
  staff,
  subjects,
  timetablePeriods,
  timetableSlots
} from "../db/schema.js";
import {
  buildPeriodRowsFromSchedule,
  SchoolScheduleService
} from "../school-schedule/school-schedule.service.js";
import type {
  CreatePeriodDto,
  CreateTimetableSlotDto,
  GeneratePeriodsDto,
  ListTimetableSlotsQueryDto,
  PublishTimetableDto,
  UpdateTimetableSlotDto
} from "./dto.js";

@Injectable()
export class TimetableService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly schoolScheduleService: SchoolScheduleService
  ) {}

  listPeriods(tenantId: string, academicYearId?: string) {
    const filters = [eq(timetablePeriods.tenantId, tenantId)];
    if (academicYearId) {
      filters.push(eq(timetablePeriods.academicYearId, academicYearId));
    }

    return this.db
      .select()
      .from(timetablePeriods)
      .where(and(...filters))
      .orderBy(timetablePeriods.sortOrder);
  }

  async createPeriod(tenantId: string, actorUserId: string, dto: CreatePeriodDto) {
    if (!dto.academicYearId) {
      throw new BadRequestException("academicYearId is required.");
    }

    const [period] = await this.db
      .insert(timetablePeriods)
      .values({
        tenantId,
        name: dto.name,
        startsAt: dto.startTime,
        endsAt: dto.endTime,
        sortOrder: dto.sortOrder,
        academicYearId: dto.academicYearId,
        periodType: dto.isBreak ? "short_break" : "lesson",
        isBreak: dto.isBreak ?? false,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return period;
  }

  async generatePeriods(tenantId: string, actorUserId: string, dto: GeneratePeriodsDto) {
    const settings = await this.schoolScheduleService.getSettings(tenantId);

    if (!settings.operatingHourBlocks.length) {
      throw new BadRequestException("Configure school operating hours before generating periods.");
    }

    const blocks = await this.db
      .select()
      .from(schoolOperatingHourBlocks)
      .where(eq(schoolOperatingHourBlocks.tenantId, tenantId));

    const [slotCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(timetableSlots)
      .innerJoin(timetablePeriods, eq(timetableSlots.periodId, timetablePeriods.id))
      .where(
        and(
          eq(timetableSlots.tenantId, tenantId),
          eq(timetablePeriods.academicYearId, dto.academicYearId)
        )
      );

    if ((slotCount?.count ?? 0) > 0 && !dto.replaceExisting) {
      throw new ConflictException(
        "Timetable slots already exist for this academic year. Pass replaceExisting to regenerate periods."
      );
    }

    const rows = buildPeriodRowsFromSchedule({
      tenantId,
      academicYearId: dto.academicYearId,
      actorUserId,
      periodDurationMinutes: settings.periodDurationMinutes,
      shortBreakStartsAt: settings.shortBreakStartsAt,
      shortBreakEndsAt: settings.shortBreakEndsAt,
      lunchBreakStartsAt: settings.lunchBreakStartsAt,
      lunchBreakEndsAt: settings.lunchBreakEndsAt,
      blocks: blocks.map((block) => ({
        id: block.id,
        label: block.label,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        isPrimary: block.isPrimary,
        sortOrder: block.sortOrder
      }))
    });

    if (!rows.length) {
      throw new BadRequestException("No periods could be generated from the current operating hours.");
    }

    await this.db
      .delete(timetablePeriods)
      .where(
        and(
          eq(timetablePeriods.tenantId, tenantId),
          eq(timetablePeriods.academicYearId, dto.academicYearId)
        )
      );

    const created = await this.db.insert(timetablePeriods).values(rows).returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "timetable_periods.generate",
      recordType: "TimetablePeriod",
      recordId: dto.academicYearId,
      after: { count: created.length }
    });

    return { generated: created.length, periods: created };
  }

  async listSlots(tenantId: string, query: ListTimetableSlotsQueryDto) {
    const filters = [eq(timetableSlots.tenantId, tenantId)];

    if (query.classroomId) {
      filters.push(eq(timetableSlots.classroomId, query.classroomId));
    }

    if (query.staffId) {
      filters.push(eq(timetableSlots.teacherStaffId, query.staffId));
    }

    if (query.academicYearId) {
      filters.push(eq(timetablePeriods.academicYearId, query.academicYearId));
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
        subjectName: subjects.name,
        subjectColorKey: subjects.colorKey,
        subjectIconKey: subjects.iconKey,
        teacherFullName: staff.fullName,
        periodName: timetablePeriods.name,
        periodStartsAt: timetablePeriods.startsAt,
        periodEndsAt: timetablePeriods.endsAt,
        periodType: timetablePeriods.periodType,
        isBreak: timetablePeriods.isBreak
      })
      .from(timetableSlots)
      .innerJoin(timetablePeriods, eq(timetableSlots.periodId, timetablePeriods.id))
      .leftJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
      .leftJoin(staff, eq(timetableSlots.teacherStaffId, staff.id))
      .where(and(...filters));
  }

  async getClassroomOverview(tenantId: string, classroomId: string, academicYearId?: string) {
    const [classroom] = await this.db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        gradeId: classrooms.gradeId,
        academicYearId: classrooms.academicYearId
      })
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.tenantId, tenantId)))
      .limit(1);

    if (!classroom) {
      throw new NotFoundException("Classroom not found.");
    }

    const yearId = academicYearId ?? classroom.academicYearId;
    const periods = await this.listPeriods(tenantId, yearId);
    const lessonPeriods = periods.filter((period) => !period.isBreak);
    const slots = await this.listSlots(tenantId, { classroomId, academicYearId: yearId });

    const subjectIds = new Set(slots.map((slot) => slot.subjectId));
    const teacherIds = new Set(
      slots.map((slot) => slot.teacherStaffId).filter((id): id is string => Boolean(id))
    );
    const workingDays = await this.getWorkingDays(tenantId);
    const totalLessonCells = lessonPeriods.length * workingDays.length;
    const filledCells = slots.length;
    const freePeriods = Math.max(totalLessonCells - filledCells, 0);

    return {
      classroom,
      workingDays,
      stats: {
        periodsPerWeek: filledCells,
        subjects: subjectIds.size,
        teachers: teacherIds.size,
        freePeriods
      },
      periods,
      slots
    };
  }

  private async getWorkingDays(tenantId: string) {
    const [settings] = await this.db
      .select({ workingDays: schoolScheduleSettings.workingDays })
      .from(schoolScheduleSettings)
      .where(eq(schoolScheduleSettings.tenantId, tenantId))
      .limit(1);

    return settings?.workingDays?.length ? settings.workingDays : [1, 2, 3, 4, 5];
  }

  async createSlot(tenantId: string, actorUserId: string, dto: CreateTimetableSlotDto) {
    const [period] = await this.db
      .select()
      .from(timetablePeriods)
      .where(and(eq(timetablePeriods.id, dto.periodId), eq(timetablePeriods.tenantId, tenantId)))
      .limit(1);

    if (!period) {
      throw new NotFoundException("Period not found.");
    }

    if (period.isBreak) {
      throw new BadRequestException("Cannot assign lessons to break periods.");
    }

    const workingDays = await this.getWorkingDays(tenantId);
    if (!workingDays.includes(dto.dayOfWeek)) {
      throw new BadRequestException("Selected day is not a configured working day.");
    }

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

    const [teacherConflict] = dto.staffId
      ? await this.db
          .select()
          .from(timetableSlots)
          .where(
            and(
              eq(timetableSlots.tenantId, tenantId),
              eq(timetableSlots.teacherStaffId, dto.staffId),
              eq(timetableSlots.periodId, dto.periodId),
              eq(timetableSlots.dayOfWeek, dto.dayOfWeek)
            )
          )
      : [undefined];

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
        teacherStaffId: dto.staffId ?? null,
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

  async updateSlot(
    tenantId: string,
    slotId: string,
    actorUserId: string,
    dto: UpdateTimetableSlotDto
  ) {
    const [existing] = await this.db
      .select()
      .from(timetableSlots)
      .where(and(eq(timetableSlots.id, slotId), eq(timetableSlots.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Timetable slot not found.");
    }

    const [period] = await this.db
      .select()
      .from(timetablePeriods)
      .where(and(eq(timetablePeriods.id, existing.periodId), eq(timetablePeriods.tenantId, tenantId)))
      .limit(1);

    if (!period || period.isBreak) {
      throw new BadRequestException("Cannot assign lessons to break periods.");
    }

    const [classroomConflict] = await this.db
      .select()
      .from(timetableSlots)
      .where(
        and(
          eq(timetableSlots.tenantId, tenantId),
          eq(timetableSlots.classroomId, existing.classroomId),
          eq(timetableSlots.periodId, existing.periodId),
          eq(timetableSlots.dayOfWeek, existing.dayOfWeek),
          ne(timetableSlots.id, slotId)
        )
      )
      .limit(1);

    if (classroomConflict) {
      throw new ConflictException("Classroom already has a class in this period");
    }

    const [teacherConflict] = dto.staffId
      ? await this.db
          .select()
          .from(timetableSlots)
          .where(
            and(
              eq(timetableSlots.tenantId, tenantId),
              eq(timetableSlots.teacherStaffId, dto.staffId),
              eq(timetableSlots.periodId, existing.periodId),
              eq(timetableSlots.dayOfWeek, existing.dayOfWeek),
              ne(timetableSlots.id, slotId)
            )
          )
          .limit(1)
      : [undefined];

    if (teacherConflict) {
      throw new ConflictException("Teacher already assigned in this period");
    }

    const [slot] = await this.db
      .update(timetableSlots)
      .set({
        subjectId: dto.subjectId,
        teacherStaffId: dto.staffId ?? null,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(timetableSlots.id, slotId), eq(timetableSlots.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "timetable_slot.update",
      recordType: "TimetableSlot",
      recordId: slotId,
      before: {
        subjectId: existing.subjectId,
        teacherStaffId: existing.teacherStaffId
      },
      after: {
        subjectId: dto.subjectId,
        teacherStaffId: dto.staffId
      }
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

    if (dto.classroomId) {
      filters.push(eq(timetableSlots.classroomId, dto.classroomId));
    }

    if (dto.academicYearId) {
      const periodRows = await this.db
        .select({ id: timetablePeriods.id })
        .from(timetablePeriods)
        .where(
          and(
            eq(timetablePeriods.tenantId, tenantId),
            eq(timetablePeriods.academicYearId, dto.academicYearId)
          )
        );
      const periodIds = periodRows.map((row) => row.id);
      if (!periodIds.length) {
        return { published: 0 };
      }
      filters.push(inArray(timetableSlots.periodId, periodIds));
    }

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
