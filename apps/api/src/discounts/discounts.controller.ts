import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { DiscountsService } from "./discounts.service.js";
import {
  ApproveDiscountDto,
  CreateDiscountRuleDto,
  ListStudentDiscountsQueryDto,
  RejectDiscountDto,
  RequestStudentDiscountDto,
  UpdateDiscountRuleDto
} from "./dto.js";

@Controller("tenants/:tenantId/discounts")
@UseGuards(PermissionsGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get("rules")
  @RequireAnyPermissions("discount.request", "discount.approve")
  listDiscountRules(@Param("tenantId") tenantId: string) {
    return this.discountsService.listDiscountRules(tenantId);
  }

  @Get("metrics")
  @RequireAnyPermissions("discount.request", "discount.approve")
  getDiscountMetrics(
    @Param("tenantId") tenantId: string,
    @Query("academicYearId") academicYearId?: string
  ) {
    return this.discountsService.getDiscountMetrics(tenantId, academicYearId);
  }

  @Post("rules")
  @RequirePermissions("discount.approve")
  createDiscountRule(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateDiscountRuleDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.createDiscountRule(tenantId, actorUserId, dto);
  }

  @Patch("rules/:ruleId")
  @RequirePermissions("discount.approve")
  updateDiscountRule(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdateDiscountRuleDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.updateDiscountRule(tenantId, ruleId, actorUserId, dto);
  }

  @Post("rules/:ruleId/enable")
  @RequirePermissions("discount.approve")
  enableDiscountRule(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.enableDiscountRule(tenantId, ruleId, actorUserId);
  }

  @Post("rules/:ruleId/disable")
  @RequirePermissions("discount.approve")
  disableDiscountRule(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.disableDiscountRule(tenantId, ruleId, actorUserId);
  }

  @Post("rules/:ruleId/archive")
  @RequirePermissions("discount.approve")
  archiveDiscountRule(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.archiveDiscountRule(tenantId, ruleId, actorUserId);
  }

  @Post("rules/:ruleId/restore")
  @RequirePermissions("discount.approve")
  restoreDiscountRule(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.restoreDiscountRule(tenantId, ruleId, actorUserId);
  }

  /** @deprecated Use POST rules/:ruleId/restore. */
  @Post("rules/:ruleId/reactivate")
  @RequirePermissions("discount.approve")
  reactivateDiscountRule(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.restoreDiscountRule(tenantId, ruleId, actorUserId);
  }

  @Delete("rules/:ruleId")
  @RequirePermissions("discount.approve")
  deleteDiscountRule(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.deleteDiscountRule(tenantId, ruleId, actorUserId);
  }

  @Get("student-discounts")
  @RequireAnyPermissions("discount.request", "discount.approve")
  listStudentDiscounts(
    @Param("tenantId") tenantId: string,
    @Query() query: ListStudentDiscountsQueryDto
  ) {
    return this.discountsService.listStudentDiscounts(tenantId, query);
  }

  @Post("student-discounts")
  @RequirePermissions("discount.request")
  requestDiscount(
    @Param("tenantId") tenantId: string,
    @Body() dto: RequestStudentDiscountDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.requestDiscount(tenantId, actorUserId, dto);
  }

  @Post("student-discounts/:discountId/approve")
  @RequirePermissions("discount.approve")
  approveDiscount(
    @Param("tenantId") tenantId: string,
    @Param("discountId") discountId: string,
    @Body() dto: ApproveDiscountDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.approveDiscount(tenantId, discountId, actorUserId, dto);
  }

  @Post("student-discounts/:discountId/reject")
  @RequirePermissions("discount.approve")
  rejectDiscount(
    @Param("tenantId") tenantId: string,
    @Param("discountId") discountId: string,
    @Body() dto: RejectDiscountDto,
    @Headers("x-user-id") actorUserId: string
  ) {
    return this.discountsService.rejectDiscount(tenantId, discountId, actorUserId, dto);
  }
}
