import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequirePermissions } from "../identity/permissions.decorator.js";
import { PermissionsGuard } from "../identity/permissions.guard.js";
import { ClassroomsService } from "../classrooms/classrooms.service.js";
import { AcademicsService } from "./academics.service.js";
import {
  AssignGradeSubjectDto,
  CreateAcademicYearDto,
  CreateGradeDto,
  CreateSectionDto,
  CreateSubjectDto,
  CreateTermDto,
  ImportMasterDataDto,
  UpdateAcademicYearDto,
  UpdateGradeDto,
  UpdateGradeSubjectDto,
  UpdateSectionDto,
  UpdateSubjectDto,
  UpdateTermDto,
  SetAcademicYearActiveDto
} from "./dto.js";

@Controller("tenants/:tenantId/academics")
@UseGuards(PermissionsGuard)
@RequirePermissions("academic_setup.manage")
export class AcademicsController {
  constructor(
    private readonly academicsService: AcademicsService,
    private readonly classroomsService: ClassroomsService
  ) {}

  @Get("setup/academic-years")
  listAcademicYearsOverview(@Param("tenantId") tenantId: string) {
    return this.academicsService.listAcademicYearsOverview(tenantId);
  }

  @Get("setup/academic-years/:academicYearId/grades")
  listGradesOverview(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string
  ) {
    return this.academicsService.listGradesOverview(tenantId, academicYearId);
  }

  @Get("setup/academic-years/:academicYearId/subjects")
  listSubjectsOverview(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string
  ) {
    return this.academicsService.listSubjectsOverview(tenantId, academicYearId);
  }

  @Get("setup/academic-years/:academicYearId/classrooms")
  listClassroomsForYear(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string
  ) {
    return this.classroomsService.listClassroomsForYear(tenantId, academicYearId);
  }

  @Get("setup/academic-years/:academicYearId/grades/:gradeId/classrooms")
  listClassroomsForGrade(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string,
    @Param("gradeId") gradeId: string
  ) {
    return this.classroomsService.listClassroomsForGrade(tenantId, academicYearId, gradeId);
  }

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

  @Patch("academic-years/:academicYearId/active")
  setAcademicYearActive(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string,
    @Body() dto: SetAcademicYearActiveDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.setAcademicYearActive(
      tenantId,
      academicYearId,
      dto.active,
      actorUserId
    );
  }

  @Post("academic-years/:academicYearId/close")
  closeAcademicYear(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.closeAcademicYear(tenantId, academicYearId, actorUserId);
  }

  @Post("academic-years/:academicYearId/restore")
  restoreAcademicYear(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.restoreAcademicYear(tenantId, academicYearId, actorUserId);
  }

  /** @deprecated Use POST academic-years/:academicYearId/restore. */
  @Post("academic-years/:academicYearId/reactivate")
  reactivateAcademicYear(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.restoreAcademicYear(tenantId, academicYearId, actorUserId);
  }

