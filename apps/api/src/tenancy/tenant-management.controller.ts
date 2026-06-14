import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../identity/platform-admin.guard.js";
import {
  CreateTenantDto,
  SetFeatureFlagDto,
  UpdateTenantStatusDto,
  UpsertTenantSettingsDto
} from "./dto.js";
import { TenantManagementService } from "./tenant-management.service.js";

@Controller("platform/tenants")
@UseGuards(PlatformAdminGuard)
export class TenantManagementController {
  constructor(private readonly tenantManagementService: TenantManagementService) {}

  @Get()
  listTenants() {
    return this.tenantManagementService.listTenants();
  }

  @Post()
  createTenant(@Body() dto: CreateTenantDto, @Headers("x-user-id") actorUserId?: string) {
    return this.tenantManagementService.createTenant(dto, actorUserId);
  }

  @Patch(":tenantId/status")
  updateTenantStatus(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateTenantStatusDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.tenantManagementService.updateTenantStatus(tenantId, dto, actorUserId);
  }

  @Get(":tenantId/settings")
  getSettings(@Param("tenantId") tenantId: string) {
    return this.tenantManagementService.getTenantSettings(tenantId);
  }

  @Post(":tenantId/settings")
  upsertSettings(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpsertTenantSettingsDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.tenantManagementService.upsertTenantSettings(tenantId, dto, actorUserId);
  }

  @Get(":tenantId/feature-flags")
  listFeatureFlags(@Param("tenantId") tenantId: string) {
    return this.tenantManagementService.listFeatureFlags(tenantId);
  }

  @Post(":tenantId/feature-flags")
  setFeatureFlag(
    @Param("tenantId") tenantId: string,
    @Body() dto: SetFeatureFlagDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.tenantManagementService.setFeatureFlag(tenantId, dto, actorUserId);
  }
}
