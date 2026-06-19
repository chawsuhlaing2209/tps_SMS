import { Body, Controller, Get, Headers, Param, Put, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import type { SchoolScheduleSettings } from "@sms/shared";
import { SchoolScheduleService } from "./school-schedule.service.js";

@Controller("tenants/:tenantId/settings/school-schedule")
@UseGuards(PermissionsGuard)
export class SchoolScheduleController {
  constructor(private readonly schoolScheduleService: SchoolScheduleService) {}

  @Get()
  @RequirePermissions("academic_setup.manage")
  getSettings(@Param("tenantId") tenantId: string) {
    return this.schoolScheduleService.getSettings(tenantId);
  }

  @Put()
  @RequirePermissions("academic_setup.manage")
  upsertSettings(
    @Param("tenantId") tenantId: string,
    @Body() body: SchoolScheduleSettings,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.schoolScheduleService.upsertSettings(tenantId, actorUserId, body);
  }
}
