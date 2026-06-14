import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { AcademicsService } from "./academics.service.js";
import {
  AssignGradeSubjectDto,
  CreateAcademicYearDto,
  CreateGradeDto,
  CreateSectionDto,
  CreateSubjectDto,
  CreateTermDto,
  ImportMasterDataDto,
  UpdateAcademicYearDto
} from "./dto.js";

@Controller("tenants/:tenantId/academics")
@UseGuards(PermissionsGuard)
@RequirePermissions("academic_setup.manage")
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Get("academic-years")
  listAcademicYears(@Param("tenantId") tenantId: string) {
    return this.academicsService.listAcademicYears(tenantId);
  }

  @Post("academic-years")
  createAcademicYear(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateAcademicYearDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.createAcademicYear(tenantId, dto, actorUserId);
  }

  @Patch("academic-years/:academicYearId")
  updateAcademicYear(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string,
    @Body() dto: UpdateAcademicYearDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.updateAcademicYear(tenantId, academicYearId, dto, actorUserId);
  }

  @Post("academic-years/:academicYearId/close")
  closeAcademicYear(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.closeAcademicYear(tenantId, academicYearId, actorUserId);
  }

  @Get("terms")
  listTerms(@Param("tenantId") tenantId: string) {
    return this.academicsService.listTerms(tenantId);
  }

  @Post("terms")
  createTerm(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateTermDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.createTerm(tenantId, dto, actorUserId);
  }

  @Get("grades")
  listGrades(@Param("tenantId") tenantId: string) {
    return this.academicsService.listGrades(tenantId);
  }

  @Post("grades")
  createGrade(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateGradeDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.createGrade(tenantId, dto, actorUserId);
  }

  @Get("sections")
  listSections(@Param("tenantId") tenantId: string) {
    return this.academicsService.listSections(tenantId);
  }

  @Post("sections")
  createSection(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateSectionDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.createSection(tenantId, dto, actorUserId);
  }

  @Get("subjects")
  listSubjects(@Param("tenantId") tenantId: string) {
    return this.academicsService.listSubjects(tenantId);
  }

  @Post("subjects")
  createSubject(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateSubjectDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.createSubject(tenantId, dto, actorUserId);
  }

  @Get("grade-subjects")
  listGradeSubjects(@Param("tenantId") tenantId: string) {
    return this.academicsService.listGradeSubjects(tenantId);
  }

  @Post("grade-subjects")
  assignGradeSubject(
    @Param("tenantId") tenantId: string,
    @Body() dto: AssignGradeSubjectDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.assignGradeSubject(tenantId, dto, actorUserId);
  }

  @Get("master-data/export")
  exportMasterData(@Param("tenantId") tenantId: string) {
    return this.academicsService.exportMasterData(tenantId);
  }

  @Post("master-data/import")
  importMasterData(
    @Param("tenantId") tenantId: string,
    @Body() dto: ImportMasterDataDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.importMasterData(tenantId, dto, actorUserId);
  }
}
