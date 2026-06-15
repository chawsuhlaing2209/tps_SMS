import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { CreateAssignmentDto, CreateMaterialDto, UpdateAssignmentDto } from "./dto.js";
import { LmsService } from "./lms.service.js";

@Controller("tenants/:tenantId/lms")
@UseGuards(PermissionsGuard)
export class LmsController {
  constructor(private readonly lmsService: LmsService) {}

  @Get("classrooms/:classroomId/materials")
  @RequirePermissions("lms.manage")
  listMaterials(
    @Param("tenantId") tenantId: string,
    @Param("classroomId") classroomId: string
  ) {
    return this.lmsService.listMaterials(tenantId, classroomId);
  }

  @Post("classrooms/:classroomId/materials")
  @RequirePermissions("lms.manage")
  createMaterial(
    @Param("tenantId") tenantId: string,
    @Param("classroomId") classroomId: string,
    @Body() dto: CreateMaterialDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.lmsService.createMaterial(tenantId, classroomId, actorUserId, dto);
  }

  @Get("classrooms/:classroomId/assignments")
  @RequirePermissions("lms.manage")
  listAssignments(
    @Param("tenantId") tenantId: string,
    @Param("classroomId") classroomId: string
  ) {
    return this.lmsService.listAssignments(tenantId, classroomId);
  }

  @Post("classrooms/:classroomId/assignments")
  @RequirePermissions("lms.manage")
  createAssignment(
    @Param("tenantId") tenantId: string,
    @Param("classroomId") classroomId: string,
    @Body() dto: CreateAssignmentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.lmsService.createAssignment(tenantId, classroomId, actorUserId, dto);
  }

  @Patch("assignments/:assignmentId")
  @RequirePermissions("lms.manage")
  updateAssignment(
    @Param("tenantId") tenantId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.lmsService.updateAssignment(tenantId, assignmentId, actorUserId, dto);
  }
}
