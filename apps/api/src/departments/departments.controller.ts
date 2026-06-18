import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { DepartmentsService } from "./departments.service.js";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./dto.js";

@Controller("tenants/:tenantId/departments")
@UseGuards(PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  listDepartments(@Param("tenantId") tenantId: string) {
    return this.departmentsService.listDepartments(tenantId);
  }

  @Get("active")
  @RequireAnyPermissions("hr.manage", "classroom.manage")
  listActiveDepartments(@Param("tenantId") tenantId: string) {
    return this.departmentsService.listActiveDepartments(tenantId);
  }

  @Post()
  @RequirePermissions("hr.manage")
  createDepartment(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateDepartmentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.departmentsService.createDepartment(tenantId, actorUserId, dto);
  }

  @Patch(":departmentId")
  @RequirePermissions("hr.manage")
  updateDepartment(
    @Param("tenantId") tenantId: string,
    @Param("departmentId") departmentId: string,
    @Body() dto: UpdateDepartmentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.departmentsService.updateDepartment(tenantId, departmentId, actorUserId, dto);
  }
}
