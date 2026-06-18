import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import {
  BulkResultsDto,
  CorrectAssessmentResultDto,
  CreateExamCycleDto,
  CreateExamScheduleDto,
  ListExamSchedulesQueryDto
} from "./dto.js";
import { ExamsService } from "./exams.service.js";

@Controller("tenants/:tenantId")
@UseGuards(PermissionsGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Get("exam-cycles")
  @RequirePermissions("exam.manage")
  listCycles(@Param("tenantId") tenantId: string) {
    return this.examsService.listCycles(tenantId);
  }

  @Post("exam-cycles")
  @RequirePermissions("exam.manage")
  createCycle(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateExamCycleDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.examsService.createCycle(tenantId, actorUserId, dto);
  }

  @Get("exam-schedules")
  @RequirePermissions("exam.manage")
  listSchedules(
    @Param("tenantId") tenantId: string,
    @Query() query: ListExamSchedulesQueryDto
  ) {
    return this.examsService.listSchedules(tenantId, query);
  }

  @Post("exam-schedules")
  @RequirePermissions("exam.manage")
  createSchedule(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateExamScheduleDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.examsService.createSchedule(tenantId, actorUserId, dto);
  }

  @Post("exam-schedules/:scheduleId/results")
  @RequirePermissions("exam.manage")
  bulkEnterResults(
    @Param("tenantId") tenantId: string,
    @Param("scheduleId") scheduleId: string,
    @Body() dto: BulkResultsDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.examsService.bulkEnterResults(tenantId, scheduleId, actorUserId, dto);
  }

  @Post("exam-schedules/:scheduleId/lock")
  @RequirePermissions("exam.manage")
  lockSchedule(
    @Param("tenantId") tenantId: string,
    @Param("scheduleId") scheduleId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.examsService.lockSchedule(tenantId, scheduleId, actorUserId);
  }

  @Patch("exam-schedules/:scheduleId/results/:resultId")
  @RequirePermissions("exam.manage")
  correctAssessmentResult(
    @Param("tenantId") tenantId: string,
    @Param("scheduleId") scheduleId: string,
    @Param("resultId") resultId: string,
    @Body() dto: CorrectAssessmentResultDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.examsService.correctAssessmentResult(
      tenantId,
      scheduleId,
      resultId,
      actorUserId,
      dto
    );
  }
}
