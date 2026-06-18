import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, eq, notInArray } from "drizzle-orm";
import type { TeacherProfileCapabilityInput, UpdateTeacherAssignmentsInput, UpdateTeacherTeachingSetupInput } from "@sms/shared";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  academicYears,
  classroomSubjectTeachers,
  classrooms,
  gradeChiefAssignments,
  gradeSubjects,
  grades,
  sections,
  staff,
  subjects,
  teachingSectorGrades,
  teachingSectors
} from "../db/schema.js";

@Injectable()
export class TeacherAssignmentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  async getAssignmentOptions(tenantId: string) {
    const [currentYear] = await this.db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, "active")))
      .limit(1);

    const classroomFilters = [
      eq(classrooms.tenantId, tenantId),
      eq(classrooms.status, "active")
    ];
    if (currentYear) {
      classroomFilters.push(eq(classrooms.academicYearId, currentYear.id));
    }

    const gradeSubjectFilters = [eq(gradeSubjects.tenantId, tenantId)];
    if (currentYear) {
      gradeSubjectFilters.push(eq(gradeSubjects.academicYearId, currentYear.id));
    }

    const gradeChiefFilters = [eq(gradeChiefAssignments.tenantId, tenantId)];
    if (currentYear) {
      gradeChiefFilters.push(eq(gradeChiefAssignments.academicYearId, currentYear.id));
    }

    const [years, gradeRows, classroomRows, gradeSubjectRows, gradeChiefRows, subjectRows, sectorRows, sectorGradeRows] =
      await Promise.all([
      this.db
        .select({ id: academicYears.id, name: academicYears.name, status: academicYears.status })
        .from(academicYears)
        .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, "active")))
        .orderBy(academicYears.name),
      this.db
        .select({ id: grades.id, name: grades.name, sortOrder: grades.sortOrder })
        .from(grades)
        .where(eq(grades.tenantId, tenantId))
        .orderBy(grades.sortOrder),
      this.db
        .select({
          id: classrooms.id,
          name: classrooms.name,
          academicYearId: classrooms.academicYearId,
          gradeId: classrooms.gradeId,
          sectionId: classrooms.sectionId,
          room: classrooms.room,
          classTeacherStaffId: classrooms.classTeacherStaffId
        })
        .from(classrooms)
        .where(and(...classroomFilters))
        .orderBy(classrooms.name),
      this.db
        .select({
          academicYearId: gradeSubjects.academicYearId,
          gradeId: gradeSubjects.gradeId,
          subjectId: gradeSubjects.subjectId,
          subjectName: subjects.name,
          subjectCode: subjects.code
        })
        .from(gradeSubjects)
        .innerJoin(subjects, eq(gradeSubjects.subjectId, subjects.id))
        .where(and(...gradeSubjectFilters))
        .orderBy(subjects.name),
      this.db
        .select({
          academicYearId: gradeChiefAssignments.academicYearId,
          gradeId: gradeChiefAssignments.gradeId,
          staffId: gradeChiefAssignments.staffId,
          staffName: staff.fullName
        })
        .from(gradeChiefAssignments)
        .innerJoin(staff, eq(gradeChiefAssignments.staffId, staff.id))
        .where(and(...gradeChiefFilters)),
      this.db
        .select({ id: subjects.id, name: subjects.name, code: subjects.code })
        .from(subjects)
        .where(and(eq(subjects.tenantId, tenantId), eq(subjects.status, "active")))
        .orderBy(subjects.name),
      this.db
        .select({ id: teachingSectors.id, name: teachingSectors.name, sortOrder: teachingSectors.sortOrder })
        .from(teachingSectors)
        .where(and(eq(teachingSectors.tenantId, tenantId), eq(teachingSectors.status, "active")))
        .orderBy(teachingSectors.sortOrder),
      this.db
        .select({ sectorId: teachingSectorGrades.sectorId, gradeId: teachingSectorGrades.gradeId })
        .from(teachingSectorGrades)
        .where(eq(teachingSectorGrades.tenantId, tenantId))
    ]);

    const sectors = sectorRows.map((sector) => ({
      id: sector.id,
      name: sector.name,
      sortOrder: sector.sortOrder,
      gradeIds: sectorGradeRows
        .filter((row) => row.sectorId === sector.id)
        .map((row) => row.gradeId)
    }));

    return {
      academicYears: years,
      grades: gradeRows,
      classrooms: classroomRows,
      gradeSubjects: gradeSubjectRows,
      gradeChiefs: gradeChiefRows,
      subjects: subjectRows,
      sectors
    };
  }

  async getTeachingSetup(tenantId: string, staffId: string) {
    const [member] = await this.db
      .select({ teacherProfile: staff.teacherProfile })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));

    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }

    const profile = member.teacherProfile ?? {};
    const capability: TeacherProfileCapabilityInput = {
      sectorIds: profile.sectorIds ?? [],
      competentSubjectIds: profile.competentSubjectIds ?? [],
      eligibleGradeIds: profile.eligibleGradeIds ?? []
    };

    const assignments = await this.getTeacherAssignments(tenantId, staffId);

    if (
      capability.eligibleGradeIds.length === 0 &&
      (assignments.gradeChief.length > 0 ||
        assignments.homeroom.length > 0 ||
        assignments.subjectTeaching.length > 0)
    ) {
      capability.eligibleGradeIds = this.inferEligibleGradeIds(assignments);
    }

    if (capability.competentSubjectIds.length === 0 && assignments.subjectTeaching.length > 0) {
      capability.competentSubjectIds = [
        ...new Set(assignments.subjectTeaching.map((row) => row.subjectId))
      ];
    }

    return { capability, assignments };
  }

  async updateTeachingSetup(
    tenantId: string,
    staffId: string,
    dto: UpdateTeacherTeachingSetupInput,
    actorUserId: string | undefined
  ) {
    await this.assertStaff(tenantId, staffId);

    await this.db
      .update(staff)
      .set({
        teacherProfile: dto.capability,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));

    await this.updateTeacherAssignments(tenantId, staffId, dto.assignments, actorUserId);

    return this.getTeachingSetup(tenantId, staffId);
  }

  private inferEligibleGradeIds(assignments: Awaited<ReturnType<TeacherAssignmentsService["getTeacherAssignments"]>>) {
    const gradeIds = new Set<string>();
    for (const row of assignments.gradeChief) {
      gradeIds.add(row.gradeId);
    }
    for (const row of assignments.homeroom) {
      gradeIds.add(row.gradeId);
    }
    for (const row of assignments.subjectTeaching) {
      if (row.gradeId) {
        gradeIds.add(row.gradeId);
      }
    }
    return [...gradeIds];
  }

  async getTeacherAssignments(tenantId: string, staffId: string) {
    await this.assertStaff(tenantId, staffId);

    const [gradeChiefRows, homeroomRows, subjectRows] = await Promise.all([
      this.db
        .select({
          id: gradeChiefAssignments.id,
          academicYearId: gradeChiefAssignments.academicYearId,
          academicYearName: academicYears.name,
          gradeId: gradeChiefAssignments.gradeId,
          gradeName: grades.name
        })
        .from(gradeChiefAssignments)
        .innerJoin(academicYears, eq(gradeChiefAssignments.academicYearId, academicYears.id))
        .innerJoin(grades, eq(gradeChiefAssignments.gradeId, grades.id))
        .where(
          and(
            eq(gradeChiefAssignments.tenantId, tenantId),
            eq(gradeChiefAssignments.staffId, staffId)
          )
        ),
      this.db
        .select({
          classroomId: classrooms.id,
          classroomName: classrooms.name,
          gradeId: classrooms.gradeId,
          gradeName: grades.name,
          sectionId: classrooms.sectionId,
          sectionName: sections.name,
          room: classrooms.room
        })
        .from(classrooms)
        .innerJoin(grades, eq(classrooms.gradeId, grades.id))
        .leftJoin(sections, eq(classrooms.sectionId, sections.id))
        .where(
          and(
            eq(classrooms.tenantId, tenantId),
            eq(classrooms.classTeacherStaffId, staffId)
          )
        ),
      this.db
        .select({
          id: classroomSubjectTeachers.id,
          classroomId: classroomSubjectTeachers.classroomId,
          classroomName: classrooms.name,
          gradeId: classrooms.gradeId,
          gradeName: grades.name,
          subjectId: classroomSubjectTeachers.subjectId,
          subjectName: subjects.name,
          subjectCode: subjects.code
        })
        .from(classroomSubjectTeachers)
        .innerJoin(classrooms, eq(classroomSubjectTeachers.classroomId, classrooms.id))
        .innerJoin(grades, eq(classrooms.gradeId, grades.id))
        .innerJoin(subjects, eq(classroomSubjectTeachers.subjectId, subjects.id))
        .where(
          and(
            eq(classroomSubjectTeachers.tenantId, tenantId),
            eq(classroomSubjectTeachers.teacherStaffId, staffId)
          )
        )
    ]);

    return {
      gradeChief: gradeChiefRows,
      homeroom: homeroomRows,
      subjectTeaching: subjectRows
    };
  }

  async updateTeacherAssignments(
    tenantId: string,
    staffId: string,
    dto: UpdateTeacherAssignmentsInput,
    actorUserId: string | undefined
  ) {
    await this.assertStaff(tenantId, staffId);
    this.assertUniqueItems(dto);

    await this.db.transaction(async (tx) => {
      await tx
        .delete(gradeChiefAssignments)
        .where(
          and(
            eq(gradeChiefAssignments.tenantId, tenantId),
            eq(gradeChiefAssignments.staffId, staffId)
          )
        );

      for (const item of dto.gradeChief) {
        await tx
          .delete(gradeChiefAssignments)
          .where(
            and(
              eq(gradeChiefAssignments.tenantId, tenantId),
              eq(gradeChiefAssignments.academicYearId, item.academicYearId),
              eq(gradeChiefAssignments.gradeId, item.gradeId)
            )
          );

        await tx.insert(gradeChiefAssignments).values({
          tenantId,
          academicYearId: item.academicYearId,
          gradeId: item.gradeId,
          staffId,
          createdBy: actorUserId,
          updatedBy: actorUserId
        });
      }

      const homeroomIds = dto.homeroom.map((item) => item.classroomId);
      const homeroomFilter =
        homeroomIds.length > 0
          ? notInArray(classrooms.id, homeroomIds)
          : undefined;

      await tx
        .update(classrooms)
        .set({ classTeacherStaffId: null, updatedBy: actorUserId, updatedAt: new Date() })
        .where(
          and(
            eq(classrooms.tenantId, tenantId),
            eq(classrooms.classTeacherStaffId, staffId),
            homeroomFilter
          )
        );

      for (const item of dto.homeroom) {
        await tx
          .update(classrooms)
          .set({
            classTeacherStaffId: staffId,
            updatedBy: actorUserId,
            updatedAt: new Date()
          })
          .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, item.classroomId)));
      }

      await tx
        .delete(classroomSubjectTeachers)
        .where(
          and(
            eq(classroomSubjectTeachers.tenantId, tenantId),
            eq(classroomSubjectTeachers.teacherStaffId, staffId)
          )
        );

      for (const item of dto.subjectTeaching) {
        await this.assertSubjectInGradeCurriculum(tx, tenantId, item.classroomId, item.subjectId);

        await tx
          .delete(classroomSubjectTeachers)
          .where(
            and(
              eq(classroomSubjectTeachers.tenantId, tenantId),
              eq(classroomSubjectTeachers.classroomId, item.classroomId),
              eq(classroomSubjectTeachers.subjectId, item.subjectId)
            )
          );

        await tx.insert(classroomSubjectTeachers).values({
          tenantId,
          classroomId: item.classroomId,
          subjectId: item.subjectId,
          teacherStaffId: staffId,
          createdBy: actorUserId,
          updatedBy: actorUserId
        });
      }
    });

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.teacher_assignments.update",
      recordType: "Staff",
      recordId: staffId,
      after: dto as Record<string, unknown>
    });

    return this.getTeacherAssignments(tenantId, staffId);
  }

  private async assertSubjectInGradeCurriculum(
    tx: Pick<Database, "select">,
    tenantId: string,
    classroomId: string,
    subjectId: string
  ) {
    const [classroom] = await tx
      .select({
        academicYearId: classrooms.academicYearId,
        gradeId: classrooms.gradeId
      })
      .from(classrooms)
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)));

    if (!classroom) {
      throw new BadRequestException("Classroom not found.");
    }

    const [mapping] = await tx
      .select({ id: gradeSubjects.id })
      .from(gradeSubjects)
      .where(
        and(
          eq(gradeSubjects.tenantId, tenantId),
          eq(gradeSubjects.academicYearId, classroom.academicYearId),
          eq(gradeSubjects.gradeId, classroom.gradeId),
          eq(gradeSubjects.subjectId, subjectId)
        )
      );

    if (!mapping) {
      throw new BadRequestException(
        "Subject is not part of this classroom's grade curriculum for the academic year."
      );
    }
  }

  private async assertStaff(tenantId: string, staffId: string) {
    const [member] = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));

    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }
  }

  private assertUniqueItems(dto: UpdateTeacherAssignmentsInput) {
    const gradeChiefKeys = new Set<string>();
    for (const item of dto.gradeChief) {
      const key = `${item.academicYearId}:${item.gradeId}`;
      if (gradeChiefKeys.has(key)) {
        throw new BadRequestException("Duplicate grade chief assignment.");
      }
      gradeChiefKeys.add(key);
    }

    const homeroomIds = new Set<string>();
    for (const item of dto.homeroom) {
      if (homeroomIds.has(item.classroomId)) {
        throw new BadRequestException("Duplicate homeroom assignment.");
      }
      homeroomIds.add(item.classroomId);
    }

    const subjectKeys = new Set<string>();
    for (const item of dto.subjectTeaching) {
      const key = `${item.classroomId}:${item.subjectId}`;
      if (subjectKeys.has(key)) {
        throw new BadRequestException("Duplicate subject assignment.");
      }
      subjectKeys.add(key);
    }
  }
}
