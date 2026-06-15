import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { RequireAnyPermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { TeacherScoped } from "../identity/teacher-scope.decorator.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import { ClassroomsService } from "./classrooms.service.js";
import { CreateClassroomDto, UpdateClassroomDto } from "./dto.js";

interface TenantRequest extends Request {
  tenantContext: TenantContext;
}

@Controller("tenants/:tenantId/classrooms")
@UseGuards(PermissionsGuard)
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Get()
  @RequireAnyPermissions("student.view", "student.manage", "classroom.manage", "academic_setup.manage")
  listClassrooms(@Req() req: TenantRequest) {
    return this.classroomsService.listClassrooms(req.tenantContext);
  }

  @Post()
  @RequireAnyPermissions("classroom.manage", "academic_setup.manage")
  createClassroom(
    @Req() req: TenantRequest,
    @Body() dto: CreateClassroomDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.classroomsService.createClassroom(req.tenantContext.tenantId, dto, actorUserId);
  }

  @Get(":classroomId")
  @RequireAnyPermissions("student.view", "student.manage", "classroom.manage", "academic_setup.manage")
  @TeacherScoped({ classroomIdParam: "classroomId" })
  getClassroom(@Req() req: TenantRequest, @Param("classroomId") classroomId: string) {
    return this.classroomsService.getClassroom(req.tenantContext, classroomId);
  }

  @Patch(":classroomId")
  @RequireAnyPermissions("classroom.manage", "academic_setup.manage")
  updateClassroom(
    @Req() req: TenantRequest,
    @Param("classroomId") classroomId: string,
    @Body() dto: UpdateClassroomDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.classroomsService.updateClassroom(
      req.tenantContext.tenantId,
      classroomId,
      dto,
      actorUserId
    );
  }

  @Post(":classroomId/archive")
  @RequireAnyPermissions("classroom.manage", "academic_setup.manage")
  archiveClassroom(
    @Req() req: TenantRequest,
    @Param("classroomId") classroomId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.classroomsService.archiveClassroom(
      req.tenantContext.tenantId,
      classroomId,
      actorUserId
    );
  }

  @Post(":classroomId/reactivate")
  @RequireAnyPermissions("classroom.manage", "academic_setup.manage")
  reactivateClassroom(
    @Req() req: TenantRequest,
    @Param("classroomId") classroomId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.classroomsService.reactivateClassroom(
      req.tenantContext.tenantId,
      classroomId,
      actorUserId
    );
  }

  @Get(":classroomId/subjects")
  @RequireAnyPermissions("student.view", "student.manage", "classroom.manage", "academic_setup.manage")
  @TeacherScoped({ classroomIdParam: "classroomId" })
  listClassroomSubjects(
    @Req() req: TenantRequest,
    @Param("classroomId") classroomId: string
  ) {
    return this.classroomsService.listClassroomSubjects(req.tenantContext, classroomId);
  }
}
