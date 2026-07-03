import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  academicYears,
  classroomStudents,
  classrooms,
  enrollments,
  gradeChiefAssignments,
  gradeSubjects,
  grades,
  reportCards,
  sections,
  staff,
  subjects,
  terms
} from "../db/schema.js";
/** Postgres foreign-key violation — a delete blocked by a referencing row. */
function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

import type {
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
  UpdateTermDto
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
      throw new ConflictException("Academic year is archived. Reactivate it before editing.");
    }

    return academicYear;
  }

  private dedupeSubjectsByCode<T extends { id: string; code: string | null }>(rows: T[]): T[] {
    const seen = new Set<string>();
    const unique: T[] = [];

    for (const row of rows) {
      const key = row.code?.trim().toLowerCase() || row.id;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(row);
    }

    return unique;
  }

  private async syncGradeSubjects(
    tenantId: string,
    academicYearId: string,
    gradeId: string,
    subjectIds: string[],
    actorUserId?: string
  ) {
    await this.assertAcademicYearMutable(tenantId, academicYearId);

    const existing = await this.db
      .select()
      .from(gradeSubjects)
      .where(
        and(
          eq(gradeSubjects.tenantId, tenantId),
          eq(gradeSubjects.academicYearId, academicYearId),
          eq(gradeSubjects.gradeId, gradeId)
        )
      );

    const existingIds = new Set(existing.map((row) => row.subjectId));
    const nextIds = new Set(subjectIds);

    for (const row of existing) {
      if (!nextIds.has(row.subjectId)) {
        await this.db.delete(gradeSubjects).where(eq(gradeSubjects.id, row.id));
      }
    }

    for (const subjectId of subjectIds) {
      if (!existingIds.has(subjectId)) {
        await this.getSubjectOrThrow(tenantId, subjectId);
        await this.db.insert(gradeSubjects).values({
          tenantId,
          academicYearId,
          gradeId,
          subjectId,
          createdBy: actorUserId,
          updatedBy: actorUserId
        });
      }
    }
  }

  private async syncGradeChief(
    tenantId: string,
    academicYearId: string,
    gradeId: string,
    staffId: string | null,
    actorUserId?: string
  ) {
    await this.assertAcademicYearMutable(tenantId, academicYearId);
    await this.getGradeOrThrow(tenantId, gradeId);

    await this.db
      .delete(gradeChiefAssignments)
      .where(
        and(
          eq(gradeChiefAssignments.tenantId, tenantId),
          eq(gradeChiefAssignments.academicYearId, academicYearId),
          eq(gradeChiefAssignments.gradeId, gradeId)
        )
      );

    if (!staffId) {
      return;
    }

    const [teacher] = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .limit(1);

    if (!teacher) {
      throw new NotFoundException("Teacher not found.");
    }

    await this.db.insert(gradeChiefAssignments).values({
      tenantId,
      academicYearId,
      gradeId,
      staffId,
      createdBy: actorUserId,
      updatedBy: actorUserId
    });

    // A grade chief must be able to teach that grade. Auto-grant grade
    // eligibility so the assignment is reflected on the teacher profile and the
    // "chief ⟹ eligible" invariant holds. (Additive only — never revokes here.)
    await this.grantGradeEligibility(tenantId, staffId, gradeId, actorUserId);
  }

  /** Ensure the teacher's profile lists this grade as eligible (idempotent). */
  private async grantGradeEligibility(
    tenantId: string,
    staffId: string,
    gradeId: string,
    actorUserId?: string
  ) {
    const [row] = await this.db
      .select({ profile: staff.teacherProfile })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .limit(1);
    if (!row) {
      return;
    }
    const profile = row.profile ?? {};
    const current = profile.eligibleGradeIds ?? [];
    if (current.includes(gradeId)) {
      return;
    }
    await this.db
      .update(staff)
      .set({
        teacherProfile: { ...profile, eligibleGradeIds: [...current, gradeId] },
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));
  }

  private async syncSubjectGrades(
    tenantId: string,
    academicYearId: string,
    subjectId: string,
    gradeIds: string[],
    actorUserId?: string
  ) {
    await this.assertAcademicYearMutable(tenantId, academicYearId);

    const existing = await this.db
      .select()
      .from(gradeSubjects)
      .where(
        and(
          eq(gradeSubjects.tenantId, tenantId),
          eq(gradeSubjects.academicYearId, academicYearId),
          eq(gradeSubjects.subjectId, subjectId)
        )
      );

    const existingIds = new Set(existing.map((row) => row.gradeId));
    const nextIds = new Set(gradeIds);

    for (const row of existing) {
      if (!nextIds.has(row.gradeId)) {
        await this.db.delete(gradeSubjects).where(eq(gradeSubjects.id, row.id));
      }
    }

    for (const gradeId of gradeIds) {
      if (!existingIds.has(gradeId)) {
        await this.getGradeOrThrow(tenantId, gradeId);
        await this.db.insert(gradeSubjects).values({
          tenantId,
          academicYearId,
          gradeId,
          subjectId,
          createdBy: actorUserId,
          updatedBy: actorUserId
        });
      }
    }
  }

  private async getCurrentAcademicYearRecord(tenantId: string) {
    const [academicYear] = await this.db
      .select()
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, "active")))
      .orderBy(desc(academicYears.startsOn))
      .limit(1);

    return academicYear ?? null;
  }

  async getCurrentAcademicYear(tenantId: string) {
    return this.getCurrentAcademicYearRecord(tenantId);
  }

  async assertCurrentAcademicYear(tenantId: string, academicYearId: string) {
    const current = await this.getCurrentAcademicYearRecord(tenantId);
    if (!current) {
      throw new ConflictException("No active academic year is configured.");
    }
    if (current.id !== academicYearId) {
      throw new ConflictException("This action must use the current academic year.");
    }
    return current;
  }

  listAcademicYears(tenantId: string) {
    return this.getCurrentAcademicYearRecord(tenantId).then((year) => (year ? [year] : []));
  }

  async createAcademicYear(tenantId: string, dto: CreateAcademicYearDto, actorUserId?: string) {
    const current = await this.getCurrentAcademicYearRecord(tenantId);
    const initialStatus = current ? ("draft" as const) : ("active" as const);

    const [academicYear] = await this.db
      .insert(academicYears)
      .values({
        tenantId,
        name: dto.name,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
        status: initialStatus,
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

  async setAcademicYearActive(
    tenantId: string,
    academicYearId: string,
    active: boolean,
    actorUserId?: string
  ) {
    const previous = await this.getAcademicYearOrThrow(tenantId, academicYearId);

    if (active && previous.status === "active") {
      return previous;
    }
    if (!active && previous.status !== "active") {
      return previous;
    }

    if (active) {
      const [academicYear] = await this.db.transaction(async (tx) => {
        await tx
          .update(academicYears)
          .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
          .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, "active")));

        const [updated] = await tx
          .update(academicYears)
          .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
          .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)))
          .returning();

        return updated ? [updated] : [];
      });

      if (!academicYear) {
        throw new NotFoundException("Academic year not found");
      }

      await this.auditService.recordEvent({
        tenantId,
        actorUserId: actorUserId ?? null,
        action: "academic_year.activate",
        recordType: "AcademicYear",
        recordId: academicYearId,
        before: { status: previous.status },
        after: { status: "active" }
      });

      return academicYear;
    }

    const [academicYear] = await this.db
      .update(academicYears)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "academic_year.deactivate",
      recordType: "AcademicYear",
      recordId: academicYearId,
      before: { status: previous.status },
      after: { status: "archived" }
    });

    return academicYear;
  }

  async closeAcademicYear(tenantId: string, academicYearId: string, actorUserId?: string) {
    return this.setAcademicYearActive(tenantId, academicYearId, false, actorUserId);
  }

  async restoreAcademicYear(tenantId: string, academicYearId: string, actorUserId?: string) {
    return this.setAcademicYearActive(tenantId, academicYearId, true, actorUserId);
  }

  /** @deprecated Use {@link restoreAcademicYear}. Kept for the legacy /reactivate route. */
  async reactivateAcademicYear(tenantId: string, academicYearId: string, actorUserId?: string) {
    return this.restoreAcademicYear(tenantId, academicYearId, actorUserId);
  }

  async deleteAcademicYear(tenantId: string, academicYearId: string, actorUserId?: string) {
    const year = await this.getAcademicYearOrThrow(tenantId, academicYearId);

    // Two-step safety: only an archived (closed) year can be permanently deleted.
    if (year.status !== "archived") {
      throw new BadRequestException("Close the academic year before deleting it.");
    }

    const n = sql<number>`count(*)::int`;
    const [termsN, classroomsN, enrollmentsN] = await Promise.all([
      this.db.select({ n }).from(terms).where(and(eq(terms.tenantId, tenantId), eq(terms.academicYearId, academicYearId))),
      this.db.select({ n }).from(classrooms).where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.academicYearId, academicYearId))),
      this.db.select({ n }).from(enrollments).where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.academicYearId, academicYearId)))
    ]);
    const dependencies = {
      terms: termsN[0]?.n ?? 0,
      classrooms: classroomsN[0]?.n ?? 0,
      enrollments: enrollmentsN[0]?.n ?? 0
    };
    if (Object.values(dependencies).some((c) => c > 0)) {
      throw new ConflictException({
        message:
          "This academic year has terms, classrooms, or enrolments and cannot be deleted. Keep it closed instead.",
        dependencies
      });
    }

    try {
      await this.db
        .delete(academicYears)
        .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)));
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new ConflictException({
          message:
            "This academic year is still referenced by other records and cannot be deleted. Keep it closed instead."
        });
      }
      throw err;
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "academic_year.delete",
      recordType: "AcademicYear",
      recordId: academicYearId,
      before: { name: year.name, status: year.status },
      after: { deleted: true }
    });

    return { id: academicYearId, deleted: true };
  }

  listTerms(tenantId: string) {
    return this.db.select().from(terms).where(eq(terms.tenantId, tenantId));
  }

  async createTerm(tenantId: string, dto: CreateTermDto, actorUserId?: string) {
    await this.assertCurrentAcademicYear(tenantId, dto.academicYearId);

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

  private async getTermOrThrow(tenantId: string, termId: string) {
    const [term] = await this.db
      .select()
      .from(terms)
      .where(and(eq(terms.tenantId, tenantId), eq(terms.id, termId)));

    if (!term) {
      throw new NotFoundException("Term not found.");
    }

    return term;
  }

  async updateTerm(tenantId: string, termId: string, dto: UpdateTermDto, actorUserId?: string) {
    const previous = await this.getTermOrThrow(tenantId, termId);
    await this.assertAcademicYearMutable(tenantId, previous.academicYearId);

    const [term] = await this.db
      .update(terms)
      .set({
        name: dto.name ?? previous.name,
        startsOn: dto.startsOn ?? previous.startsOn,
        endsOn: dto.endsOn ?? previous.endsOn,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(terms.tenantId, tenantId), eq(terms.id, termId)))
      .returning();

    return term;
  }

  async deleteTerm(tenantId: string, termId: string) {
    await this.getTermOrThrow(tenantId, termId);

    const [used] = await this.db
      .select({ id: reportCards.id })
      .from(reportCards)
      .where(and(eq(reportCards.tenantId, tenantId), eq(reportCards.termId, termId)))
      .limit(1);

    if (used) {
      throw new ConflictException("Term is used by report cards and cannot be deleted.");
    }

    await this.db
      .delete(terms)
      .where(and(eq(terms.tenantId, tenantId), eq(terms.id, termId)));

    return { deleted: true };
  }

  listGrades(tenantId: string) {
    return this.db.select().from(grades).where(eq(grades.tenantId, tenantId));
  }

  private assertValidAgeRange(minAge: number | null, maxAge: number | null) {
    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      throw new BadRequestException("Grade minimum age cannot be greater than maximum age.");
    }
  }

  async createGrade(tenantId: string, dto: CreateGradeDto, actorUserId?: string) {
    this.assertValidAgeRange(dto.minAge ?? null, dto.maxAge ?? null);

    const [grade] = await this.db
      .insert(grades)
      .values({
        tenantId,
        name: dto.name,
        minAge: dto.minAge ?? null,
        maxAge: dto.maxAge ?? null,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    if (!grade) {
      throw new Error("Failed to create grade.");
    }

    if (dto.academicYearId && dto.subjectIds !== undefined) {
      await this.syncGradeSubjects(
        tenantId,
        dto.academicYearId,
        grade.id,
        dto.subjectIds,
        actorUserId
      );
    }

    if (dto.academicYearId && dto.gradeChiefStaffId !== undefined) {
      await this.syncGradeChief(
        tenantId,
        dto.academicYearId,
        grade.id,
        dto.gradeChiefStaffId,
        actorUserId
      );
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "grade.create",
      recordType: "Grade",
      recordId: grade.id,
      after: { name: grade.name, minAge: grade.minAge, maxAge: grade.maxAge }
    });

    return grade;
  }

  private async getGradeOrThrow(tenantId: string, gradeId: string) {
    const [grade] = await this.db
      .select()
      .from(grades)
      .where(and(eq(grades.tenantId, tenantId), eq(grades.id, gradeId)));

    if (!grade) {
      throw new NotFoundException("Grade not found.");
    }

    return grade;
  }

  async updateGrade(
    tenantId: string,
    gradeId: string,
    dto: UpdateGradeDto,
    actorUserId?: string
  ) {
    const previous = await this.getGradeOrThrow(tenantId, gradeId);

    const nextMinAge = dto.minAge === undefined ? previous.minAge : dto.minAge;
    const nextMaxAge = dto.maxAge === undefined ? previous.maxAge : dto.maxAge;
    this.assertValidAgeRange(nextMinAge, nextMaxAge);

    const [grade] = await this.db
      .update(grades)
      .set({
        name: dto.name ?? previous.name,
        minAge: nextMinAge,
        maxAge: nextMaxAge,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(grades.tenantId, tenantId), eq(grades.id, gradeId)))
      .returning();

    if (!grade) {
      throw new NotFoundException("Grade not found.");
    }

    if (dto.academicYearId && dto.subjectIds !== undefined) {
      await this.syncGradeSubjects(
        tenantId,
        dto.academicYearId,
        gradeId,
        dto.subjectIds,
        actorUserId
      );
    }

    if (dto.academicYearId && dto.gradeChiefStaffId !== undefined) {
      await this.syncGradeChief(
        tenantId,
        dto.academicYearId,
        gradeId,
        dto.gradeChiefStaffId,
        actorUserId
      );
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "grade.update",
      recordType: "Grade",
      recordId: gradeId,
      before: { name: previous.name, minAge: previous.minAge, maxAge: previous.maxAge },
      after: { name: grade.name, minAge: grade.minAge, maxAge: grade.maxAge }
    });

    return grade;
  }

  async archiveGrade(tenantId: string, gradeId: string, actorUserId?: string) {
    const previous = await this.getGradeOrThrow(tenantId, gradeId);

    if (previous.status === "archived") {
      return previous;
    }

    const [grade] = await this.db
      .update(grades)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(grades.tenantId, tenantId), eq(grades.id, gradeId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "grade.archive",
      recordType: "Grade",
      recordId: gradeId,
      before: { status: previous.status },
      after: { status: "archived" }
    });

    return grade;
  }

  async restoreGrade(tenantId: string, gradeId: string, actorUserId?: string) {
    const previous = await this.getGradeOrThrow(tenantId, gradeId);

    if (previous.status === "active") {
      return previous;
    }

    const [grade] = await this.db
      .update(grades)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(grades.tenantId, tenantId), eq(grades.id, gradeId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "grade.restore",
      recordType: "Grade",
      recordId: gradeId,
      before: { status: previous.status },
      after: { status: "active" }
    });

    return grade;
  }

  /** @deprecated Use {@link restoreGrade}. Kept for the legacy /reactivate route. */
  async reactivateGrade(tenantId: string, gradeId: string, actorUserId?: string) {
    return this.restoreGrade(tenantId, gradeId, actorUserId);
  }

  async deleteGrade(tenantId: string, gradeId: string, actorUserId?: string) {
    const grade = await this.getGradeOrThrow(tenantId, gradeId);

    // Two-step safety: only an archived grade can be permanently deleted.
    if (grade.status !== "archived") {
      throw new BadRequestException("Archive the grade before deleting permanently.");
    }

    const n = sql<number>`count(*)::int`;
    const [classroomsN, subjectsN, enrollmentsN] = await Promise.all([
      this.db.select({ n }).from(classrooms).where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.gradeId, gradeId))),
      this.db.select({ n }).from(gradeSubjects).where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.gradeId, gradeId))),
      this.db.select({ n }).from(enrollments).where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.gradeId, gradeId)))
    ]);
    const dependencies = {
      classrooms: classroomsN[0]?.n ?? 0,
      subjects: subjectsN[0]?.n ?? 0,
      enrollments: enrollmentsN[0]?.n ?? 0
    };
    if (Object.values(dependencies).some((c) => c > 0)) {
      throw new ConflictException({
        message:
          "This grade has classrooms, subject assignments, or enrolments and cannot be deleted. Keep it archived instead.",
        dependencies
      });
    }

    try {
      await this.db.delete(grades).where(and(eq(grades.tenantId, tenantId), eq(grades.id, gradeId)));
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new ConflictException({
          message:
            "This grade is still referenced by other records and cannot be deleted. Keep it archived instead."
        });
      }
      throw err;
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "grade.delete",
      recordType: "Grade",
      recordId: gradeId,
      before: { name: grade.name, status: grade.status },
      after: { deleted: true }
    });

    return { id: gradeId, deleted: true };
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

  private async getSectionOrThrow(tenantId: string, sectionId: string) {
    const [section] = await this.db
      .select()
      .from(sections)
      .where(and(eq(sections.tenantId, tenantId), eq(sections.id, sectionId)));

    if (!section) {
      throw new NotFoundException("Section not found.");
    }

    return section;
  }

  async updateSection(
    tenantId: string,
    sectionId: string,
    dto: UpdateSectionDto,
    actorUserId?: string
  ) {
    const previous = await this.getSectionOrThrow(tenantId, sectionId);

    const [section] = await this.db
      .update(sections)
      .set({
        name: dto.name ?? previous.name,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(sections.tenantId, tenantId), eq(sections.id, sectionId)))
      .returning();

    return section;
  }

  async archiveSection(tenantId: string, sectionId: string, actorUserId?: string) {
    const previous = await this.getSectionOrThrow(tenantId, sectionId);

    if (previous.status === "archived") {
      return previous;
    }

    const [section] = await this.db
      .update(sections)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(sections.tenantId, tenantId), eq(sections.id, sectionId)))
      .returning();

    return section;
  }

  async restoreSection(tenantId: string, sectionId: string, actorUserId?: string) {
    const previous = await this.getSectionOrThrow(tenantId, sectionId);

    if (previous.status === "active") {
      return previous;
    }

    const [section] = await this.db
      .update(sections)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(sections.tenantId, tenantId), eq(sections.id, sectionId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "section.restore",
      recordType: "Section",
      recordId: sectionId,
      before: { status: previous.status },
      after: { status: "active" }
    });

    return section;
  }

  /** @deprecated Use {@link restoreSection}. Kept for the legacy /reactivate route. */
  async reactivateSection(tenantId: string, sectionId: string, actorUserId?: string) {
    return this.restoreSection(tenantId, sectionId, actorUserId);
  }

  async deleteSection(tenantId: string, sectionId: string, actorUserId?: string) {
    const section = await this.getSectionOrThrow(tenantId, sectionId);

    if (section.status !== "archived") {
      throw new BadRequestException("Archive the section before deleting permanently.");
    }

    const n = sql<number>`count(*)::int`;
    const [classroomsN] = await this.db
      .select({ n })
      .from(classrooms)
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.sectionId, sectionId)));
    const dependencies = { classrooms: classroomsN?.n ?? 0 };
    if (dependencies.classrooms > 0) {
      throw new ConflictException({
        message:
          "This section is used by classrooms and cannot be deleted. Keep it archived instead.",
        dependencies
      });
    }

    try {
      await this.db.delete(sections).where(and(eq(sections.tenantId, tenantId), eq(sections.id, sectionId)));
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new ConflictException({
          message:
            "This section is still referenced by other records and cannot be deleted. Keep it archived instead."
        });
      }
      throw err;
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "section.delete",
      recordType: "Section",
      recordId: sectionId,
      before: { name: section.name, status: section.status },
      after: { deleted: true }
    });

    return { id: sectionId, deleted: true };
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
        colorKey: dto.colorKey ?? null,
        iconKey: dto.iconKey ?? null,
        subjectType: dto.subjectType ?? "required",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    if (subject && dto.academicYearId && dto.gradeIds !== undefined) {
      await this.syncSubjectGrades(
        tenantId,
        dto.academicYearId,
        subject.id,
        dto.gradeIds,
        actorUserId
      );
    }

    return subject;
  }

  private async getSubjectOrThrow(tenantId: string, subjectId: string) {
    const [subject] = await this.db
      .select()
      .from(subjects)
      .where(and(eq(subjects.tenantId, tenantId), eq(subjects.id, subjectId)));

    if (!subject) {
      throw new NotFoundException("Subject not found.");
    }

    return subject;
  }

  async updateSubject(
    tenantId: string,
    subjectId: string,
    dto: UpdateSubjectDto,
    actorUserId?: string
  ) {
    const previous = await this.getSubjectOrThrow(tenantId, subjectId);

    const [subject] = await this.db
      .update(subjects)
      .set({
        name: dto.name ?? previous.name,
        code: dto.code === undefined ? previous.code : dto.code || null,
        colorKey: dto.colorKey === undefined ? previous.colorKey : dto.colorKey || null,
        iconKey: dto.iconKey === undefined ? previous.iconKey : dto.iconKey || null,
        subjectType: dto.subjectType ?? previous.subjectType,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(subjects.tenantId, tenantId), eq(subjects.id, subjectId)))
      .returning();

    if (subject && dto.academicYearId && dto.gradeIds !== undefined) {
      await this.syncSubjectGrades(
        tenantId,
        dto.academicYearId,
        subjectId,
        dto.gradeIds,
        actorUserId
      );
    }

    return subject;
  }

  async archiveSubject(tenantId: string, subjectId: string, actorUserId?: string) {
    const previous = await this.getSubjectOrThrow(tenantId, subjectId);

    if (previous.status === "archived") {
      return previous;
    }

    const [subject] = await this.db
      .update(subjects)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(subjects.tenantId, tenantId), eq(subjects.id, subjectId)))
      .returning();

    return subject;
  }

  async restoreSubject(tenantId: string, subjectId: string, actorUserId?: string) {
    const previous = await this.getSubjectOrThrow(tenantId, subjectId);

    if (previous.status === "active") {
      return previous;
    }

    const [subject] = await this.db
      .update(subjects)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(subjects.tenantId, tenantId), eq(subjects.id, subjectId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "subject.restore",
      recordType: "Subject",
      recordId: subjectId,
      before: { status: previous.status },
      after: { status: "active" }
    });

    return subject;
  }

  /** @deprecated Use {@link restoreSubject}. Kept for the legacy /reactivate route. */
  async reactivateSubject(tenantId: string, subjectId: string, actorUserId?: string) {
    return this.restoreSubject(tenantId, subjectId, actorUserId);
  }

  async deleteSubject(tenantId: string, subjectId: string, actorUserId?: string) {
    const subject = await this.getSubjectOrThrow(tenantId, subjectId);

    if (subject.status !== "archived") {
      throw new BadRequestException("Archive the subject before deleting permanently.");
    }

    const n = sql<number>`count(*)::int`;
    const [assignmentsN] = await this.db
      .select({ n })
      .from(gradeSubjects)
      .where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.subjectId, subjectId)));
    const dependencies = { gradeSubjects: assignmentsN?.n ?? 0 };
    if (dependencies.gradeSubjects > 0) {
      throw new ConflictException({
        message:
          "This subject is assigned to grades and cannot be deleted. Keep it archived instead.",
        dependencies
      });
    }

    try {
      await this.db.delete(subjects).where(and(eq(subjects.tenantId, tenantId), eq(subjects.id, subjectId)));
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new ConflictException({
          message:
            "This subject is still referenced by other records and cannot be deleted. Keep it archived instead."
        });
      }
      throw err;
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "subject.delete",
      recordType: "Subject",
      recordId: subjectId,
      before: { name: subject.name, status: subject.status },
      after: { deleted: true }
    });

    return { id: subjectId, deleted: true };
  }

  listGradeSubjects(tenantId: string) {
    return this.db.select().from(gradeSubjects).where(eq(gradeSubjects.tenantId, tenantId));
  }

  async exportMasterData(tenantId: string) {
    const [gradeRows, subjectRows] = await Promise.all([
      this.listGrades(tenantId),
      this.listSubjects(tenantId)
    ]);

    return {
      grades: gradeRows.map((row) => ({
        name: row.name,
        minAge: row.minAge,
        maxAge: row.maxAge
      })),
      subjects: subjectRows.map((row) => ({
        name: row.name,
        code: row.code,
        subjectType: row.subjectType
      }))
    };
  }

  async importMasterData(tenantId: string, dto: ImportMasterDataDto, actorUserId?: string) {
    const created = { grades: 0, subjects: 0 };

    for (const grade of dto.grades ?? []) {
      await this.createGrade(tenantId, grade, actorUserId);
      created.grades += 1;
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

    const [existing] = await this.db
      .select()
      .from(gradeSubjects)
      .where(
        and(
          eq(gradeSubjects.tenantId, tenantId),
          eq(gradeSubjects.academicYearId, dto.academicYearId),
          eq(gradeSubjects.gradeId, dto.gradeId),
          eq(gradeSubjects.subjectId, dto.subjectId)
        )
      );

    if (existing) {
      return existing;
    }

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

  private async getGradeSubjectOrThrow(tenantId: string, assignmentId: string) {
    const [assignment] = await this.db
      .select()
      .from(gradeSubjects)
      .where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.id, assignmentId)));

    if (!assignment) {
      throw new NotFoundException("Grade subject mapping not found.");
    }

    return assignment;
  }

  async updateGradeSubject(
    tenantId: string,
    assignmentId: string,
    dto: UpdateGradeSubjectDto,
    actorUserId?: string
  ) {
    const previous = await this.getGradeSubjectOrThrow(tenantId, assignmentId);
    await this.assertAcademicYearMutable(tenantId, previous.academicYearId);

    const [assignment] = await this.db
      .update(gradeSubjects)
      .set({
        weight: dto.weight ?? previous.weight,
        isRequired: dto.isRequired ?? previous.isRequired,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.id, assignmentId)))
      .returning();

    return assignment;
  }

  async deleteGradeSubject(tenantId: string, assignmentId: string) {
    const previous = await this.getGradeSubjectOrThrow(tenantId, assignmentId);
    await this.assertAcademicYearMutable(tenantId, previous.academicYearId);

    await this.db
      .delete(gradeSubjects)
      .where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.id, assignmentId)));

    return { deleted: true };
  }

  async listAcademicYearsOverview(tenantId: string) {
    const years = await this.db
      .select()
      .from(academicYears)
      .where(eq(academicYears.tenantId, tenantId))
      .orderBy(academicYears.startsOn);

    if (!years.length) {
      return [];
    }

    const [classroomCountRows, studentCountRows, gradeCountRows] = await Promise.all([
      this.db
        .select({
          academicYearId: classrooms.academicYearId,
          count: sql<number>`count(*)::int`
        })
        .from(classrooms)
        .where(eq(classrooms.tenantId, tenantId))
        .groupBy(classrooms.academicYearId),
      this.db
        .select({
          academicYearId: classrooms.academicYearId,
          count: sql<number>`count(distinct ${classroomStudents.studentId})::int`
        })
        .from(classroomStudents)
        .innerJoin(classrooms, eq(classroomStudents.classroomId, classrooms.id))
        .where(
          and(
            eq(classroomStudents.tenantId, tenantId),
            isNull(classroomStudents.effectiveTo)
          )
        )
        .groupBy(classrooms.academicYearId),
      this.db.execute<{ year_id: string; count: number }>(sql`
        SELECT year_id, COUNT(DISTINCT grade_id)::int AS count
        FROM (
          SELECT c.academic_year_id AS year_id, c.grade_id AS grade_id
          FROM ${classrooms} c
          INNER JOIN ${grades} g ON g.id = c.grade_id
          WHERE c.tenant_id = ${tenantId}
            AND g.tenant_id = ${tenantId}
            AND g.status = 'active'
          UNION
          SELECT gs.academic_year_id AS year_id, gs.grade_id AS grade_id
          FROM ${gradeSubjects} gs
          INNER JOIN ${grades} g ON g.id = gs.grade_id
          WHERE gs.tenant_id = ${tenantId}
            AND g.tenant_id = ${tenantId}
            AND g.status = 'active'
        ) active_grades
        GROUP BY year_id
      `)
    ]);

    const classroomCounts = new Map(
      classroomCountRows.map((row) => [row.academicYearId, row.count])
    );
    const studentCounts = new Map(
      studentCountRows.map((row) => [row.academicYearId, row.count])
    );
    const gradeCounts = new Map(
      gradeCountRows.rows.map((row) => [row.year_id, row.count])
    );

    return years.map((year) => ({
      ...year,
      gradeCount: gradeCounts.get(year.id) ?? 0,
      classroomCount: classroomCounts.get(year.id) ?? 0,
      studentCount: studentCounts.get(year.id) ?? 0
    }));
  }

  async listGradesOverview(tenantId: string, academicYearId: string) {
    await this.getAcademicYearOrThrow(tenantId, academicYearId);

    const gradeRows = await this.db
      .select()
      .from(grades)
      .where(eq(grades.tenantId, tenantId))
      .orderBy(grades.sortOrder, grades.name);

    if (!gradeRows.length) {
      return [];
    }

    const gradeIds = gradeRows.map((grade) => grade.id);

    const [subjectRows, classroomCountRows, studentCountRows, gradeChiefRows] =
      await Promise.all([
        this.db
          .select({
            gradeId: gradeSubjects.gradeId,
            id: subjects.id,
            name: subjects.name,
            code: subjects.code,
            colorKey: subjects.colorKey
          })
          .from(gradeSubjects)
          .innerJoin(subjects, eq(gradeSubjects.subjectId, subjects.id))
          .where(
            and(
              eq(gradeSubjects.tenantId, tenantId),
              eq(gradeSubjects.academicYearId, academicYearId),
              inArray(gradeSubjects.gradeId, gradeIds)
            )
          )
          .orderBy(subjects.name),
        this.db
          .select({
            gradeId: classrooms.gradeId,
            count: sql<number>`count(*)::int`
          })
          .from(classrooms)
          .where(
            and(
              eq(classrooms.tenantId, tenantId),
              eq(classrooms.academicYearId, academicYearId),
              inArray(classrooms.gradeId, gradeIds)
            )
          )
          .groupBy(classrooms.gradeId),
        this.db
          .select({
            gradeId: classrooms.gradeId,
            count: sql<number>`count(distinct ${classroomStudents.studentId})::int`
          })
          .from(classroomStudents)
          .innerJoin(classrooms, eq(classroomStudents.classroomId, classrooms.id))
          .where(
            and(
              eq(classroomStudents.tenantId, tenantId),
              eq(classrooms.academicYearId, academicYearId),
              inArray(classrooms.gradeId, gradeIds),
              isNull(classroomStudents.effectiveTo)
            )
          )
          .groupBy(classrooms.gradeId),
        this.db
          .select({
            gradeId: gradeChiefAssignments.gradeId,
            name: staff.fullName,
            staffId: staff.id
          })
          .from(gradeChiefAssignments)
          .innerJoin(staff, eq(gradeChiefAssignments.staffId, staff.id))
          .where(
            and(
              eq(gradeChiefAssignments.tenantId, tenantId),
              eq(gradeChiefAssignments.academicYearId, academicYearId),
              inArray(gradeChiefAssignments.gradeId, gradeIds)
            )
          )
      ]);

    const subjectsByGrade = new Map<string, typeof subjectRows>();
    for (const row of subjectRows) {
      const bucket = subjectsByGrade.get(row.gradeId) ?? [];
      bucket.push(row);
      subjectsByGrade.set(row.gradeId, bucket);
    }

    const classroomCounts = new Map(
      classroomCountRows.map((row) => [row.gradeId, row.count])
    );
    const studentCounts = new Map(studentCountRows.map((row) => [row.gradeId, row.count]));
    const gradeChiefs = new Map(
      gradeChiefRows.map((row) => [row.gradeId, { name: row.name, staffId: row.staffId }])
    );

    return gradeRows.map((grade) => {
      const uniqueSubjects = this.dedupeSubjectsByCode(subjectsByGrade.get(grade.id) ?? []);
      const chief = gradeChiefs.get(grade.id);
      return {
        ...grade,
        subjectCount: uniqueSubjects.length,
        subjects: uniqueSubjects,
        classroomCount: classroomCounts.get(grade.id) ?? 0,
        studentCount: studentCounts.get(grade.id) ?? 0,
        gradeChiefName: chief?.name ?? null,
        gradeChiefStaffId: chief?.staffId ?? null
      };
    });
  }

  async listSubjectsOverview(tenantId: string, academicYearId: string) {
    await this.getAcademicYearOrThrow(tenantId, academicYearId);

    const subjectRows = await this.db
      .select()
      .from(subjects)
      .where(eq(subjects.tenantId, tenantId))
      .orderBy(subjects.name);

    if (!subjectRows.length) {
      return [];
    }

    const subjectIds = subjectRows.map((subject) => subject.id);
    const gradeRows = await this.db
      .select({
        subjectId: gradeSubjects.subjectId,
        id: grades.id,
        name: grades.name
      })
      .from(gradeSubjects)
      .innerJoin(grades, eq(gradeSubjects.gradeId, grades.id))
      .where(
        and(
          eq(gradeSubjects.tenantId, tenantId),
          eq(gradeSubjects.academicYearId, academicYearId),
          inArray(gradeSubjects.subjectId, subjectIds)
        )
      )
      .orderBy(grades.name);

    const gradesBySubject = new Map<string, Array<{ id: string; name: string }>>();
    for (const row of gradeRows) {
      const bucket = gradesBySubject.get(row.subjectId) ?? [];
      bucket.push({ id: row.id, name: row.name });
      gradesBySubject.set(row.subjectId, bucket);
    }

    return subjectRows.map((subject) => {
      const gradesForSubject = gradesBySubject.get(subject.id) ?? [];
      return {
        ...subject,
        gradeCount: gradesForSubject.length,
        grades: gradesForSubject
      };
    });
  }
}
