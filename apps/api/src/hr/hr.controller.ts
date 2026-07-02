import {
  Body,
  Controller,
  Delete,
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
  BulkIdsDto,
  CreateStaffDto,
  LinkStaffUserDto,
  ListStaffQueryDto,
  ProvisionStaffDto,
  ProvisionStaffUpdateDto,
  UpdateStaffDto,
  UpdateTeacherAssignmentsDto,
  UpdateTeacherTeachingSetupDto
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

  @Get("assignable-roles")
  @RequireAnyPermissions("hr.manage", "identity.manage")
  listAssignableRoles(
    @Param("tenantId") tenantId: string,
    @Query("scope") scope?: "team" | "teacher"
  ) {
    return this.hrService.listAssignableRoles(tenantId, scope);
  }

  @Get("staff")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  async listStaff(@Param("tenantId") tenantId: string, @Query() query: ListStaffQueryDto) {
    const [data, total] = await Promise.all([
      this.hrService.listStaff(tenantId, query),
      this.hrService.countStaff(tenantId, query)
    ]);
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;
    return { data, total, limit, offset };
  }

  @Get("staff/overview")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  listStaffOverview(@Param("tenantId") tenantId: string, @Query() query: ListStaffQueryDto) {
    return this.hrService.listStaffOverview(tenantId, query);
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

  @Post("staff/provision")
  @RequirePermissions("hr.manage")
  provisionStaff(
    @Param("tenantId") tenantId: string,
    @Body() dto: ProvisionStaffDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.provisionStaff(tenantId, actorUserId, dto);
  }

  @Get("staff/:staffId/teacher-profile")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  getTeacherProfile(@Param("tenantId") tenantId: string, @Param("staffId") staffId: string) {
    return this.hrService.getTeacherProfile(tenantId, staffId);
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

  @Post("staff/bulk-archive")
  @RequirePermissions("hr.manage")
  bulkArchiveStaff(
    @Param("tenantId") tenantId: string,
    @Body() dto: BulkIdsDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.bulkArchiveStaff(tenantId, dto.ids, actorUserId);
  }

  @Post("staff/bulk-restore")
  @RequirePermissions("hr.manage")
  bulkRestoreStaff(
    @Param("tenantId") tenantId: string,
    @Body() dto: BulkIdsDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.bulkRestoreStaff(tenantId, dto.ids, actorUserId);
  }

  @Post("staff/:staffId/archive")
  @RequirePermissions("hr.manage")
  archiveStaff(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.archiveStaff(tenantId, staffId, actorUserId);
  }

  @Post("staff/:staffId/restore")
  @RequirePermissions("hr.manage")
  restoreStaff(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.restoreStaff(tenantId, staffId, actorUserId);
  }

  @Delete("staff/:staffId")
  @RequirePermissions("hr.manage")
  deleteStaff(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.permanentlyDeleteStaff(tenantId, staffId, actorUserId);
  }

  @Patch("staff/:staffId/provision")
  @RequirePermissions("hr.manage")
  provisionUpdateStaff(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Body() dto: ProvisionStaffUpdateDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.hrService.provisionUpdateStaff(tenantId, staffId, actorUserId, dto);
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

  @Get("staff/:staffId/teaching-setup")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  getTeachingSetup(@Param("tenantId") tenantId: string, @Param("staffId") staffId: string) {
    return this.teacherAssignmentsService.getTeachingSetup(tenantId, staffId);
  }

  @Put("staff/:staffId/teaching-setup")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  updateTeachingSetup(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Body() dto: UpdateTeacherTeachingSetupDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.teacherAssignmentsService.updateTeachingSetup(
      tenantId,
      staffId,
      dto,
      actorUserId
    );
  }
}
