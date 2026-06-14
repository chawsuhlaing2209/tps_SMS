import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AttendanceService } from "./attendance.service.js";
import { RequireAnyPermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { TeacherScoped } from "../identity/teacher-scope.decorator.js";
import type { TenantContext } from "../tenancy/tenant-context.js";

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
    @Param("classroomId") classroomId: string
  ) {
    const subjectId = readOptionalQuery(req.query?.subjectId);
    return this.attendanceService.listSessions(req.tenantContext, classroomId, subjectId);
  }
}

function readOptionalQuery(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}
