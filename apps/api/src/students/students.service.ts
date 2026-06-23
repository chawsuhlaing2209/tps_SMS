import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  attendanceRecords,
  auditLogs,
  classroomStudents,
  classrooms,
  familyGroups,
  gradeSubjects,
  grades,
  guardians,
  invoices,
  reportCards,
  sections,
  studentGuardians,
  students,
  subjects
} from "../db/schema.js";
import type {
  CreateGuardianDto,
  CreateStudentDto,
  CreateStudentFamilyGroupDto,
  CreateFamilyGroupDto,
  EnrollStudentDto,
  LinkGuardianDto,
  ListGuardiansQueryDto,
  ListStudentsQueryDto,
  SearchFamilyGroupsQueryDto,
  SetStudentFamilyGroupDto,
  TransferStudentDto,
  UpdateFamilyGroupDto,
  UpdateGuardianDto,
  UpdateStudentDto,
  WithdrawStudentDto
} from "./dto.js";

@Injectable()
export class StudentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  async list(tenantId: string, query: ListStudentsQueryDto) {
    const filters: ReturnType<typeof eq>[] = [eq(students.tenantId, tenantId)];

    if (query.status) {
      filters.push(eq(students.status, query.status));
    }

    if (query.search) {
      const term = `%${query.search}%`;
      filters.push(or(ilike(students.fullName, term), ilike(students.admissionNumber, term))!);
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const rows = await this.db
      .select({
        id: students.id,
        fullName: students.fullName,
        admissionNumber: students.admissionNumber,
        status: students.status,
        dateOfBirth: students.dateOfBirth,
        gender: students.gender,
        familyGroupId: students.familyGroupId,
        householdName: familyGroups.name,
        updatedAt: students.updatedAt
      })
      .from(students)
      .leftJoin(
        familyGroups,
        and(eq(students.familyGroupId, familyGroups.id), eq(familyGroups.tenantId, tenantId))
      )
      .where(and(...filters))
      .orderBy(desc(students.updatedAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(and(...filters));

    return { data: rows, total: countRow?.count ?? 0 };
  }

  async getPeopleDirectoryCounts(tenantId: string) {
    const [[studentRow], [guardianRow], [householdRow]] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(students)
        .where(eq(students.tenantId, tenantId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(guardians)
        .where(eq(guardians.tenantId, tenantId)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(familyGroups)
        .where(eq(familyGroups.tenantId, tenantId))
    ]);

    return {
      students: studentRow?.count ?? 0,
      guardians: guardianRow?.count ?? 0,
      households: householdRow?.count ?? 0
    };
  }

  async getById(tenantId: string, studentId: string) {
    const [student] = await this.db
      .select()
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    const guardianLinks = await this.db
      .select()
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .where(and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.tenantId, tenantId)));

    const classroomLinks = await this.db
      .select()
      .from(classroomStudents)
      .innerJoin(classrooms, eq(classroomStudents.classroomId, classrooms.id))
      .where(and(eq(classroomStudents.studentId, studentId), eq(classroomStudents.tenantId, tenantId)));

    return { ...student, guardians: guardianLinks, classrooms: classroomLinks };
  }

  async getProfile(tenantId: string, studentId: string) {
    const base = await this.getById(tenantId, studentId);

    const activeClassroomLink = base.classrooms.find(
      (row) => row.classroom_students.effectiveTo == null
    );
    const classroomId = activeClassroomLink?.classrooms.id ?? base.classrooms[0]?.classrooms.id;

    let classroomName: string | null = null;
    let gradeName: string | null = null;
    let streamLabel: string | null = null;
    let enrolledAt: string | null =
      activeClassroomLink?.classroom_students.effectiveFrom ??
      base.classrooms[0]?.classroom_students.effectiveFrom ??
      null;
    let subjectRows: { id: string; name: string; code: string | null }[] = [];

    if (classroomId) {
      const [classroomRow] = await this.db
        .select({
          classroomName: classrooms.name,
          gradeName: grades.name,
          gradeId: classrooms.gradeId,
          sectionName: sections.name,
          academicYearId: classrooms.academicYearId
        })
        .from(classrooms)
        .innerJoin(grades, eq(classrooms.gradeId, grades.id))
        .leftJoin(sections, eq(classrooms.sectionId, sections.id))
        .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)));