  @Delete("academic-years/:academicYearId")
  deleteAcademicYear(
    @Param("tenantId") tenantId: string,
    @Param("academicYearId") academicYearId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.deleteAcademicYear(tenantId, academicYearId, actorUserId);
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

  @Patch("terms/:termId")
  updateTerm(
    @Param("tenantId") tenantId: string,
    @Param("termId") termId: string,
    @Body() dto: UpdateTermDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.updateTerm(tenantId, termId, dto, actorUserId);
  }

  @Delete("terms/:termId")
  deleteTerm(@Param("tenantId") tenantId: string, @Param("termId") termId: string) {
    return this.academicsService.deleteTerm(tenantId, termId);
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

  @Patch("grades/:gradeId")
  updateGrade(
    @Param("tenantId") tenantId: string,
    @Param("gradeId") gradeId: string,
    @Body() dto: UpdateGradeDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.updateGrade(tenantId, gradeId, dto, actorUserId);
  }

  @Post("grades/:gradeId/archive")
  archiveGrade(
    @Param("tenantId") tenantId: string,
    @Param("gradeId") gradeId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.archiveGrade(tenantId, gradeId, actorUserId);
  }

  @Post("grades/:gradeId/restore")
  restoreGrade(
    @Param("tenantId") tenantId: string,
    @Param("gradeId") gradeId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.restoreGrade(tenantId, gradeId, actorUserId);
  }

  /** @deprecated Use POST grades/:gradeId/restore. */
  @Post("grades/:gradeId/reactivate")
  reactivateGrade(
    @Param("tenantId") tenantId: string,
    @Param("gradeId") gradeId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.restoreGrade(tenantId, gradeId, actorUserId);
  }

  @Delete("grades/:gradeId")
  deleteGrade(
    @Param("tenantId") tenantId: string,
    @Param("gradeId") gradeId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.deleteGrade(tenantId, gradeId, actorUserId);
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

  @Patch("sections/:sectionId")
  updateSection(
    @Param("tenantId") tenantId: string,
    @Param("sectionId") sectionId: string,
    @Body() dto: UpdateSectionDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.updateSection(tenantId, sectionId, dto, actorUserId);
  }

  @Post("sections/:sectionId/archive")
  archiveSection(
    @Param("tenantId") tenantId: string,
    @Param("sectionId") sectionId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.archiveSection(tenantId, sectionId, actorUserId);
  }

  @Post("sections/:sectionId/restore")
  restoreSection(
    @Param("tenantId") tenantId: string,
    @Param("sectionId") sectionId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.restoreSection(tenantId, sectionId, actorUserId);
  }

  /** @deprecated Use POST sections/:sectionId/restore. */
  @Post("sections/:sectionId/reactivate")
  reactivateSection(
    @Param("tenantId") tenantId: string,
    @Param("sectionId") sectionId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.restoreSection(tenantId, sectionId, actorUserId);
  }

  @Delete("sections/:sectionId")
  deleteSection(
    @Param("tenantId") tenantId: string,
    @Param("sectionId") sectionId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.deleteSection(tenantId, sectionId, actorUserId);
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

  @Patch("subjects/:subjectId")
  updateSubject(
    @Param("tenantId") tenantId: string,
    @Param("subjectId") subjectId: string,
    @Body() dto: UpdateSubjectDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.updateSubject(tenantId, subjectId, dto, actorUserId);
  }

  @Post("subjects/:subjectId/archive")
  archiveSubject(
    @Param("tenantId") tenantId: string,
    @Param("subjectId") subjectId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.archiveSubject(tenantId, subjectId, actorUserId);
  }

  @Post("subjects/:subjectId/restore")
  restoreSubject(
    @Param("tenantId") tenantId: string,
    @Param("subjectId") subjectId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.restoreSubject(tenantId, subjectId, actorUserId);
  }

  /** @deprecated Use POST subjects/:subjectId/restore. */
  @Post("subjects/:subjectId/reactivate")
  reactivateSubject(
    @Param("tenantId") tenantId: string,
    @Param("subjectId") subjectId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.restoreSubject(tenantId, subjectId, actorUserId);
  }

  @Delete("subjects/:subjectId")
  deleteSubject(
    @Param("tenantId") tenantId: string,
    @Param("subjectId") subjectId: string,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.deleteSubject(tenantId, subjectId, actorUserId);
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

  @Patch("grade-subjects/:assignmentId")
  updateGradeSubject(
    @Param("tenantId") tenantId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() dto: UpdateGradeSubjectDto,
    @Headers("x-user-id") actorUserId?: string
  ) {
    return this.academicsService.updateGradeSubject(tenantId, assignmentId, dto, actorUserId);
  }

  @Delete("grade-subjects/:assignmentId")
  deleteGradeSubject(
    @Param("tenantId") tenantId: string,
    @Param("assignmentId") assignmentId: string
  ) {
    return this.academicsService.deleteGradeSubject(tenantId, assignmentId);
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
