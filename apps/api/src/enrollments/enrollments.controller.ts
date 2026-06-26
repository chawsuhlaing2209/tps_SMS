import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { ReqTenantContext } from "../identity/tenant-context.decorator.js";
import type { TenantContext } from "../tenancy/tenant-context.js";
import {
  ConfirmEnrollmentDto,
  CreateEnrollmentDto,
  CreateStudentServiceDto,
  ListAvailableStudentServicesQueryDto,
  ListEnrollmentsQueryDto,
  ListStudentServicesQueryDto,
  PreviewAddStudentServiceDto,
  PreviewEnrollmentDto,
  UpdateEnrollmentDto
} from "./dto.js";
import { EnrollmentsService } from "./enrollments.service.js";

@Controller("tenants/:tenantId")
@UseGuards(PermissionsGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post("enrollments/preview")
  @RequirePermissions("student.manage")
  previewEnrollment(@Param("tenantId") tenantId: string, @Body() dto: PreviewEnrollmentDto) {
    return this.enrollmentsService.previewEnrollment(tenantId, dto);
  }

  @Get("enrollments")
  @RequirePermissions("student.manage")
  listEnrollments(
    @Param("tenantId") tenantId: string,
    @Query() query: ListEnrollmentsQueryDto
  ) {
    return this.enrollmentsService.listEnrollments(tenantId, query);
  }

  @Get("enrollments/:enrollmentId")
  @RequirePermissions("student.manage")
  getEnrollment(
    @Param("tenantId") tenantId: string,
    @Param("enrollmentId") enrollmentId: string
  ) {
    return this.enrollmentsService.getEnrollment(tenantId, enrollmentId);
  }

  @Post("enrollments")
  @RequirePermissions("student.manage")
  createEnrollment(
    @ReqTenantContext() context: TenantContext,
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateEnrollmentDto
  ) {
    return this.enrollmentsService.createEnrollment(tenantId, context.actorUserId, dto);
  }

  @Post("enrollments/:enrollmentId/confirm")
  @RequirePermissions("student.manage")
  confirmEnrollment(
    @ReqTenantContext() context: TenantContext,
    @Param("tenantId") tenantId: string,
    @Param("enrollmentId") enrollmentId: string,
    @Body() dto: ConfirmEnrollmentDto
  ) {
    return this.enrollmentsService.confirmEnrollment(
      tenantId,
      enrollmentId,
      context.actorUserId,
      dto,
      context.permissions
    );
  }

  @Patch("enrollments/:enrollmentId")
  @RequirePermissions("student.manage")
  updateEnrollment(
    @ReqTenantContext() context: TenantContext,
    @Param("tenantId") tenantId: string,
    @Param("enrollmentId") enrollmentId: string,
    @Body() dto: UpdateEnrollmentDto
  ) {
    return this.enrollmentsService.updateEnrollment(
      tenantId,
      enrollmentId,
      context.actorUserId,
      dto
    );
  }

  @Delete("enrollments/:enrollmentId")
  @RequirePermissions("student.manage")
  deleteEnrollment(
    @ReqTenantContext() context: TenantContext,
    @Param("tenantId") tenantId: string,
    @Param("enrollmentId") enrollmentId: string
  ) {
    return this.enrollmentsService.deleteEnrollment(tenantId, enrollmentId, context.actorUserId);
  }

  @Get("student-services/available")
  @RequirePermissions("student.manage")
  listAvailableOptionalServices(
    @Param("tenantId") tenantId: string,
    @Query() query: ListAvailableStudentServicesQueryDto
  ) {
    return this.enrollmentsService.listAvailableOptionalServices(tenantId, query.studentId);
  }

  @Post("student-services/preview")
  @RequirePermissions("student.manage")
  previewAddStudentService(
    @Param("tenantId") tenantId: string,
    @Body() dto: PreviewAddStudentServiceDto
  ) {
    return this.enrollmentsService.previewAddStudentService(tenantId, dto);
  }

  @Get("student-services")
  @RequirePermissions("student.manage")
  listStudentServices(
    @Param("tenantId") tenantId: string,
    @Query() query: ListStudentServicesQueryDto
  ) {
    return this.enrollmentsService.listStudentServices(tenantId, query);
  }

  @Post("student-services")
  @RequirePermissions("student.manage")
  createStudentService(
    @ReqTenantContext() context: TenantContext,
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateStudentServiceDto
  ) {
    return this.enrollmentsService.createStudentService(tenantId, context.actorUserId, dto);
  }

  @Delete("student-services/:serviceId")
  @RequirePermissions("student.manage")
  removeStudentService(
    @ReqTenantContext() context: TenantContext,
    @Param("tenantId") tenantId: string,
    @Param("serviceId") serviceId: string
  ) {
    return this.enrollmentsService.removeStudentService(tenantId, serviceId, context.actorUserId);
  }
}
