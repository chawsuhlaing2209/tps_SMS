import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { TenantContext } from "../tenancy/tenant-context.js";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
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

type GuardedRequest = Request & { tenantContext?: TenantContext };

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
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateEnrollmentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.enrollmentsService.createEnrollment(tenantId, actorUserId, dto);
  }

  @Post("enrollments/:enrollmentId/confirm")
  @RequirePermissions("student.manage")
  confirmEnrollment(
    @Param("tenantId") tenantId: string,
    @Param("enrollmentId") enrollmentId: string,
    @Body() dto: ConfirmEnrollmentDto,
    @Req() req: GuardedRequest
  ) {
    const actorUserId = req.tenantContext?.actorUserId;
    const permissions = req.tenantContext?.permissions ?? [];
    return this.enrollmentsService.confirmEnrollment(
      tenantId,
      enrollmentId,
      actorUserId,
      dto,
      permissions
    );
  }

  @Patch("enrollments/:enrollmentId")
  @RequirePermissions("student.manage")
  updateEnrollment(
    @Param("tenantId") tenantId: string,
    @Param("enrollmentId") enrollmentId: string,
    @Body() dto: UpdateEnrollmentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.enrollmentsService.updateEnrollment(tenantId, enrollmentId, actorUserId, dto);
  }

  @Delete("enrollments/:enrollmentId")
  @RequirePermissions("student.manage")
  deleteEnrollment(
    @Param("tenantId") tenantId: string,
    @Param("enrollmentId") enrollmentId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.enrollmentsService.deleteEnrollment(tenantId, enrollmentId, actorUserId);
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
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateStudentServiceDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.enrollmentsService.createStudentService(tenantId, actorUserId, dto);
  }

  @Delete("student-services/:serviceId")
  @RequirePermissions("student.manage")
  removeStudentService(
    @Param("tenantId") tenantId: string,
    @Param("serviceId") serviceId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.enrollmentsService.removeStudentService(tenantId, serviceId, actorUserId);
  }
}
