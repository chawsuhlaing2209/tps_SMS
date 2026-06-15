import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { GenerateReportCardsDto, ListReportCardsQueryDto } from "./dto.js";
import { ReportCardsService } from "./report-cards.service.js";

@Controller("tenants/:tenantId/report-cards")
@UseGuards(PermissionsGuard)
export class ReportCardsController {
  constructor(private readonly reportCardsService: ReportCardsService) {}

  @Get()
  @RequirePermissions("report_card.generate")
  list(
    @Param("tenantId") tenantId: string,
    @Query() query: ListReportCardsQueryDto
  ) {
    return this.reportCardsService.list(tenantId, query);
  }

  @Post("generate")
  @RequirePermissions("report_card.generate")
  generate(
    @Param("tenantId") tenantId: string,
    @Body() dto: GenerateReportCardsDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.reportCardsService.generate(tenantId, actorUserId, dto);
  }

  @Get(":reportCardId")
  @RequirePermissions("report_card.generate")
  getById(
    @Param("tenantId") tenantId: string,
    @Param("reportCardId") reportCardId: string
  ) {
    return this.reportCardsService.getById(tenantId, reportCardId);
  }

  @Post(":reportCardId/approve")
  @RequirePermissions("report_card.approve")
  approve(
    @Param("tenantId") tenantId: string,
    @Param("reportCardId") reportCardId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.reportCardsService.approve(tenantId, reportCardId, actorUserId);
  }

  @Post(":reportCardId/publish")
  @RequirePermissions("report_card.approve")
  publish(
    @Param("tenantId") tenantId: string,
    @Param("reportCardId") reportCardId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.reportCardsService.publish(tenantId, reportCardId, actorUserId);
  }
}
