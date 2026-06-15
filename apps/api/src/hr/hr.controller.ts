import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  RequireAnyPermissions,
  RequirePermissions
} from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import {
  CreateStaffDto,
  LinkStaffUserDto,
  ListStaffQueryDto,
  UpdateStaffDto,
  UpdateTeacherAssignmentsDto
} from "./dto.js";
import { HrService } from "./hr.service.js";
import { TeacherAssignmentsService } from "./teacher-assignments.service.js";

@Controller("tenants/:tenantId/hr")
@UseGuards(PermissionsGuard)
export class HrController {
  constructor(
    private readonly hrService: HrService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService
  ) {}

  @Get("staff")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  listStaff(@Param("tenantId") tenantId: string, @Query() query: ListStaffQueryDto) {
    return this.hrService.listStaff(tenantId, query);
  }

  @Post("staff")
  @RequirePermissions("hr.manage")
  createStaff(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateStaffDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.createStaff(tenantId, actorUserId, dto);
  }

  @Get("staff/:staffId")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  getStaff(@Param("tenantId") tenantId: string, @Param("staffId") staffId: string) {
    return this.hrService.getStaff(tenantId, staffId);
  }

  @Patch("staff/:staffId")
  @RequirePermissions("hr.manage")
  updateStaff(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Body() dto: UpdateStaffDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.updateStaff(tenantId, staffId, actorUserId, dto);
  }

  @Post("staff/:staffId/link-user")
  @RequirePermissions("hr.manage")
  linkUser(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Body() dto: LinkStaffUserDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.linkUser(tenantId, staffId, actorUserId, dto);
  }

  @Get("teacher-assignment-options")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  getTeacherAssignmentOptions(@Param("tenantId") tenantId: string) {
    return this.teacherAssignmentsService.getAssignmentOptions(tenantId);
  }

  @Get("staff/:staffId/teacher-assignments")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  getTeacherAssignments(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string
  ) {
    return this.teacherAssignmentsService.getTeacherAssignments(tenantId, staffId);
  }

  @Put("staff/:staffId/teacher-assignments")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  updateTeacherAssignments(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Body() dto: UpdateTeacherAssignmentsDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.teacherAssignmentsService.updateTeacherAssignments(
      tenantId,
      staffId,
      dto,
      actorUserId
    );
  }
}
