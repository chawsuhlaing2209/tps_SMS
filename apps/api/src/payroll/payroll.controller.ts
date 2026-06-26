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
  Res,
  UseGuards
} from "@nestjs/common";
import type { Response } from "express";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import {
  ApprovePayrollRecordDto,
  CreateBenefitPackageDto,
  CreateIncentiveProgramDto,
  CreatePayComponentDto,
  CreatePayrollRunDto,
  EnrollStaffBenefitDto,
  ListPayrollRecordsQueryDto,
  ListPayrollRunsQueryDto,
  MarkPayrollPaidDto,
  PatchPayrollRecordDto,
  SetIncentiveEligibilityDto,
  UpdateBenefitPackageDto,
  UpdateIncentiveProgramDto,
  UpdatePayComponentDto,
  UpsertStaffCompensationDto
} from "./dto.js";
import { PayrollService } from "./payroll.service.js";

@Controller("tenants/:tenantId")
@UseGuards(PermissionsGuard)
@RequirePermissions("salary.manage")
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get("pay-components")
  listPayComponents(@Param("tenantId") tenantId: string) {
    return this.payrollService.listPayComponents(tenantId);
  }

  @Post("pay-components")
  createPayComponent(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreatePayComponentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.createPayComponent(tenantId, actorUserId, dto);
  }

  @Patch("pay-components/:componentId")
  updatePayComponent(
    @Param("tenantId") tenantId: string,
    @Param("componentId") componentId: string,
    @Body() dto: UpdatePayComponentDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.updatePayComponent(tenantId, componentId, actorUserId, dto);
  }

  @Post("pay-components/:componentId/archive")
  archivePayComponent(
    @Param("tenantId") tenantId: string,
    @Param("componentId") componentId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.archivePayComponent(tenantId, componentId, actorUserId);
  }

  @Post("pay-components/:componentId/reactivate")
  reactivatePayComponent(
    @Param("tenantId") tenantId: string,
    @Param("componentId") componentId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.reactivatePayComponent(tenantId, componentId, actorUserId);
  }

  @Delete("pay-components/:componentId")
  deletePayComponent(
    @Param("tenantId") tenantId: string,
    @Param("componentId") componentId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.deletePayComponent(tenantId, componentId, actorUserId);
  }

  @Get("benefit-packages")
  listBenefitPackages(@Param("tenantId") tenantId: string) {
    return this.payrollService.listBenefitPackages(tenantId);
  }

  @Get("benefit-packages/summary")
  getBenefitsSummary(@Param("tenantId") tenantId: string) {
    return this.payrollService.getBenefitsSummary(tenantId);
  }

  @Post("benefit-packages")
  createBenefitPackage(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateBenefitPackageDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.createBenefitPackage(tenantId, actorUserId, dto);
  }

  @Patch("benefit-packages/:packageId")
  updateBenefitPackage(
    @Param("tenantId") tenantId: string,
    @Param("packageId") packageId: string,
    @Body() dto: UpdateBenefitPackageDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.updateBenefitPackage(tenantId, packageId, actorUserId, dto);
  }

  @Post("benefit-packages/:packageId/archive")
  archiveBenefitPackage(
    @Param("tenantId") tenantId: string,
    @Param("packageId") packageId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.archiveBenefitPackage(tenantId, packageId, actorUserId);
  }

  @Post("benefit-packages/:packageId/enrollments")
  enrollStaffBenefit(
    @Param("tenantId") tenantId: string,
    @Param("packageId") packageId: string,
    @Body() dto: EnrollStaffBenefitDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.enrollStaffBenefit(tenantId, packageId, actorUserId, dto);
  }

  @Delete("benefit-packages/:packageId/enrollments/:staffId")
  unenrollStaffBenefit(
    @Param("tenantId") tenantId: string,
    @Param("packageId") packageId: string,
    @Param("staffId") staffId: string
  ) {
    return this.payrollService.unenrollStaffBenefit(tenantId, packageId, staffId);
  }

  @Get("incentive-programs")
  listIncentivePrograms(@Param("tenantId") tenantId: string) {
    return this.payrollService.listIncentivePrograms(tenantId);
  }

  @Post("incentive-programs")
  createIncentiveProgram(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateIncentiveProgramDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.createIncentiveProgram(tenantId, actorUserId, dto);
  }

  @Patch("incentive-programs/:programId")
  updateIncentiveProgram(
    @Param("tenantId") tenantId: string,
    @Param("programId") programId: string,
    @Body() dto: UpdateIncentiveProgramDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.updateIncentiveProgram(tenantId, programId, actorUserId, dto);
  }

  @Post("incentive-programs/:programId/archive")
  archiveIncentiveProgram(
    @Param("tenantId") tenantId: string,
    @Param("programId") programId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.archiveIncentiveProgram(tenantId, programId, actorUserId);
  }

  @Post("incentive-programs/:programId/eligibility")
  setIncentiveEligibility(
    @Param("tenantId") tenantId: string,
    @Param("programId") programId: string,
    @Body() dto: SetIncentiveEligibilityDto
  ) {
    return this.payrollService.setIncentiveEligibility(tenantId, programId, dto);
  }

  @Delete("incentive-programs/:programId/eligibility/:staffId")
  removeIncentiveEligibility(
    @Param("tenantId") tenantId: string,
    @Param("programId") programId: string,
    @Param("staffId") staffId: string
  ) {
    return this.payrollService.removeIncentiveEligibility(tenantId, programId, staffId);
  }

  @Get("staff/:staffId/compensation")
  getStaffCompensation(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string
  ) {
    return this.payrollService.getStaffCompensation(tenantId, staffId);
  }

  @Put("staff/:staffId/compensation")
  upsertStaffCompensation(
    @Param("tenantId") tenantId: string,
    @Param("staffId") staffId: string,
    @Body() dto: UpsertStaffCompensationDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.upsertStaffCompensation(tenantId, staffId, actorUserId, dto);
  }

  @Get("payroll-runs")
  listPayrollRuns(@Param("tenantId") tenantId: string, @Query() query: ListPayrollRunsQueryDto) {
    return this.payrollService.listPayrollRuns(tenantId, query.month);
  }

  @Post("payroll-runs")
  createPayrollRun(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreatePayrollRunDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.createPayrollRun(tenantId, actorUserId, dto);
  }

  @Post("payroll-runs/:runId/generate")
  generatePayrollRun(
    @Param("tenantId") tenantId: string,
    @Param("runId") runId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.generatePayrollRun(tenantId, runId, actorUserId);
  }

  @Get("payroll-runs/:runId/summary")
  getRunSummary(@Param("tenantId") tenantId: string, @Param("runId") runId: string) {
    return this.payrollService.getRunSummary(tenantId, runId);
  }

  @Get("payroll-runs/:runId/records")
  listRunRecords(
    @Param("tenantId") tenantId: string,
    @Param("runId") runId: string,
    @Query() query: ListPayrollRecordsQueryDto
  ) {
    return this.payrollService.listRunRecords(tenantId, runId, query);
  }

  @Get("payroll-runs/records/:recordId")
  getPayrollRecord(@Param("tenantId") tenantId: string, @Param("recordId") recordId: string) {
    return this.payrollService.getPayrollRecord(tenantId, recordId);
  }

  @Patch("payroll-runs/records/:recordId")
  patchPayrollRecord(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Body() dto: PatchPayrollRecordDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.patchPayrollRecord(tenantId, recordId, actorUserId, dto);
  }

  @Post("payroll-runs/records/:recordId/approve")
  approvePayrollRecord(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Body() dto: ApprovePayrollRecordDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.approvePayrollRecord(tenantId, recordId, actorUserId, dto);
  }

  @Post("payroll-runs/records/:recordId/mark-paid")
  markPayrollPaid(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Body() dto: MarkPayrollPaidDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.payrollService.markPayrollPaid(tenantId, recordId, actorUserId, dto);
  }

  @Post("payroll-runs/records/:recordId/generate-payslip")
  generatePayslip(@Param("tenantId") tenantId: string, @Param("recordId") recordId: string) {
    return this.payrollService.enqueuePayslip(tenantId, recordId);
  }

  @Get("payroll-runs/records/:recordId/payslip")
  async downloadPayslip(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const file = await this.payrollService.downloadPayslip(tenantId, recordId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payslip-${recordId}.pdf"`);
    return file;
  }
}
