import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { AdmissionsService } from "./admissions.service.js";
import {
  ConvertEnquiryDto,
  CreateEnquiryDto,
  CreateLeadActivityDto,
  ListEnquiriesQueryDto,
  UpdateEnquiryDto
} from "./dto.js";

@Controller("tenants/:tenantId/admissions")
@UseGuards(PermissionsGuard)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get("enquiries")
  @RequirePermissions("admissions.manage")
  listEnquiries(
    @Param("tenantId") tenantId: string,
    @Query() query: ListEnquiriesQueryDto
  ) {
    return this.admissionsService.listEnquiries(tenantId, query);
  }

  @Post("enquiries")
  @RequirePermissions("admissions.manage")
  createEnquiry(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateEnquiryDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.admissionsService.createEnquiry(tenantId, actorUserId, dto);
  }

  @Get("enquiries/:enquiryId")
  @RequirePermissions("admissions.manage")
  getEnquiry(
    @Param("tenantId") tenantId: string,
    @Param("enquiryId") enquiryId: string
  ) {
    return this.admissionsService.getEnquiry(tenantId, enquiryId);
  }

  @Patch("enquiries/:enquiryId")
  @RequirePermissions("admissions.manage")
  updateEnquiry(
    @Param("tenantId") tenantId: string,
    @Param("enquiryId") enquiryId: string,
    @Body() dto: UpdateEnquiryDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.admissionsService.updateEnquiry(tenantId, enquiryId, actorUserId, dto);
  }

  @Post("enquiries/:enquiryId/activities")
  @RequirePermissions("admissions.manage")
  addActivity(
    @Param("tenantId") tenantId: string,
    @Param("enquiryId") enquiryId: string,
    @Body() dto: CreateLeadActivityDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.admissionsService.addActivity(tenantId, enquiryId, actorUserId, dto);
  }

  @Post("enquiries/:enquiryId/convert")
  @RequirePermissions("admissions.manage")
  convertEnquiry(
    @Param("tenantId") tenantId: string,
    @Param("enquiryId") enquiryId: string,
    @Body() dto: ConvertEnquiryDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.admissionsService.convertEnquiry(tenantId, enquiryId, actorUserId, dto);
  }

  @Get("dashboard")
  @RequirePermissions("admissions.manage")
  getDashboard(@Param("tenantId") tenantId: string) {
    return this.admissionsService.getDashboard(tenantId);
  }
}
