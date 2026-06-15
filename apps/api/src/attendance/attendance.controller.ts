import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AttendanceService } from "./attendance.service.js";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { TeacherScoped } from "../identity/teacher-scope.decorator.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import {
  OpenAttendanceSessionDto,
  BulkMarkRecordsDto,
  CorrectAttendanceRecordDto,
  AttendanceReportQueryDto
} from "./dto.js";

interface TenantRequest extends Request {
  tenantContext: TenantContext;
}

@Controller("tenants/:tenantId/attendance-sessions")
@UseGuards(PermissionsGuard)
export class AttendanceSessionsController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get(":sessionId")
  @RequireAnyPermissions("attendance.mark", "attendance.audit.view")
  @TeacherScoped({ attendanceSessionIdParam: "sessionId" })
  getAttendanceSession(@Req() req: TenantRequest, @Param("sessionId") sessionId: string) {
    return this.attendanceService.getSession(req.tenantContext, sessionId);
  }
}

@Controller("tenants/:tenantId/classrooms/:classroomId/attendance-sessions")
@UseGuards(PermissionsGuard)
export class ClassroomAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequireAnyPermissions("attendance.mark", "attendance.audit.view")
  @TeacherScoped({ classroomIdParam: "classroomId", subjectIdQuery: "subjectId" })
  listAttendanceSessions(
    @Req() req: TenantRequest,
    @Param("classroomId") classroomId: string,
    @Query("subjectId") subjectId?: string
  ) {
    return this.attendanceService.listSessions(req.tenantContext, classroomId, subjectId);
  }

  @Post()
  @RequirePermissions("attendance.mark")
  openAttendanceSession(
    @Param("tenantId") tenantId: string,
    @Param("classroomId") classroomId: string,
    @Body() dto: OpenAttendanceSessionDto,
    @Headers("x-user-id") userId: string
  ) {
    return this.attendanceService.openSession(tenantId, classroomId, dto, userId);
  }

  @Post(":sessionId/records")
  @RequirePermissions("attendance.mark")
  bulkMarkRecords(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() dto: BulkMarkRecordsDto,
    @Headers("x-user-id") userId: string
  ) {
    return this.attendanceService.bulkMarkRecords(tenantId, sessionId, dto, userId);
  }

  @Patch(":sessionId/records/:recordId")
  @RequirePermissions("attendance.mark")
  correctAttendanceRecord(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Param("recordId") recordId: string,
    @Body() dto: CorrectAttendanceRecordDto,
    @Headers("x-user-id") userId: string
  ) {
    return this.attendanceService.correctRecord(tenantId, sessionId, recordId, dto, userId);
  }

  @Post(":sessionId/close")
  @RequirePermissions("attendance.mark")
  closeAttendanceSession(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Headers("x-user-id") userId: string
  ) {
    return this.attendanceService.closeSession(tenantId, sessionId, userId);
  }
}

@Controller("tenants/:tenantId/attendance")
@UseGuards(PermissionsGuard)
export class AttendanceReportController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get("reports")
  @RequireAnyPermissions("attendance.mark", "attendance.audit.view")
  getAttendanceReport(
    @Param("tenantId") tenantId: string,
    @Query() query: AttendanceReportQueryDto
  ) {
    return this.attendanceService.getAttendanceReport(tenantId, query);
  }
}
