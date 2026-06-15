import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { CreateGradeRuleDto } from "./dto.js";
import { GradingService } from "./grading.service.js";

@Controller("tenants/:tenantId")
@UseGuards(PermissionsGuard)
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Get("grade-rules")
  @RequirePermissions("grade.approve")
  listGradeRules(@Param("tenantId") tenantId: string) {
    return this.gradingService.listGradeRules(tenantId);
  }

  @Post("grade-rules")
  @RequirePermissions("grade.approve")
  createGradeRule(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateGradeRuleDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.gradingService.createGradeRule(tenantId, actorUserId, dto);
  }

  @Get("classrooms/:classroomId/grade-summary")
  @RequirePermissions("grade.approve")
  getGradeSummary(
    @Param("tenantId") tenantId: string,
    @Param("classroomId") classroomId: string
  ) {
    return this.gradingService.getGradeSummary(tenantId, classroomId);
  }
}
