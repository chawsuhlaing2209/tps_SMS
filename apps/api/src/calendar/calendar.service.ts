import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { calendarEvents } from "../db/schema.js";
import type { CreateCalendarEventDto, ListCalendarEventsQueryDto, UpdateCalendarEventDto } from "./dto.js";

@Injectable()
export class CalendarService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  async listEvents(tenantId: string, query: ListCalendarEventsQueryDto) {
    const filters = [eq(calendarEvents.tenantId, tenantId)];

    if (query.month) {
      filters.push(sql`date_trunc('month', ${calendarEvents.startsOn}::date) = ${query.month}::date`);
    }

    if (query.eventType) {
      filters.push(eq(calendarEvents.eventType, query.eventType));
    }

    if (query.academicYearId) {
      filters.push(eq(calendarEvents.academicYearId, query.academicYearId));
    }

    return this.db
      .select()
      .from(calendarEvents)
      .where(and(...filters))
      .orderBy(asc(calendarEvents.startsOn));
  }

  async createEvent(tenantId: string, actorUserId: string, dto: CreateCalendarEventDto) {
    const metadata: Record<string, unknown> = {};
    if (dto.description) metadata.description = dto.description;
    if (dto.isRecurring != null) metadata.isRecurring = dto.isRecurring;

    const [event] = await this.db
      .insert(calendarEvents)
      .values({
        tenantId,
        title: dto.title,
        eventType: dto.eventType,
        startsOn: dto.startDate,
        endsOn: dto.endDate ?? dto.startDate,
        academicYearId: dto.academicYearId ?? null,
        metadata,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "calendar_event.create",
      recordType: "CalendarEvent",
      recordId: event!.id,
      after: { title: dto.title, eventType: dto.eventType }
    });

    return event;
  }

  async updateEvent(tenantId: string, eventId: string, actorUserId: string, dto: UpdateCalendarEventDto) {
    const [existing] = await this.db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.tenantId, tenantId)));

    if (!existing) {
      throw new NotFoundException("Calendar event not found.");
    }

    const metadata: Record<string, unknown> = { ...existing.metadata };
    if (dto.description !== undefined) metadata.description = dto.description;
    if (dto.isRecurring !== undefined) metadata.isRecurring = dto.isRecurring;

    const [updated] = await this.db
      .update(calendarEvents)
      .set({
        title: dto.title ?? existing.title,
        eventType: dto.eventType ?? existing.eventType,
        startsOn: dto.startDate ?? existing.startsOn,
        endsOn: dto.endDate ?? existing.endsOn,
        academicYearId: dto.academicYearId !== undefined ? dto.academicYearId : existing.academicYearId,
        metadata,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "calendar_event.update",
      recordType: "CalendarEvent",
      recordId: eventId,
      before: { title: existing.title },
      after: { title: updated!.title }
    });

    return updated;
  }

  async deleteEvent(tenantId: string, eventId: string, actorUserId: string) {
    const [existing] = await this.db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.tenantId, tenantId)));

    if (!existing) {
      throw new NotFoundException("Calendar event not found.");
    }

    await this.db
      .delete(calendarEvents)
      .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.tenantId, tenantId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "calendar_event.delete",
      recordType: "CalendarEvent",
      recordId: eventId,
      before: { title: existing.title }
    });

    return { deleted: true };
  }
}
