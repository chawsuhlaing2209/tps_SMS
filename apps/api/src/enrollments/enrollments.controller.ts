import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import {
  CreateEnrollmentDto,
  CreateStudentServiceDto,
  ListEnrollmentsQueryDto,
  ListStudentServicesQueryDto,
  UpdateEnrollmentDto
} from "./dto.js";
import { EnrollmentsService } from "./enrollments.service.js";

@Controller("tenants/:tenantId")
@UseGuards(PermissionsGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get("enrollments")
  @RequirePermissions("student.manage")
  listEnrollments(
    @Param("tenantId") tenantId: string,
    @Query() query: ListEnrollmentsQueryDto
  ) {
    return this.enrollmentsService.listEnrollments(tenantId, query);
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
