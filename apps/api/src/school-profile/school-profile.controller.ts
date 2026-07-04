import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { UpdateSchoolProfileDto, UpdateTenantPreferencesDto } from "./dto.js";
import { SchoolProfileService } from "./school-profile.service.js";

@Controller("tenants/:tenantId/settings")
@UseGuards(PermissionsGuard)
export class SchoolProfileController {
  constructor(private readonly schoolProfileService: SchoolProfileService) {}

  @Get("school-profile")
  @RequirePermissions("tenant.configure")
  getProfile(@Param("tenantId") tenantId: string) {
    return this.schoolProfileService.getProfile(tenantId);
  }

  @Put("school-profile")
  @RequirePermissions("tenant.configure")
  updateProfile(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateSchoolProfileDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.schoolProfileService.updateProfile(tenantId, actorUserId, dto);
  }

  @Post("school-profile/logo")
  @RequirePermissions("tenant.configure")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 2 * 1024 * 1024 }
    })
  )
  uploadLogo(
    @Param("tenantId") tenantId: string,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.schoolProfileService.uploadLogo(tenantId, actorUserId, file);
  }

  @Get("school-profile/logo")
  // The logo appears on invoices, receipts, and payslips — every tenant role
  // may load it (student.view + report.view together cover all roles).
  @RequireAnyPermissions("student.view", "report.view", "tenant.configure")
  getLogo(@Param("tenantId") tenantId: string) {
    return this.schoolProfileService.getLogo(tenantId);
  }

  @Delete("school-profile/logo")
  @RequirePermissions("tenant.configure")
  deleteLogo(
    @Param("tenantId") tenantId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.schoolProfileService.deleteLogo(tenantId, actorUserId);
  }

  @Get("preferences")
  @RequirePermissions("tenant.configure")
  getPreferences(@Param("tenantId") tenantId: string) {
    return this.schoolProfileService.getPreferences(tenantId);
  }

  @Put("preferences")
  @RequirePermissions("tenant.configure")
  updatePreferences(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateTenantPreferencesDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.schoolProfileService.updatePreferences(tenantId, actorUserId, dto);
  }
}
