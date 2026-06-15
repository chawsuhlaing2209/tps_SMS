import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { RequireAnyPermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { TeacherScoped } from "../identity/teacher-scope.decorator.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import { ClassroomsService } from "./classrooms.service.js";

interface TenantRequest extends Request {
  tenantContext: TenantContext;
}

@Controller("tenants/:tenantId/classrooms")
@UseGuards(PermissionsGuard)
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Get()
  @RequireAnyPermissions("student.view", "student.manage")
  listClassrooms(@Req() req: TenantRequest) {
    return this.classroomsService.listClassrooms(req.tenantContext);
  }

  @Get(":classroomId")
  @RequireAnyPermissions("student.view", "student.manage")
  @TeacherScoped({ classroomIdParam: "classroomId" })
  getClassroom(@Req() req: TenantRequest, @Param("classroomId") classroomId: string) {
    return this.classroomsService.getClassroom(req.tenantContext, classroomId);
  }

  @Get(":classroomId/subjects")
  @RequireAnyPermissions("student.view", "student.manage")
  @TeacherScoped({ classroomIdParam: "classroomId" })
  listClassroomSubjects(
    @Req() req: TenantRequest,
    @Param("classroomId") classroomId: string
  ) {
    return this.classroomsService.listClassroomSubjects(req.tenantContext, classroomId);
  }
}
