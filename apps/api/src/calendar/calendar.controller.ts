import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { CalendarService } from "./calendar.service.js";
import { CreateCalendarEventDto, ListCalendarEventsQueryDto, UpdateCalendarEventDto } from "./dto.js";

@Controller("tenants/:tenantId/calendar")
@UseGuards(PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @RequireAnyPermissions("student.view", "calendar.manage")
  listEvents(
    @Param("tenantId") tenantId: string,
    @Query() query: ListCalendarEventsQueryDto
  ) {
    return this.calendarService.listEvents(tenantId, query);
  }

  @Post()
  @RequirePermissions("calendar.manage")
  createEvent(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateCalendarEventDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.calendarService.createEvent(tenantId, actorUserId, dto);
  }

  @Patch(":eventId")
  @RequirePermissions("calendar.manage")
  updateEvent(
    @Param("tenantId") tenantId: string,
    @Param("eventId") eventId: string,
    @Body() dto: UpdateCalendarEventDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.calendarService.updateEvent(tenantId, eventId, actorUserId, dto);
  }

  @Delete(":eventId")
  @RequirePermissions("calendar.manage")
  deleteEvent(
    @Param("tenantId") tenantId: string,
    @Param("eventId") eventId: string,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.calendarService.deleteEvent(tenantId, eventId, actorUserId);
  }
}
