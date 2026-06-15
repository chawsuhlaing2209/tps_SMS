import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";
import { RequireAnyPermissions, RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { DiscountsService } from "./discounts.service.js";
import {
  ApproveDiscountDto,
  CreateDiscountRuleDto,
  ListStudentDiscountsQueryDto,
  RejectDiscountDto,
  RequestStudentDiscountDto
} from "./dto.js";

@Controller("tenants/:tenantId/discounts")
@UseGuards(PermissionsGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Get("rules")
  @RequirePermissions("discount.request")
  listDiscountRules(@Param("tenantId") tenantId: string) {
    return this.discountsService.listDiscountRules(tenantId);
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