      if (classroomRow) {
        classroomName = classroomRow.classroomName;
        gradeName = classroomRow.gradeName;
        streamLabel = classroomRow.sectionName;
        subjectRows = await this.db
          .select({
            id: subjects.id,
            name: subjects.name,
            code: subjects.code
          })
          .from(gradeSubjects)
          .innerJoin(subjects, eq(gradeSubjects.subjectId, subjects.id))
          .where(
            and(
              eq(gradeSubjects.tenantId, tenantId),
              eq(gradeSubjects.academicYearId, classroomRow.academicYearId),
              eq(gradeSubjects.gradeId, classroomRow.gradeId),
              eq(subjects.status, "active")
            )
          )
          .orderBy(subjects.name);
      }
    }

    const [attendanceRow] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        present: sql<number>`count(*) filter (where ${attendanceRecords.status} in ('present', 'late'))::int`
      })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.studentId, studentId)));

    const attendancePercent =
      attendanceRow && attendanceRow.total > 0
        ? Math.round((attendanceRow.present / attendanceRow.total) * 100)
        : null;

    const [latestReportCard] = await this.db
      .select({ data: reportCards.data })
      .from(reportCards)
      .where(and(eq(reportCards.tenantId, tenantId), eq(reportCards.studentId, studentId)))
      .orderBy(desc(reportCards.createdAt))
      .limit(1);

    const reportData = latestReportCard?.data as { gpa?: number; overallGpa?: number } | undefined;
    const termGpa =
      typeof reportData?.gpa === "number"
        ? reportData.gpa
        : typeof reportData?.overallGpa === "number"
          ? reportData.overallGpa
          : null;

    const invoiceRows = await this.db
      .select({ status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId)));

    let feeStatus: "none" | "paid_in_full" | "partial" | "outstanding" = "none";
    if (invoiceRows.length > 0) {
      const unpaid = invoiceRows.some((row) =>
        ["unpaid", "overdue", "partial"].includes(row.status)
      );
      const allSettled = invoiceRows.every((row) =>
        ["paid", "waived", "refunded", "cancelled"].includes(row.status)
      );
      if (allSettled) {
        feeStatus = "paid_in_full";
      } else if (invoiceRows.some((row) => row.status === "partial")) {
        feeStatus = "partial";
      } else if (unpaid) {
        feeStatus = "outstanding";
      }
    }

    const primaryGuardianLink = base.guardians[0];
    const primaryGuardian = primaryGuardianLink
      ? {
          id: primaryGuardianLink.guardians.id,
          fullName: primaryGuardianLink.guardians.fullName,
          phone: primaryGuardianLink.guardians.phone,
          relationship: primaryGuardianLink.student_guardians.relationship
        }
      : null;

    return {
      ...base,
      profile: {
        classroomName,
        gradeName,
        streamLabel,
        enrolledAt,
        attendancePercent,
        termGpa,
        feeStatus,
        primaryGuardian,
        subjects: subjectRows
      }
    };
  }

  private async getStudentOrThrow(tenantId: string, studentId: string) {
    const [student] = await this.db
      .select()
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    return student;
  }

  async create(tenantId: string, actorUserId: string | undefined, dto: CreateStudentDto) {
    if (dto.guardian || dto.household) {
      return this.registerStudent(tenantId, actorUserId, dto);
    }

    const admissionNumber = dto.admissionNumber ?? `A-${Date.now()}`;
    const fullName = `${dto.firstName} ${dto.lastName}`;

    const [student] = await this.db
      .insert(students)
      .values({
        tenantId,
        fullName,
        dateOfBirth: dto.dateOfBirth,
        gender: dto.gender,
        admissionNumber,
        photoFileId: dto.photoFileId,
        address: dto.address,
        medicalNotes: dto.medicalNotes,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.create",
      recordType: "student",
      recordId: student!.id,
      after: student as Record<string, unknown>
    });

    return student!;
  }

  async registerStudent(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateStudentDto
  ) {
    const guardianInput = dto.guardian;
    const householdInput = dto.household;

    if (householdInput?.mode === "existing" && !householdInput.familyGroupId) {
      throw new BadRequestException("Select a household to join.");
    }

    if (householdInput?.mode === "new" && !householdInput.name?.trim()) {
      throw new BadRequestException("Enter a household name.");
    }

    if (
      householdInput &&
      ["new", "guardian_default"].includes(householdInput.mode) &&
      !guardianInput
    ) {
      throw new BadRequestException("Link a guardian before assigning a household.");
    }

    const admissionNumber = dto.admissionNumber ?? `A-${Date.now()}`;
    const fullName = `${dto.firstName} ${dto.lastName}`;

    return this.db.transaction(async (tx) => {
      const [student] = await tx
        .insert(students)
        .values({
          tenantId,
          fullName,
          dateOfBirth: dto.dateOfBirth,
          gender: dto.gender,
          admissionNumber,
          photoFileId: dto.photoFileId,
          address: dto.address,
          medicalNotes: dto.medicalNotes,
          createdBy: actorUserId,
          updatedBy: actorUserId
        })
        .returning();

      let guardianId: string | null = null;
      let guardianFullName: string | null = null;

      if (guardianInput) {
        if (guardianInput.guardianId) {
          const [existingGuardian] = await tx
            .select({ id: guardians.id, fullName: guardians.fullName })
            .from(guardians)
            .where(
              and(
                eq(guardians.tenantId, tenantId),
                eq(guardians.id, guardianInput.guardianId)
              )
            );

          if (!existingGuardian) {
            throw new NotFoundException("Guardian not found.");
          }

          guardianId = existingGuardian.id;
          guardianFullName = existingGuardian.fullName;
        } else {
          guardianFullName = `${guardianInput.firstName} ${guardianInput.lastName}`.trim();
          const [createdGuardian] = await tx
            .insert(guardians)
            .values({
              tenantId,
              fullName: guardianFullName,
              relationshipLabel: guardianInput.relationship,
              phone: guardianInput.phone,
              email: guardianInput.email,
              createdBy: actorUserId,
              updatedBy: actorUserId
            })
            .returning({ id: guardians.id, fullName: guardians.fullName });

          guardianId = createdGuardian!.id;
          guardianFullName = createdGuardian!.fullName;
        }

        await tx.insert(studentGuardians).values({
          tenantId,
          studentId: student!.id,
          guardianId,
          relationship: guardianInput.relationship,
          createdBy: actorUserId,
          updatedBy: actorUserId
        });
      }

      let familyGroupId: string | null = null;

      if (householdInput && householdInput.mode !== "none") {
        if (householdInput.mode === "existing" && householdInput.familyGroupId) {
          const [family] = await tx
            .select({ id: familyGroups.id })
            .from(familyGroups)
            .where(
              and(
                eq(familyGroups.tenantId, tenantId),
                eq(familyGroups.id, householdInput.familyGroupId)
              )
            );

          if (!family) {
            throw new NotFoundException("Family group not found.");
          }

          familyGroupId = family.id;
        } else if (householdInput.mode === "new" && guardianId) {
          const [family] = await tx
            .insert(familyGroups)
            .values({
              tenantId,
              name: householdInput.name!.trim(),
              primaryGuardianId: guardianId,
              createdBy: actorUserId,
              updatedBy: actorUserId
            })
            .returning({ id: familyGroups.id });

          familyGroupId = family!.id;
        } else if (householdInput.mode === "guardian_default" && guardianId) {
          familyGroupId = await this.assignGuardianDefaultHousehold(
            tx,
            tenantId,
            student!.id,
            guardianId,
            guardianFullName ?? "Family",
            actorUserId
          );
        }

        if (familyGroupId) {
          await tx
            .update(students)
            .set({
              familyGroupId,
              updatedBy: actorUserId,
              updatedAt: new Date()
            })
            .where(and(eq(students.tenantId, tenantId), eq(students.id, student!.id)));
        }
      }

      await this.auditService.recordEvent({
        tenantId,
        actorUserId: actorUserId ?? null,
        action: "student.register",
        recordType: "student",
        recordId: student!.id,
        after: {
          studentId: student!.id,
          guardianId,
          familyGroupId,
          admissionNumber
        }
      });

      return {
        ...student!,
        guardianId,
        familyGroupId
      };
    });
  }

  private async assignGuardianDefaultHousehold(
    tx: Pick<Database, "select" | "insert">,
    tenantId: string,
    _studentId: string,
    guardianId: string,
    guardianFullName: string,
    actorUserId: string | undefined
  ) {
    const [primaryFamily] = await tx
      .select({ id: familyGroups.id })
      .from(familyGroups)
      .where(
        and(
          eq(familyGroups.tenantId, tenantId),
          eq(familyGroups.primaryGuardianId, guardianId)
        )
      )
      .limit(1);

    if (primaryFamily) {
      return primaryFamily.id;
    }

    const [siblingStudent] = await tx
      .select({ familyGroupId: students.familyGroupId })
      .from(studentGuardians)
      .innerJoin(students, eq(studentGuardians.studentId, students.id))
      .where(
        and(
          eq(studentGuardians.tenantId, tenantId),
          eq(studentGuardians.guardianId, guardianId),
          isNotNull(students.familyGroupId)
        )
      )
      .limit(1);

    if (siblingStudent?.familyGroupId) {
      return siblingStudent.familyGroupId;
    }

    const [family] = await tx
      .insert(familyGroups)
      .values({
        tenantId,
        name: `${guardianFullName} family`,
        primaryGuardianId: guardianId,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning({ id: familyGroups.id });

    return family!.id;
  }

  async update(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: UpdateStudentDto
  ) {
    const before = await this.getStudentOrThrow(tenantId, studentId);

    const fullName =
      dto.firstName || dto.lastName
        ? `${dto.firstName ?? before.fullName.split(" ")[0]} ${dto.lastName ?? before.fullName.split(" ").slice(1).join(" ")}`
        : undefined;

    const [updated] = await this.db
      .update(students)
      .set({
        ...(fullName ? { fullName } : {}),
        ...(dto.dateOfBirth ? { dateOfBirth: dto.dateOfBirth } : {}),
        ...(dto.gender ? { gender: dto.gender } : {}),
        ...(dto.admissionNumber ? { admissionNumber: dto.admissionNumber } : {}),
        ...(dto.photoFileId !== undefined ? { photoFileId: dto.photoFileId } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.medicalNotes !== undefined ? { medicalNotes: dto.medicalNotes } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.update",
      recordType: "student",
      recordId: studentId,
      before: before as Record<string, unknown>,
      after: updated as Record<string, unknown>
    });

    return updated!;
  }

  async enroll(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: EnrollStudentDto
  ) {
    await this.getStudentOrThrow(tenantId, studentId);

    const effectiveFrom = dto.enrollmentDate ?? new Date().toISOString().slice(0, 10);

    await this.db.insert(classroomStudents).values({
      tenantId,
      classroomId: dto.classroomId,
      studentId,
      effectiveFrom,
      createdBy: actorUserId,
      updatedBy: actorUserId
    });

    const [updated] = await this.db
      .update(students)
      .set({ status: "enrolled", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.enroll",
      recordType: "student",
      recordId: studentId,
      after: { classroomId: dto.classroomId, academicYearId: dto.academicYearId }
    });

    return updated!;
  }

  async transfer(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: TransferStudentDto
  ) {
    await this.getStudentOrThrow(tenantId, studentId);

    const effectiveTo = dto.effectiveDate ?? new Date().toISOString().slice(0, 10);

    // Mark existing as inactive
    await this.db
      .update(classroomStudents)
      .set({ effectiveTo, updatedBy: actorUserId, updatedAt: new Date() })
      .where(
        and(
          eq(classroomStudents.studentId, studentId),
          eq(classroomStudents.tenantId, tenantId)
        )
      );

    // Insert new classroom_student
    await this.db.insert(classroomStudents).values({
      tenantId,
      classroomId: dto.toClassroomId,
      studentId,
      effectiveFrom: effectiveTo,
      movementReason: dto.reason,
      createdBy: actorUserId,
      updatedBy: actorUserId
    });

    const [updated] = await this.db
      .update(students)
      .set({ status: "transferred", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.transfer",
      recordType: "student",
      recordId: studentId,
      after: { toClassroomId: dto.toClassroomId, reason: dto.reason }
    });

    return updated!;
  }

  async withdraw(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: WithdrawStudentDto
  ) {
    await this.getStudentOrThrow(tenantId, studentId);

    const effectiveTo = dto.withdrawDate ?? new Date().toISOString().slice(0, 10);

    await this.db
      .update(classroomStudents)
      .set({ effectiveTo, updatedBy: actorUserId, updatedAt: new Date() })
      .where(
        and(
          eq(classroomStudents.studentId, studentId),
          eq(classroomStudents.tenantId, tenantId)
        )
      );

    const [updated] = await this.db
      .update(students)
      .set({ status: "withdrawn", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.withdraw",
      recordType: "student",
      recordId: studentId,
      after: { reason: dto.reason }
    });

    return updated!;
  }

  listGuardians(tenantId: string, query: ListGuardiansQueryDto = {}) {
    const filters = [eq(guardians.tenantId, tenantId)];

    if (query.search?.trim()) {
      const pattern = `%${query.search.trim()}%`;
      filters.push(or(ilike(guardians.fullName, pattern), ilike(guardians.phone, pattern))!);
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return this.db
      .select({
        id: guardians.id,
        fullName: guardians.fullName,
        phone: guardians.phone,
        email: guardians.email,
        relationshipLabel: guardians.relationshipLabel,
        preferredChannel: guardians.preferredChannel
      })
      .from(guardians)
      .where(and(...filters))
      .orderBy(guardians.fullName)
      .limit(limit)
      .offset(offset);
  }

  async getGuardian(tenantId: string, guardianId: string) {
    const [guardian] = await this.db
      .select()
      .from(guardians)
      .where(and(eq(guardians.tenantId, tenantId), eq(guardians.id, guardianId)));

    if (!guardian) {
      throw new NotFoundException("Guardian not found.");
    }

    const linkedStudents = await this.db
      .select({
        id: students.id,
        fullName: students.fullName,
        admissionNumber: students.admissionNumber,
        status: students.status,
        familyGroupId: students.familyGroupId,
        relationship: studentGuardians.relationship
      })
      .from(studentGuardians)
      .innerJoin(students, eq(studentGuardians.studentId, students.id))
      .where(
        and(eq(studentGuardians.tenantId, tenantId), eq(studentGuardians.guardianId, guardianId))
      )
      .orderBy(students.fullName);

    const [primaryFamily] = await this.db
      .select({ id: familyGroups.id, name: familyGroups.name })
      .from(familyGroups)
      .where(
        and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.primaryGuardianId, guardianId))
      )
      .limit(1);

    const memberFamilyId = linkedStudents.find((row) => row.familyGroupId)?.familyGroupId;
    let household: { id: string; name: string } | null = primaryFamily ?? null;

    if (!household && memberFamilyId) {
      const [family] = await this.db
        .select({ id: familyGroups.id, name: familyGroups.name })
        .from(familyGroups)
        .where(and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.id, memberFamilyId)));
      household = family ?? null;
    }

    return {
      id: guardian.id,
      fullName: guardian.fullName,
      phone: guardian.phone,
      email: guardian.email,
      relationshipLabel: guardian.relationshipLabel,
      preferredChannel: guardian.preferredChannel,
      household,
      students: linkedStudents.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        admissionNumber: row.admissionNumber,
        status: row.status,
        familyGroupId: row.familyGroupId,
        relationship: row.relationship
      }))
    };
  }

  async updateGuardian(
    tenantId: string,
    guardianId: string,
    actorUserId: string | undefined,
    dto: UpdateGuardianDto
  ) {
    const [before] = await this.db
      .select()
      .from(guardians)
      .where(and(eq(guardians.tenantId, tenantId), eq(guardians.id, guardianId)));

    if (!before) {
      throw new NotFoundException("Guardian not found.");
    }

    const fullName =
      dto.firstName || dto.lastName
        ? `${dto.firstName ?? before.fullName.split(" ")[0]} ${dto.lastName ?? before.fullName.split(" ").slice(1).join(" ")}`.trim()
        : undefined;

    const [updated] = await this.db
      .update(guardians)
      .set({
        ...(fullName ? { fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(guardians.tenantId, tenantId), eq(guardians.id, guardianId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "guardian.update",
      recordType: "guardian",
      recordId: guardianId,
      before: before as Record<string, unknown>,
      after: updated as Record<string, unknown>
    });

    return updated!;
  }

  async createGuardian(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateGuardianDto
  ) {
    const [guardian] = await this.db
      .insert(guardians)
      .values({
        tenantId,
        fullName: `${dto.firstName} ${dto.lastName}`,
        relationshipLabel: dto.relationship,
        phone: dto.phone,
        email: dto.email,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return guardian!;
  }

  async linkGuardian(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: LinkGuardianDto
  ) {
    await this.getStudentOrThrow(tenantId, studentId);

    const [link] = await this.db
      .insert(studentGuardians)
      .values({
        tenantId,
        studentId,
        guardianId: dto.guardianId,
        relationship: dto.relationship,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.link_guardian",
      recordType: "student",
      recordId: studentId,
      after: { guardianId: dto.guardianId, relationship: dto.relationship }
    });

    await this.ensureFamilyGroupForStudent(tenantId, studentId, actorUserId, {
      guardianId: dto.guardianId
    });

    return link!;
  }

  private async guardianNamesById(tenantId: string, guardianIds: string[]) {
    const names = new Map<string, string>();
    if (!guardianIds.length) {
      return names;
    }

    const rows = await this.db
      .select({ id: guardians.id, fullName: guardians.fullName })
      .from(guardians)
      .where(and(eq(guardians.tenantId, tenantId), inArray(guardians.id, guardianIds)));

    for (const row of rows) {
      names.set(row.id, row.fullName);
    }

    return names;
  }

  private async membersByFamilyGroupId(tenantId: string, familyGroupIds: string[]) {
    const members = new Map<
      string,
      Array<{ id: string; fullName: string; admissionNumber: string; status: string }>
    >();
    if (!familyGroupIds.length) {
      return members;
    }

    const rows = await this.db
      .select({
        familyGroupId: students.familyGroupId,
        id: students.id,
        fullName: students.fullName,
        admissionNumber: students.admissionNumber,
        status: students.status
      })
      .from(students)
      .where(
        and(
          eq(students.tenantId, tenantId),
          inArray(students.familyGroupId, familyGroupIds)
        )
      )
      .orderBy(students.fullName);

    for (const row of rows) {
      if (!row.familyGroupId) continue;
      const bucket = members.get(row.familyGroupId) ?? [];
      bucket.push({
        id: row.id,
        fullName: row.fullName,
        admissionNumber: row.admissionNumber,
        status: row.status
      });
      members.set(row.familyGroupId, bucket);
    }

    return members;
  }

  async searchFamilyGroups(tenantId: string, query: SearchFamilyGroupsQueryDto) {
    const search = query.search?.trim();
    if (!search) {
      return [];
    }

    const pattern = `%${search}%`;
    const limit = query.limit ?? 20;
    const familyIds = new Set<string>();

    const byName = await this.db
      .select({ id: familyGroups.id })
      .from(familyGroups)
      .where(and(eq(familyGroups.tenantId, tenantId), ilike(familyGroups.name, pattern)))
      .limit(limit);

    for (const row of byName) {
      familyIds.add(row.id);
    }

    const byStudent = await this.db
      .select({ familyGroupId: students.familyGroupId })
      .from(students)
      .where(
        and(
          eq(students.tenantId, tenantId),
          ilike(students.fullName, pattern),
          isNotNull(students.familyGroupId)
        )
      )
      .limit(limit);

    for (const row of byStudent) {
      if (row.familyGroupId) {
        familyIds.add(row.familyGroupId);
      }
    }

    const byGuardian = await this.db
      .select({ familyGroupId: students.familyGroupId })
      .from(guardians)
      .innerJoin(studentGuardians, eq(studentGuardians.guardianId, guardians.id))
      .innerJoin(students, eq(studentGuardians.studentId, students.id))
      .where(
        and(
          eq(guardians.tenantId, tenantId),
          or(ilike(guardians.fullName, pattern), ilike(guardians.phone, pattern)),
          isNotNull(students.familyGroupId)
        )
      )
      .limit(limit);

    for (const row of byGuardian) {
      if (row.familyGroupId) {
        familyIds.add(row.familyGroupId);
      }
    }

    const byPrimaryGuardian = await this.db
      .select({ id: familyGroups.id })
      .from(familyGroups)
      .innerJoin(guardians, eq(familyGroups.primaryGuardianId, guardians.id))
      .where(
        and(
          eq(familyGroups.tenantId, tenantId),
          or(ilike(guardians.fullName, pattern), ilike(guardians.phone, pattern))
        )
      )
      .limit(limit);

    for (const row of byPrimaryGuardian) {
      familyIds.add(row.id);
    }

    if (familyIds.size === 0) {
      return [];
    }

    const ids = [...familyIds].slice(0, limit);
    const rows = await this.db
      .select({
        id: familyGroups.id,
        name: familyGroups.name,
        primaryGuardianId: familyGroups.primaryGuardianId
      })
      .from(familyGroups)
      .where(and(eq(familyGroups.tenantId, tenantId), inArray(familyGroups.id, ids)));

    const groupIds = rows.map((group) => group.id);
    const guardianIds = rows
      .map((group) => group.primaryGuardianId)
      .filter((id): id is string => Boolean(id));
    const [guardianNames, membersByGroup] = await Promise.all([
      this.guardianNamesById(tenantId, guardianIds),
      this.membersByFamilyGroupId(tenantId, groupIds)
    ]);

    const summaries = rows.map((group) => {
      const members = membersByGroup.get(group.id) ?? [];
      return {
        id: group.id,
        name: group.name,
        primaryGuardianName: group.primaryGuardianId
          ? (guardianNames.get(group.primaryGuardianId) ?? null)
          : null,
        memberCount: members.length,
        members
      };
    });

    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  async listFamilyGroups(tenantId: string, query: SearchFamilyGroupsQueryDto) {
    if (query.search?.trim()) {
      const data = await this.searchFamilyGroups(tenantId, query);
      return { data, total: data.length };
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const rows = await this.db
      .select({
        id: familyGroups.id,
        name: familyGroups.name,
        primaryGuardianId: familyGroups.primaryGuardianId,
        memberCount: sql<number>`count(${students.id})::int`
      })
      .from(familyGroups)
      .leftJoin(
        students,
        and(eq(students.familyGroupId, familyGroups.id), eq(students.tenantId, tenantId))
      )
      .where(eq(familyGroups.tenantId, tenantId))
      .groupBy(familyGroups.id, familyGroups.name, familyGroups.primaryGuardianId)
      .orderBy(familyGroups.name)
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(familyGroups)
      .where(eq(familyGroups.tenantId, tenantId));

    const guardianIds = rows
      .map((group) => group.primaryGuardianId)
      .filter((id): id is string => Boolean(id));
    const guardianNames = await this.guardianNamesById(tenantId, guardianIds);

    const data = rows.map((group) => ({
      id: group.id,
      name: group.name,
      primaryGuardianName: group.primaryGuardianId
        ? (guardianNames.get(group.primaryGuardianId) ?? null)
        : null,
      memberCount: group.memberCount
    }));

    return { data, total: countRow?.total ?? 0 };
  }

  async createFamilyGroup(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateFamilyGroupDto
  ) {
    const [guardian] = await this.db
      .select({ id: guardians.id })
      .from(guardians)
      .where(and(eq(guardians.tenantId, tenantId), eq(guardians.id, dto.primaryGuardianId)));

    if (!guardian) {
      throw new NotFoundException("Guardian not found.");
    }

    const [family] = await this.db
      .insert(familyGroups)
      .values({
        tenantId,
        name: dto.name.trim(),
        primaryGuardianId: dto.primaryGuardianId,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning({ id: familyGroups.id });

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "family_group.create",
      recordType: "FamilyGroup",
      recordId: family!.id,
      after: { name: dto.name, primaryGuardianId: dto.primaryGuardianId }
    });

    return this.getFamilyGroupTree(tenantId, family!.id);
  }

  async updateFamilyGroup(
    tenantId: string,
    familyGroupId: string,
    actorUserId: string | undefined,
    dto: UpdateFamilyGroupDto
  ) {
    const [existing] = await this.db
      .select()
      .from(familyGroups)
      .where(and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.id, familyGroupId)));

    if (!existing) {
      throw new NotFoundException("Family group not found.");
    }

    if (dto.primaryGuardianId) {
      const [guardian] = await this.db
        .select({ id: guardians.id })
        .from(guardians)
        .where(
          and(eq(guardians.tenantId, tenantId), eq(guardians.id, dto.primaryGuardianId))
        );

      if (!guardian) {
        throw new NotFoundException("Guardian not found.");
      }
    }

    await this.db
      .update(familyGroups)
      .set({
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.primaryGuardianId !== undefined
          ? { primaryGuardianId: dto.primaryGuardianId }
          : {}),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.id, familyGroupId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "family_group.update",
      recordType: "FamilyGroup",
      recordId: familyGroupId,
      before: {
        name: existing.name,
        primaryGuardianId: existing.primaryGuardianId
      },
      after: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.primaryGuardianId !== undefined
          ? { primaryGuardianId: dto.primaryGuardianId }
          : {})
      }
    });

    return this.getFamilyGroupTree(tenantId, familyGroupId);
  }

  async getFamilyGroup(tenantId: string, familyGroupId: string) {
    return this.getFamilyGroupTree(tenantId, familyGroupId);
  }

  async getFamilyGroupTree(tenantId: string, familyGroupId: string) {
    const [group] = await this.db
      .select({
        id: familyGroups.id,
        name: familyGroups.name,
        primaryGuardianId: familyGroups.primaryGuardianId
      })
      .from(familyGroups)
      .where(and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.id, familyGroupId)));

    if (!group) {
      throw new NotFoundException("Family group not found.");
    }

    const memberRows = await this.db
      .select({
        id: students.id,
        fullName: students.fullName,
        admissionNumber: students.admissionNumber,
        status: students.status,
        dateOfBirth: students.dateOfBirth
      })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.familyGroupId, familyGroupId)))
      .orderBy(students.dateOfBirth, students.fullName);

    const guardianLinkRows = await this.db
      .select({
        guardianId: guardians.id,
        guardianName: guardians.fullName,
        phone: guardians.phone,
        studentId: students.id,
        relationship: studentGuardians.relationship
      })
      .from(students)
      .innerJoin(studentGuardians, eq(studentGuardians.studentId, students.id))
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .where(
        and(eq(students.tenantId, tenantId), eq(students.familyGroupId, familyGroupId))
      );

    const guardianMap = new Map<
      string,
      {
        id: string;
        fullName: string;
        phone: string | null;
        isPrimary: boolean;
        studentLinks: Array<{ studentId: string; relationship: string }>;
      }
    >();

    for (const row of guardianLinkRows) {
      const existing = guardianMap.get(row.guardianId);
      const link = { studentId: row.studentId, relationship: row.relationship };
      if (existing) {
        if (!existing.studentLinks.some((item) => item.studentId === row.studentId)) {
          existing.studentLinks.push(link);
        }
      } else {
        guardianMap.set(row.guardianId, {
          id: row.guardianId,
          fullName: row.guardianName,
          phone: row.phone,
          isPrimary: row.guardianId === group.primaryGuardianId,
          studentLinks: [link]
        });
      }
    }

    if (group.primaryGuardianId && !guardianMap.has(group.primaryGuardianId)) {
      const [guardian] = await this.db
        .select({
          id: guardians.id,
          fullName: guardians.fullName,
          phone: guardians.phone
        })
        .from(guardians)
        .where(
          and(eq(guardians.tenantId, tenantId), eq(guardians.id, group.primaryGuardianId))
        );
      if (guardian) {
        guardianMap.set(guardian.id, {
          id: guardian.id,
          fullName: guardian.fullName,
          phone: guardian.phone,
          isPrimary: true,
          studentLinks: []
        });
      }
    }

    let primaryGuardian: { id: string; fullName: string; phone: string | null } | null = null;
    if (group.primaryGuardianId) {
      const node = guardianMap.get(group.primaryGuardianId);
      primaryGuardian = node
        ? { id: node.id, fullName: node.fullName, phone: node.phone }
        : null;
    }

    const guardiansList = [...guardianMap.values()].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      return a.fullName.localeCompare(b.fullName);
    });

    const studentsList = memberRows.map((member) => ({
      ...member,
      guardians: guardianLinkRows
        .filter((row) => row.studentId === member.id)
        .map((row) => ({
          guardianId: row.guardianId,
          relationship: row.relationship
        }))
    }));

    return {
      id: group.id,
      name: group.name,
      primaryGuardian,
      guardians: guardiansList,
      students: studentsList,
      members: studentsList
    };
  }

  async setStudentFamilyGroup(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: SetStudentFamilyGroupDto
  ) {
    const student = await this.getStudentOrThrow(tenantId, studentId);
    const nextFamilyGroupId = dto.familyGroupId;

    if (nextFamilyGroupId) {
      const [family] = await this.db
        .select({ id: familyGroups.id })
        .from(familyGroups)
        .where(
          and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.id, nextFamilyGroupId))
        );

      if (!family) {
        throw new NotFoundException("Family group not found.");
      }
    }

    await this.db
      .update(students)
      .set({
        familyGroupId: nextFamilyGroupId,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.family_group.update",
      recordType: "student",
      recordId: studentId,
      before: { familyGroupId: student.familyGroupId },
      after: { familyGroupId: nextFamilyGroupId }
    });

    if (!nextFamilyGroupId) {
      return { familyGroupId: null };
    }

    return this.getFamilyGroup(tenantId, nextFamilyGroupId);
  }

  async createFamilyGroupForStudent(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    dto: CreateStudentFamilyGroupDto
  ) {
    const student = await this.getStudentOrThrow(tenantId, studentId);

    if (student.familyGroupId) {
      throw new ConflictException("Student is already linked to a family group.");
    }

    const guardianLinks = await this.db
      .select({ guardianId: studentGuardians.guardianId })
      .from(studentGuardians)
      .where(
        and(eq(studentGuardians.tenantId, tenantId), eq(studentGuardians.studentId, studentId))
      );

    const guardianId = dto.primaryGuardianId ?? guardianLinks[0]?.guardianId;
    if (!guardianId) {
      throw new BadRequestException("Link a guardian before creating a family group.");
    }

    const familyGroupId = await this.ensureFamilyGroupForStudent(
      tenantId,
      studentId,
      actorUserId,
      {
        guardianId,
        familyName: dto.name
      }
    );

    if (!familyGroupId) {
      throw new BadRequestException("Could not create family group.");
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "student.family_group.create",
      recordType: "student",
      recordId: studentId,
      after: { familyGroupId }
    });

    return this.getFamilyGroup(tenantId, familyGroupId);
  }

  /** Links a student to an existing or new family group for sibling discount eligibility. */
  async ensureFamilyGroupForStudent(
    tenantId: string,
    studentId: string,
    actorUserId: string | undefined,
    input: { guardianId: string; familyName?: string }
  ) {
    const student = await this.getStudentOrThrow(tenantId, studentId);
    if (student.familyGroupId) {
      return student.familyGroupId;
    }

    const [guardian] = await this.db
      .select({ id: guardians.id, fullName: guardians.fullName })
      .from(guardians)
      .where(and(eq(guardians.tenantId, tenantId), eq(guardians.id, input.guardianId)));

    if (!guardian) {
      return null;
    }

    const [primaryFamily] = await this.db
      .select({ id: familyGroups.id })
      .from(familyGroups)
      .where(
        and(
          eq(familyGroups.tenantId, tenantId),
          eq(familyGroups.primaryGuardianId, guardian.id)
        )
      )
      .limit(1);

    if (primaryFamily) {
      await this.db
        .update(students)
        .set({ familyGroupId: primaryFamily.id, updatedBy: actorUserId, updatedAt: new Date() })
        .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));
      return primaryFamily.id;
    }

    const [siblingStudent] = await this.db
      .select({ familyGroupId: students.familyGroupId })
      .from(studentGuardians)
      .innerJoin(students, eq(studentGuardians.studentId, students.id))
      .where(
        and(
          eq(studentGuardians.tenantId, tenantId),
          eq(studentGuardians.guardianId, guardian.id),
          isNotNull(students.familyGroupId)
        )
      )
      .limit(1);

    if (siblingStudent?.familyGroupId) {
      await this.db
        .update(students)
        .set({
          familyGroupId: siblingStudent.familyGroupId,
          updatedBy: actorUserId,
          updatedAt: new Date()
        })
        .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));
      return siblingStudent.familyGroupId;
    }

    const [family] = await this.db
      .insert(familyGroups)
      .values({
        tenantId,
        name: input.familyName ?? `${guardian.fullName} family`,
        primaryGuardianId: guardian.id,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning({ id: familyGroups.id });

    await this.db
      .update(students)
      .set({ familyGroupId: family!.id, updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));

    return family!.id;
  }

  getTimeline(tenantId: string, studentId: string) {
    return this.db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.recordId, studentId)))
      .orderBy(desc(auditLogs.createdAt));
  }
}
