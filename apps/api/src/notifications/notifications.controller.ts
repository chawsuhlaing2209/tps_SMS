import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { EmailTemplatesService } from "./email-templates.service.js";
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  ListNotificationLogsDto
} from "./dto.js";

@Controller("tenants/:tenantId")
@UseGuards(PermissionsGuard)
export class NotificationsController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get("email-templates")
  @RequirePermissions("communication.manage")
  listEmailTemplates(@Param("tenantId") tenantId: string) {
    return this.emailTemplatesService.listEmailTemplates(tenantId);
  }

  @Post("email-templates")
  @RequirePermissions("communication.manage")
  createEmailTemplate(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateEmailTemplateDto,
    @Headers("x-user-id") userId: string
  ) {
    return this.emailTemplatesService.createEmailTemplate(tenantId, dto, userId);
  }

  @Patch("email-templates/:templateId")
  @RequirePermissions("communication.manage")
  updateEmailTemplate(
    @Param("tenantId") tenantId: string,
    @Param("templateId") templateId: string,
    @Body() dto: UpdateEmailTemplateDto,
    @Headers("x-user-id") userId: string
  ) {
    return this.emailTemplatesService.updateEmailTemplate(tenantId, templateId, dto, userId);
  }

  @Get("notification-logs")
  @RequirePermissions("communication.manage")
  listNotificationLogs(
    @Param("tenantId") tenantId: string,
    @Query() query: ListNotificationLogsDto
  ) {
    return this.emailTemplatesService.listNotificationLogs(tenantId, query);
  }

  @Post("notification-logs/:logId/resend")
  @RequirePermissions("communication.manage")
  resendNotification(
    @Param("tenantId") tenantId: string,
    @Param("logId") logId: string,
    @Headers("x-user-id") userId: string
  ) {
    return this.emailTemplatesService.resendNotification(tenantId, logId, userId);
  }
}
