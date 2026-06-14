import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PlatformAdminGuard } from "../identity/platform-admin.guard.js";
import {
  CreateTenantDto,
  SetFeatureFlagDto,
  UpdateTenantStatusDto,
  UpsertTenantSettingsDto
} from "./dto.js";
import { TenantManagementService } from "./tenant-management.service.js";

interface PlatformRequest extends Request {
  platformActorUserId?: string;
}

@Controller("platform/tenants")
@UseGuards(PlatformAdminGuard)
export class TenantManagementController {
  constructor(private readonly tenantManagementService: TenantManagementService) {}

  @Get()
  listTenants() {
    return this.tenantManagementService.listTenants();
  }

  @Post()
  createTenant(@Body() dto: CreateTenantDto, @Req() req: PlatformRequest) {
    return this.tenantManagementService.createTenant(dto, req.platformActorUserId);
  }

  @Patch(":tenantId/status")
  updateTenantStatus(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateTenantStatusDto,
    @Req() req: PlatformRequest
  ) {
    return this.tenantManagementService.updateTenantStatus(tenantId, dto, req.platformActorUserId);
  }

  @Get(":tenantId/settings")
  getSettings(@Param("tenantId") tenantId: string) {
    return this.tenantManagementService.getTenantSettings(tenantId);
  }

  @Post(":tenantId/settings")
  upsertSettings(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpsertTenantSettingsDto,
    @Req() req: PlatformRequest
  ) {
    return this.tenantManagementService.upsertTenantSettings(tenantId, dto, req.platformActorUserId);
  }

  @Get(":tenantId/feature-flags")
  listFeatureFlags(@Param("tenantId") tenantId: string) {
    return this.tenantManagementService.listFeatureFlags(tenantId);
  }

  @Post(":tenantId/feature-flags")
  setFeatureFlag(
    @Param("tenantId") tenantId: string,
    @Body() dto: SetFeatureFlagDto,
    @Req() req: PlatformRequest
  ) {
    return this.tenantManagementService.setFeatureFlag(tenantId, dto, req.platformActorUserId);
  }
}
