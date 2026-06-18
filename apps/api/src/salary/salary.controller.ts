import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import {
  AdjustSalaryRecordDto,
  ApproveSalaryRecordDto,
  CreateSalaryComponentDto,
  GenerateSalaryRecordsDto,
  ListSalaryRecordsQueryDto,
  MarkSalaryPaidDto,
  UpdateSalaryComponentDto
} from "./dto.js";
import { SalaryService } from "./salary.service.js";

@Controller("tenants/:tenantId/salary")
@UseGuards(PermissionsGuard)
@RequirePermissions("salary.manage")
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  @Get("components")
  listComponents(@Param("tenantId") tenantId: string) {
    return this.salaryService.listComponents(tenantId);
  }

  @Post("components")
  createComponent(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateSalaryComponentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.salaryService.createComponent(tenantId, actorUserId, dto);
  }

  @Patch("components/:componentId")
  updateComponent(
    @Param("tenantId") tenantId: string,
    @Param("componentId") componentId: string,
    @Body() dto: UpdateSalaryComponentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.salaryService.updateComponent(tenantId, componentId, actorUserId, dto);
  }

  @Post("components/:componentId/archive")
  archiveComponent(
    @Param("tenantId") tenantId: string,
    @Param("componentId") componentId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.salaryService.archiveComponent(tenantId, componentId, actorUserId);
  }

  @Post("components/:componentId/reactivate")
  reactivateComponent(
    @Param("tenantId") tenantId: string,
    @Param("componentId") componentId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.salaryService.reactivateComponent(tenantId, componentId, actorUserId);
  }

  @Get("records")
  listRecords(@Param("tenantId") tenantId: string, @Query() query: ListSalaryRecordsQueryDto) {
    return this.salaryService.listRecords(tenantId, query);
  }

  @Post("records/generate")
  generateMonthlyRecords(
    @Param("tenantId") tenantId: string,
    @Body() dto: GenerateSalaryRecordsDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.salaryService.generateMonthlyRecords(tenantId, actorUserId, dto);
  }

  @Get("records/:recordId")
  getRecord(@Param("tenantId") tenantId: string, @Param("recordId") recordId: string) {
    return this.salaryService.getRecord(tenantId, recordId);
  }

  @Patch("records/:recordId")
  adjustRecord(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Body() dto: AdjustSalaryRecordDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.salaryService.adjustRecord(tenantId, recordId, actorUserId, dto);
  }

  @Post("records/:recordId/approve")
  approveRecord(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Body() dto: ApproveSalaryRecordDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.salaryService.approveRecord(tenantId, recordId, actorUserId, dto);
  }

  @Post("records/:recordId/pay")
  markPaid(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Body() dto: MarkSalaryPaidDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.salaryService.markPaid(tenantId, recordId, actorUserId, dto);
  }
}
