import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { academicYears, gradeSubjects, grades, sections, subjects, terms } from "../db/schema.js";
import type {
  AssignGradeSubjectDto,
  CreateAcademicYearDto,
  CreateGradeDto,
  CreateSectionDto,
  CreateSubjectDto,
  CreateTermDto,
  ImportMasterDataDto,
  UpdateAcademicYearDto
} from "./dto.js";

@Injectable()
export class AcademicsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  private async getAcademicYearOrThrow(tenantId: string, academicYearId: string) {
    const [academicYear] = await this.db
      .select()
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)));

    if (!academicYear) {
      throw new NotFoundException("Academic year not found.");
    }

    return academicYear;
  }

  private async assertAcademicYearMutable(tenantId: string, academicYearId: string) {
    const academicYear = await this.getAcademicYearOrThrow(tenantId, academicYearId);

    if (academicYear.status === "archived") {
      throw new ConflictException("Academic year is closed and cannot be changed.");
    }

    return academicYear;
  }

  listAcademicYears(tenantId: string) {
    return this.db.select().from(academicYears).where(eq(academicYears.tenantId, tenantId));
  }

  async createAcademicYear(tenantId: string, dto: CreateAcademicYearDto, actorUserId?: string) {
    const [academicYear] = await this.db
      .insert(academicYears)
      .values({
        tenantId,
        name: dto.name,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return academicYear;
  }

  async updateAcademicYear(
    tenantId: string,
    academicYearId: string,
    dto: UpdateAcademicYearDto,
    actorUserId?: string
  ) {
    await this.assertAcademicYearMutable(tenantId, academicYearId);

    const [academicYear] = await this.db
      .update(academicYears)
      .set({
        name: dto.name,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)))
      .returning();

    return academicYear;
  }

  async closeAcademicYear(tenantId: string, academicYearId: string, actorUserId?: string) {
    const previous = await this.getAcademicYearOrThrow(tenantId, academicYearId);

    if (previous.status === "archived") {
      return previous;
    }

    const [academicYear] = await this.db
      .update(academicYears)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "academic_year.close",
      recordType: "AcademicYear",
      recordId: academicYearId,
      before: { status: previous.status },
      after: { status: "archived" }
    });

    return academicYear;
  }

  listTerms(tenantId: string) {
    return this.db.select().from(terms).where(eq(terms.tenantId, tenantId));
  }

  async createTerm(tenantId: string, dto: CreateTermDto, actorUserId?: string) {
    await this.assertAcademicYearMutable(tenantId, dto.academicYearId);

    const [term] = await this.db
      .insert(terms)
      .values({
        tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return term;
  }

  listGrades(tenantId: string) {
    return this.db.select().from(grades).where(eq(grades.tenantId, tenantId));
  }

  async createGrade(tenantId: string, dto: CreateGradeDto, actorUserId?: string) {
    const [grade] = await this.db
      .insert(grades)
      .values({
        tenantId,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return grade;
  }

  listSections(tenantId: string) {
    return this.db.select().from(sections).where(eq(sections.tenantId, tenantId));
  }

  async createSection(tenantId: string, dto: CreateSectionDto, actorUserId?: string) {
    const [section] = await this.db
      .insert(sections)
      .values({
        tenantId,
        name: dto.name,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return section;
  }

  listSubjects(tenantId: string) {
    return this.db.select().from(subjects).where(eq(subjects.tenantId, tenantId));
  }

  async createSubject(tenantId: string, dto: CreateSubjectDto, actorUserId?: string) {
    const [subject] = await this.db
      .insert(subjects)
      .values({
        tenantId,
        name: dto.name,
        code: dto.code,
        subjectType: dto.subjectType ?? "required",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return subject;
  }

  listGradeSubjects(tenantId: string) {
    return this.db.select().from(gradeSubjects).where(eq(gradeSubjects.tenantId, tenantId));
  }

  async exportMasterData(tenantId: string) {
    const [gradeRows, sectionRows, subjectRows] = await Promise.all([
      this.listGrades(tenantId),
      this.listSections(tenantId),
      this.listSubjects(tenantId)
    ]);

    return {
      grades: gradeRows.map((row) => ({ name: row.name, sortOrder: row.sortOrder })),
      sections: sectionRows.map((row) => ({ name: row.name })),
      subjects: subjectRows.map((row) => ({
        name: row.name,
        code: row.code,
        subjectType: row.subjectType
      }))
    };
  }

  async importMasterData(tenantId: string, dto: ImportMasterDataDto, actorUserId?: string) {
    const created = { grades: 0, sections: 0, subjects: 0 };

    for (const grade of dto.grades ?? []) {
      await this.createGrade(tenantId, grade, actorUserId);
      created.grades += 1;
    }

    for (const section of dto.sections ?? []) {
      await this.createSection(tenantId, section, actorUserId);
      created.sections += 1;
    }

    for (const subject of dto.subjects ?? []) {
      await this.createSubject(tenantId, subject, actorUserId);
      created.subjects += 1;
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "academic.master_data.import",
      recordType: "AcademicMasterData",
      recordId: tenantId,
      after: created
    });

    return created;
  }

  async assignGradeSubject(tenantId: string, dto: AssignGradeSubjectDto, actorUserId?: string) {
    await this.assertAcademicYearMutable(tenantId, dto.academicYearId);

    const [assignment] = await this.db
      .insert(gradeSubjects)
      .values({
        tenantId,
        academicYearId: dto.academicYearId,
        gradeId: dto.gradeId,
        subjectId: dto.subjectId,
        weight: dto.weight ?? "1",
        isRequired: dto.isRequired ?? true,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return assignment;
  }
}
