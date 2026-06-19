import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { TimetableService } from "./timetable.service.js";
import {
  ClassroomOverviewQueryDto,
  CreatePeriodDto,
  CreateTimetableSlotDto,
  GeneratePeriodsDto,
  ListPeriodsQueryDto,
  ListTimetableSlotsQueryDto,
  PublishTimetableDto,
  UpdateTimetableSlotDto
} from "./dto.js";

@Controller("tenants/:tenantId/timetable")
@UseGuards(PermissionsGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get("periods")
  @RequireAnyPermissions("timetable.manage", "student.view")
  listPeriods(@Param("tenantId") tenantId: string, @Query() query: ListPeriodsQueryDto) {
    return this.timetableService.listPeriods(tenantId, query.academicYearId);
  }

  @Post("periods")
  @RequirePermissions("timetable.manage")
  createPeriod(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreatePeriodDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.timetableService.createPeriod(tenantId, actorUserId, dto);
  }

  @Post("periods/generate")
  @RequirePermissions("timetable.manage")
  generatePeriods(
    @Param("tenantId") tenantId: string,
    @Body() dto: GeneratePeriodsDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.timetableService.generatePeriods(tenantId, actorUserId, dto);
  }

  @Get("classrooms/:classroomId/overview")
  @RequireAnyPermissions("timetable.manage", "student.view")
  getClassroomOverview(
    @Param("tenantId") tenantId: string,
    @Param("classroomId") classroomId: string,
    @Query() query: ClassroomOverviewQueryDto
  ) {
    return this.timetableService.getClassroomOverview(tenantId, classroomId, query.academicYearId);
  }

  @Get("slots")
  @RequireAnyPermissions("timetable.manage", "student.view")
  listSlots(
    @Param("tenantId") tenantId: string,
    @Query() query: ListTimetableSlotsQueryDto
  ) {
    return this.timetableService.listSlots(tenantId, query);
  }

  @Post("slots")
  @RequirePermissions("timetable.manage")
  createSlot(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateTimetableSlotDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.timetableService.createSlot(tenantId, actorUserId, dto);
  }

  @Patch("slots/:slotId")
  @RequirePermissions("timetable.manage")
  updateSlot(
    @Param("tenantId") tenantId: string,
    @Param("slotId") slotId: string,
    @Body() dto: UpdateTimetableSlotDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.timetableService.updateSlot(tenantId, slotId, actorUserId, dto);
  }

  @Delete("slots/:slotId")
  @RequirePermissions("timetable.manage")
  deleteSlot(
    @Param("tenantId") tenantId: string,
    @Param("slotId") slotId: string,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.timetableService.deleteSlot(tenantId, slotId, actorUserId);
  }

  @Post("publish")
  @RequirePermissions("timetable.manage")
  publishTimetable(
    @Param("tenantId") tenantId: string,
    @Body() dto: PublishTimetableDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.timetableService.publishTimetable(tenantId, actorUserId, dto);
  }
}
