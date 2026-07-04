import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import {
  CreateLeaveRecordDto,
  CreateLeaveTypeDto,
  ListLeaveQueryDto,
  SetLeaveBalancesDto,
  UpdateLeaveTypeDto
} from "./dto.js";
import { LeavesService } from "./leaves.service.js";

@Controller("tenants/:tenantId/leaves")
@UseGuards(PermissionsGuard)
@RequirePermissions("leave.manage")
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get("types")
  listLeaveTypes(@Param("tenantId") tenantId: string) {
    return this.leavesService.listLeaveTypes(tenantId);
  }

  @Post("types")
  createLeaveType(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateLeaveTypeDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.leavesService.createLeaveType(tenantId, actorUserId, dto);
  }

  @Patch("types/:leaveTypeId")
  updateLeaveType(
    @Param("tenantId") tenantId: string,
    @Param("leaveTypeId") leaveTypeId: string,
    @Body() dto: UpdateLeaveTypeDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.leavesService.updateLeaveType(tenantId, leaveTypeId, actorUserId, dto);
  }

  @Post("types/:leaveTypeId/archive")
  archiveLeaveType(
    @Param("tenantId") tenantId: string,
    @Param("leaveTypeId") leaveTypeId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.leavesService.archiveLeaveType(tenantId, leaveTypeId, actorUserId);
  }

  @Post("types/:leaveTypeId/restore")
  restoreLeaveType(
    @Param("tenantId") tenantId: string,
    @Param("leaveTypeId") leaveTypeId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.leavesService.restoreLeaveType(tenantId, leaveTypeId, actorUserId);
  }

  @Delete("types/:leaveTypeId")
  deleteLeaveType(
    @Param("tenantId") tenantId: string,
    @Param("leaveTypeId") leaveTypeId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.leavesService.deleteLeaveType(tenantId, leaveTypeId, actorUserId);
  }

  @Get("overview")
  getLeaveOverview(
    @Param("tenantId") tenantId: string,
    @Query() query: ListLeaveQueryDto
  ) {
    const year = query.year ?? new Date().getFullYear();
    return this.leavesService.getLeaveOverview(tenantId, year);
  }

  @Get("summary/:staffId")
  getStaffLeaveSummary(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Query() query: ListLeaveQueryDto
  ) {
    const year = query.year ?? new Date().getFullYear();
    return this.leavesService.getStaffLeaveSummary(tenantId, staffId, year);
  }

  @Put("balances")
  setLeaveBalances(
    @Param("tenantId") tenantId: string,
    @Body() dto: SetLeaveBalancesDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.leavesService.setLeaveBalances(tenantId, actorUserId, dto);
  }

  @Get("records")
  listLeaveRecords(@Param("tenantId") tenantId: string, @Query() query: ListLeaveQueryDto) {
    return this.leavesService.listLeaveRecords(tenantId, query.staffId, query.year);
  }

  @Post("records")
  createLeaveRecord(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateLeaveRecordDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.leavesService.createLeaveRecord(tenantId, actorUserId, dto);
  }

  @Delete("records/:recordId")
  deleteLeaveRecord(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.leavesService.deleteLeaveRecord(tenantId, recordId, actorUserId);
  }
}
