import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  employmentRoleForRoleKey,
  isTeacherRoleKey,
  personTypeToRoleKey,
  type PersonType
} from "@sms/shared";
import { and, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { DepartmentsService } from "../departments/departments.service.js";
import {
  assignments,
  classroomStudents,
  classroomSubjectTeachers,
  classrooms,
  gradeChiefAssignments,
  learningMaterials,
  payrollRecords,
  roles,
  salaryRecords,
  staff,
  staffBenefitEnrollments,
  staffCompensationProfiles,
  staffIncentiveEligibility,
  timetableSlots,
  userRoles,
  users
} from "../db/schema.js";
import { IdentityService } from "../identity/identity.service.js";
import type {
  CreateStaffDto,
  LinkStaffUserDto,
  ListStaffQueryDto,
  ProvisionStaffDto,
  ProvisionStaffUpdateDto,
  UpdateStaffDto
} from "./dto.js";
import { TeacherAssignmentsService } from "./teacher-assignments.service.js";

/** Postgres foreign-key violation — a delete blocked by a referencing row. */
function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

@Injectable()
export class HrService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly identityService: IdentityService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
    private readonly departmentsService: DepartmentsService
  ) {}

  private buildStaffFilters(tenantId: string, query: ListStaffQueryDto) {
    const filters = [eq(staff.tenantId, tenantId)];

    // Archive lifecycle: default view hides archived staff; "archived" shows
    // only them; "all" shows both.
    if (query.view === "archived") {
      filters.push(isNotNull(staff.archivedAt));
    } else if (query.view !== "all") {
      filters.push(isNull(staff.archivedAt));
    }

    if (query.status) {
      filters.push(eq(staff.status, query.status as typeof staff.status._.data));
    }
    if (query.department) {
      filters.push(eq(staff.department, query.department));
    }
    if (query.employmentRole) {
      filters.push(eq(staff.employmentRole, query.employmentRole));
    }
    if (query.excludeEmploymentRole) {
      filters.push(ne(staff.employmentRole, query.excludeEmploymentRole));
    }
    if (query.search) {
      filters.push(ilike(staff.fullName, `%${query.search}%`));
    }
    if (query.eligibleGradeId) {
      const gradeFilter = sql`${staff.teacherProfile}->'eligibleGradeIds' @> ${JSON.stringify([query.eligibleGradeId])}::jsonb`;
      if (query.includeStaffId) {
        const eligibleOrCurrent = or(gradeFilter, eq(staff.id, query.includeStaffId));
        if (eligibleOrCurrent) {
          filters.push(eligibleOrCurrent);
        }
      } else {
        filters.push(gradeFilter);
      }
    }

    return filters;
  }

  async listStaff(tenantId: string, query: ListStaffQueryDto) {
    const filters = this.buildStaffFilters(tenantId, query);
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;

    return this.db
      .select()
      .from(staff)
      .where(and(...filters))
      .orderBy(desc(staff.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  async countStaff(tenantId: string, query: ListStaffQueryDto) {
    const filters = this.buildStaffFilters(tenantId, query);
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(staff)
      .where(and(...filters));

    return row?.count ?? 0;
  }

  async listStaffOverview(tenantId: string, query: ListStaffQueryDto) {
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;
    const [rows, total] = await Promise.all([
      this.listStaff(tenantId, { ...query, limit, offset }),
      this.countStaff(tenantId, query)
    ]);

    const staffIds = rows.map((member) => member.id);
    const userIds = rows.map((member) => member.userId).filter((id): id is string => Boolean(id));

    const usersById = new Map<string, { email: string | null; status: string }>();
    const rolesByUserId = new Map<string, string>();
    const homeroomByStaffId = new Map<string, number>();
    const classroomsByStaffId = new Map<string, Set<string>>();
    const subjectsByStaffId = new Map<string, Set<string>>();

    if (userIds.length > 0) {
      const userRows = await this.db
        .select({ id: users.id, email: users.email, status: users.status })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), inArray(users.id, userIds)));

      for (const user of userRows) {
        usersById.set(user.id, { email: user.email, status: user.status });
      }

      const roleRows = await this.db
        .select({ userId: userRoles.userId, key: roles.key })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(userRoles.tenantId, tenantId), inArray(userRoles.userId, userIds)));

      for (const roleRow of roleRows) {
        if (!rolesByUserId.has(roleRow.userId)) {
          rolesByUserId.set(roleRow.userId, roleRow.key);
        }
      }
    }

    if (staffIds.length > 0) {
      const homeroomRows = await this.db
        .select({
          staffId: classrooms.classTeacherStaffId,
          count: sql<number>`count(*)::int`
        })
        .from(classrooms)
        .where(
          and(
            eq(classrooms.tenantId, tenantId),
            inArray(classrooms.classTeacherStaffId, staffIds)
          )
        )
        .groupBy(classrooms.classTeacherStaffId);

      for (const row of homeroomRows) {
        if (row.staffId) homeroomByStaffId.set(row.staffId, row.count);
      }

      const homeroomClassroomRows = await this.db
        .select({
          staffId: classrooms.classTeacherStaffId,
          classroomId: classrooms.id
        })
        .from(classrooms)
        .where(
          and(
            eq(classrooms.tenantId, tenantId),
            inArray(classrooms.classTeacherStaffId, staffIds)
          )
        );

      for (const row of homeroomClassroomRows) {
        if (!row.staffId) continue;
        const classrooms = classroomsByStaffId.get(row.staffId) ?? new Set<string>();
        classrooms.add(row.classroomId);
        classroomsByStaffId.set(row.staffId, classrooms);
      }

      const assignmentRows = await this.db
        .select({
          staffId: classroomSubjectTeachers.teacherStaffId,
          classroomId: classroomSubjectTeachers.classroomId,
          subjectId: classroomSubjectTeachers.subjectId
        })
        .from(classroomSubjectTeachers)
        .where(
          and(
            eq(classroomSubjectTeachers.tenantId, tenantId),
            inArray(classroomSubjectTeachers.teacherStaffId, staffIds)
          )
        );

      for (const row of assignmentRows) {
        if (!row.staffId) continue;
        const classrooms = classroomsByStaffId.get(row.staffId) ?? new Set<string>();
        classrooms.add(row.classroomId);
        classroomsByStaffId.set(row.staffId, classrooms);

        const subjects = subjectsByStaffId.get(row.staffId) ?? new Set<string>();
        subjects.add(row.subjectId);
        subjectsByStaffId.set(row.staffId, subjects);
      }
    }

    const data = rows.map((member) => {
      const user = member.userId ? usersById.get(member.userId) : undefined;
      return {
        ...member,
        loginEmail: user?.email ?? null,
        loginStatus: user?.status ?? null,
        rbacRoleKey: member.userId ? (rolesByUserId.get(member.userId) ?? null) : null,
        homeroomCount: homeroomByStaffId.get(member.id) ?? 0,
        classroomCount: classroomsByStaffId.get(member.id)?.size ?? 0,
        subjectCount: subjectsByStaffId.get(member.id)?.size ?? 0
      };
    });

    return { data, total, limit, offset };
  }

  async getStaff(tenantId: string, staffId: string) {
    const [member] = await this.db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));

    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }

    const teachingAssignments = await this.db
      .select()
      .from(classroomSubjectTeachers)
      .where(
        and(
          eq(classroomSubjectTeachers.tenantId, tenantId),
          eq(classroomSubjectTeachers.teacherStaffId, staffId)
        )
      );

    return { ...member, teachingAssignments };
  }

  // ---------------------------------------------------------------------------
  // Archive lifecycle: Active → Archived (reviewable) → Restore | Permanent delete.
  // `archivedAt` is orthogonal to `status`, so the employment state
  // (active/probation/resigned/…) is preserved and restore returns to it.
  // ---------------------------------------------------------------------------

  private async getStaffOrThrow(tenantId: string, staffId: string) {
    const [member] = await this.db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));
    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }
    return member;
  }

  async archiveStaff(tenantId: string, staffId: string, actorUserId?: string) {
    const before = await this.getStaffOrThrow(tenantId, staffId);
    if (before.archivedAt) {
      return before;
    }

    const [updated] = await this.db
      .update(staff)
      .set({
        archivedAt: new Date(),
        archivedBy: actorUserId,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.archive",
      recordType: "staff",
      recordId: staffId,
      before: { archivedAt: null },
      after: { archivedAt: updated!.archivedAt }
    });

    return updated!;
  }

  async restoreStaff(tenantId: string, staffId: string, actorUserId?: string) {
    const before = await this.getStaffOrThrow(tenantId, staffId);
    if (!before.archivedAt) {
      return before;
    }

    const [updated] = await this.db
      .update(staff)
      .set({
        archivedAt: null,
        archivedBy: null,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.restore",
      recordType: "staff",
      recordId: staffId,
      before: { archivedAt: before.archivedAt },
      after: { archivedAt: null }
    });

    return updated!;
  }

  /** Counts of teaching/operational/payroll records that block permanent deletion. */
  private async getStaffBlockingDependencies(tenantId: string, staffId: string) {
    const n = sql<number>`count(*)::int`;
    const [subjectTeaching, gradeChief, homerooms, timetable, salary, payroll] = await Promise.all([
      this.db.select({ n }).from(classroomSubjectTeachers).where(and(eq(classroomSubjectTeachers.tenantId, tenantId), eq(classroomSubjectTeachers.teacherStaffId, staffId))),
      this.db.select({ n }).from(gradeChiefAssignments).where(and(eq(gradeChiefAssignments.tenantId, tenantId), eq(gradeChiefAssignments.staffId, staffId))),
      this.db.select({ n }).from(classrooms).where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.classTeacherStaffId, staffId))),
      this.db.select({ n }).from(timetableSlots).where(and(eq(timetableSlots.tenantId, tenantId), eq(timetableSlots.teacherStaffId, staffId))),
      this.db.select({ n }).from(salaryRecords).where(and(eq(salaryRecords.tenantId, tenantId), eq(salaryRecords.staffId, staffId))),
      this.db.select({ n }).from(payrollRecords).where(and(eq(payrollRecords.tenantId, tenantId), eq(payrollRecords.staffId, staffId)))
    ]);
    return {
      subjectTeaching: subjectTeaching[0]?.n ?? 0,
      gradeChief: gradeChief[0]?.n ?? 0,
      homerooms: homerooms[0]?.n ?? 0,
      timetable: timetable[0]?.n ?? 0,
      salary: salary[0]?.n ?? 0,
      payroll: payroll[0]?.n ?? 0
    };
  }

  async permanentlyDeleteStaff(tenantId: string, staffId: string, actorUserId?: string) {
    const member = await this.getStaffOrThrow(tenantId, staffId);

    // Two-step safety: only an archived staff member can be permanently deleted.
    if (!member.archivedAt) {
      throw new BadRequestException("Archive the staff member before deleting permanently.");
    }

    const dependencies = await this.getStaffBlockingDependencies(tenantId, staffId);
    if (Object.values(dependencies).some((c) => c > 0)) {
      throw new ConflictException({
        message:
          "This staff member has teaching, timetable, or payroll records and cannot be permanently deleted. Keep them archived instead.",
        dependencies
      });
    }

    try {
      await this.db.transaction(async (tx) => {
        // Cascade the owned compensation config — not teaching/payroll history.
        await tx.delete(staffCompensationProfiles).where(and(eq(staffCompensationProfiles.tenantId, tenantId), eq(staffCompensationProfiles.staffId, staffId)));
        await tx.delete(staffIncentiveEligibility).where(and(eq(staffIncentiveEligibility.tenantId, tenantId), eq(staffIncentiveEligibility.staffId, staffId)));
        await tx.delete(staffBenefitEnrollments).where(and(eq(staffBenefitEnrollments.tenantId, tenantId), eq(staffBenefitEnrollments.staffId, staffId)));
        await tx.delete(staff).where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));
      });
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new ConflictException({
          message:
            "This staff member is still referenced by other records and cannot be deleted. Keep them archived instead."
        });
      }
      throw err;
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.delete",
      recordType: "staff",
      recordId: staffId,
      before: {
        fullName: member.fullName,
        employeeNumber: member.employeeNumber,
        status: member.status
      },
      after: { deleted: true }
    });

    return { id: staffId, deleted: true };
  }

  async createStaff(tenantId: string, actorUserId: string | undefined, dto: CreateStaffDto) {
    const [member] = await this.db
      .insert(staff)
      .values({
        tenantId,
        fullName: dto.fullName,
        employmentRole: dto.employmentRole ?? "staff",
        email: dto.email,
        phone: dto.phone,
        department: dto.department,
        joinDate: dto.joinDate,
        salaryBasis: dto.salaryBasis,
        address: dto.address,
        status: (dto.employmentStatus as typeof staff.status._.data) ?? "active",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.create",
      recordType: "Staff",
      recordId: member!.id,
      after: { fullName: member!.fullName }
    });

    return member;
  }

  listAssignableRoles(tenantId: string, scope?: "team" | "teacher") {
    return this.identityService.listAssignableRoles(tenantId, scope);
  }

  async getTeacherProfile(tenantId: string, staffId: string) {
    const [member] = await this.db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));

    if (!member) {
      throw new NotFoundException("Teacher not found.");
    }

    if (member.employmentRole !== "teacher") {
      throw new BadRequestException("This staff member is not a teacher.");
    }

    let loginEmail: string | null = null;
    let loginStatus: string | null = null;
    let rbacRoleKey: string | null = null;

    if (member.userId) {
      const [user] = await this.db
        .select({ email: users.email, status: users.status })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.id, member.userId)));

      loginEmail = user?.email ?? null;
      loginStatus = user?.status ?? null;

      const [roleRow] = await this.db
        .select({ key: roles.key })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, member.userId)))
        .limit(1);

      rbacRoleKey = roleRow?.key ?? null;
    }

    const assignments = await this.teacherAssignmentsService.getTeacherAssignments(
      tenantId,
      staffId
    );

    const classroomIds = new Set<string>();
    for (const row of assignments.homeroom) {
      classroomIds.add(row.classroomId);
    }
    for (const row of assignments.subjectTeaching) {
      classroomIds.add(row.classroomId);
    }

    let studentCount = 0;
    const teachingClasses = [];

    for (const classroomId of classroomIds) {
      const homeroom = assignments.homeroom.find((row) => row.classroomId === classroomId);
      const subjects = assignments.subjectTeaching.filter(
        (row) => row.classroomId === classroomId
      );
      const [countRow] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(classroomStudents)
        .where(
          and(eq(classroomStudents.tenantId, tenantId), eq(classroomStudents.classroomId, classroomId))
        );

      const count = countRow?.count ?? 0;
      studentCount += count;

      teachingClasses.push({
        classroomId,
        classroomName: homeroom?.classroomName ?? subjects[0]?.classroomName ?? "Classroom",
        room: homeroom?.room ?? null,
        gradeName: homeroom?.gradeName ?? null,
        gradeId: homeroom?.gradeId ?? subjects[0]?.gradeId ?? null,
        subjects: subjects.map((row) => row.subjectName),
        studentCount: count,
        periodsPerWeek: Math.max(subjects.length * 2, homeroom ? 5 : subjects.length * 2)
      });
    }

    const yearsExperience =
      member.joinDate != null
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(String(member.joinDate)).getTime()) /
                (1000 * 60 * 60 * 24 * 365.25)
            )
          )
        : null;

    const qualifications = (member.qualifications ?? []) as Array<{
      title?: string;
      institution?: string;
      year?: string;
    }>;

    const capability = {
      sectorIds: member.teacherProfile?.sectorIds ?? [],
      competentSubjectIds: member.teacherProfile?.competentSubjectIds ?? [],
      eligibleGradeIds: member.teacherProfile?.eligibleGradeIds ?? []
    };

    return {
      ...member,
      loginEmail,
      loginStatus,
      rbacRoleKey,
      promotionTitle: member.promotionTitle,
      capability,
      assignments,
      teachingClasses,
      stats: {
        periodsPerWeek: teachingClasses.reduce((sum, row) => sum + row.periodsPerWeek, 0),
        classesTaught: classroomIds.size,
        students: studentCount,
        avgClassScore: null as number | null
      },
      yearsExperience,
      qualifications
    };
  }

  async provisionStaff(tenantId: string, actorUserId: string | undefined, dto: ProvisionStaffDto) {
    if (!dto.email?.trim()) {
      throw new BadRequestException("Email is required.");
    }
    if (!dto.phone?.trim()) {
      throw new BadRequestException("Phone is required.");
    }

    const createLogin = true;
    const roleKey =
      dto.roleKey ?? dto.rbacRoleKey ?? (dto.personType ? personTypeToRoleKey[dto.personType] : undefined);

    if (!roleKey) {
      throw new BadRequestException("Role is required.");
    }

    await this.identityService.assertAssignableRole(tenantId, roleKey);
    const employmentRole = employmentRoleForRoleKey(roleKey);
    const isTeacher = isTeacherRoleKey(roleKey);

    if (isTeacher && dto.teacherAssignments) {
      // validated later via TeacherAssignmentsService
    } else if (!isTeacher && dto.teacherAssignments) {
      throw new BadRequestException("Teacher assignments are only allowed for teachers.");
    }

    const department = await this.departmentsService.resolveDepartment(
      tenantId,
      dto.departmentId,
      dto.department
    );

    let userId: string | null = null;
    let credentialsSent = false;

    if (createLogin) {
      const resolved = await this.resolveProvisionUser(tenantId, dto, actorUserId);
      userId = resolved.userId;
      credentialsSent = resolved.credentialsSent;

      if (userId) {
        await this.identityService.assignRoleByKey(tenantId, userId, roleKey, actorUserId);
      }
    }

    const [member] = await this.db
      .insert(staff)
      .values({
        tenantId,
        userId,
        fullName: dto.fullName,
        employmentRole,
        email: dto.email.trim(),
        phone: dto.phone.trim(),
        departmentId: department.departmentId,
        department: department.departmentName,
        joinDate: dto.joinDate,
        promotionTitle: dto.promotionTitle,
        qualifications: (dto.qualifications ?? []) as unknown as Record<string, unknown>[],
        status: "active",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    if (isTeacher && dto.teacherAssignments && member) {
      await this.teacherAssignmentsService.updateTeacherAssignments(
        tenantId,
        member.id,
        dto.teacherAssignments,
        actorUserId
      );
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.provision",
      recordType: "Staff",
      recordId: member!.id,
      after: {
        fullName: dto.fullName,
        roleKey,
        userId
      }
    });

    const assignments =
      isTeacher && member
        ? await this.teacherAssignmentsService.getTeacherAssignments(tenantId, member.id)
        : null;

    return {
      staff: member,
      userId,
      credentialsSent,
      rbacRoleKey: roleKey,
      assignments
    };
  }

  async updateStaff(
    tenantId: string,
    staffId: string,
    actorUserId: string | undefined,
    dto: UpdateStaffDto
  ) {
    const [member] = await this.db
      .update(staff)
      .set({
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.employmentRole !== undefined && { employmentRole: dto.employmentRole }),
        ...(dto.employmentStatus !== undefined && {
          status: dto.employmentStatus as typeof staff.status._.data
        }),
        ...(dto.joinDate !== undefined && { joinDate: dto.joinDate }),
        ...(dto.salaryBasis !== undefined && { salaryBasis: dto.salaryBasis }),
        ...(dto.address !== undefined && { address: dto.address }),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning();

    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.update",
      recordType: "Staff",
      recordId: staffId,
      after: dto as Record<string, unknown>
    });

    return member;
  }

  async provisionUpdateStaff(
    tenantId: string,
    staffId: string,
    actorUserId: string | undefined,
    dto: ProvisionStaffUpdateDto
  ) {
    const [existing] = await this.db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)));

    if (!existing) {
      throw new NotFoundException("Staff member not found.");
    }

    const roleKey =
      dto.roleKey ??
      dto.rbacRoleKey ??
      (dto.personType ? personTypeToRoleKey[dto.personType] : undefined);

    if (roleKey) {
      await this.identityService.assertAssignableRole(tenantId, roleKey);
    }

    const employmentRole = roleKey ? employmentRoleForRoleKey(roleKey) : undefined;
    const isTeacher = roleKey
      ? isTeacherRoleKey(roleKey)
      : existing.employmentRole === "teacher";

    const department =
      dto.departmentId !== undefined || dto.department !== undefined
        ? await this.departmentsService.resolveDepartment(
            tenantId,
            dto.departmentId,
            dto.department
          )
        : null;

    const [member] = await this.db
      .update(staff)
      .set({
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(department
          ? { departmentId: department.departmentId, department: department.departmentName }
          : dto.department !== undefined
            ? { department: dto.department }
            : {}),
        ...(employmentRole !== undefined && { employmentRole }),
        ...(dto.qualifications !== undefined && {
          qualifications: dto.qualifications as unknown as Record<string, unknown>[]
        }),
        ...(dto.promotionTitle !== undefined && { promotionTitle: dto.promotionTitle }),
        ...(dto.employmentStatus !== undefined && {
          status: dto.employmentStatus as typeof staff.status._.data
        }),
        ...(dto.joinDate !== undefined && { joinDate: dto.joinDate }),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning();

    if (roleKey && existing.userId) {
      await this.identityService.assignRoleByKey(
        tenantId,
        existing.userId,
        roleKey,
        actorUserId
      );
    }

    if (dto.teacherAssignments) {
      if (!isTeacher) {
        throw new BadRequestException("Teacher assignments are only allowed for teachers.");
      }
      await this.teacherAssignmentsService.updateTeacherAssignments(
        tenantId,
        staffId,
        dto.teacherAssignments,
        actorUserId
      );
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.provision_update",
      recordType: "Staff",
      recordId: staffId,
      after: dto as Record<string, unknown>
    });

    const assignments = isTeacher
        ? await this.teacherAssignmentsService.getTeacherAssignments(tenantId, staffId)
        : null;

    return { staff: member, assignments };
  }

  async linkUser(
    tenantId: string,
    staffId: string,
    actorUserId: string | undefined,
    dto: LinkStaffUserDto
  ) {
    await this.assertUserAvailable(tenantId, dto.userId, staffId);

    const [member] = await this.db
      .update(staff)
      .set({ userId: dto.userId, updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .returning();

    if (!member) {
      throw new NotFoundException("Staff member not found.");
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff.link_user",
      recordType: "Staff",
      recordId: staffId,
      after: { userId: dto.userId }
    });

    return member;
  }

  private async resolveProvisionUser(
    tenantId: string,
    dto: ProvisionStaffDto,
    actorUserId?: string
  ) {
    const existing = await this.identityService.findUserByContact(tenantId, {
      email: dto.email,
      phone: dto.phone
    });

    if (existing) {
      await this.assertUserAvailable(tenantId, existing.id);
      return { userId: existing.id, credentialsSent: false };
    }

    const invited = await this.identityService.inviteUser(
      tenantId,
      {
        displayName: dto.fullName,
        email: dto.email || undefined,
        phone: dto.phone || undefined
      },
      actorUserId
    );

    return {
      userId: invited.id ?? null,
      credentialsSent: Boolean(invited.credentialsSent)
    };
  }

  private async assertUserAvailable(tenantId: string, userId: string, excludeStaffId?: string) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));

    if (!user) {
      throw new NotFoundException("User not found in this tenant.");
    }

    const [linked] = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.userId, userId)));

    if (linked && linked.id !== excludeStaffId) {
      throw new ConflictException("This user is already linked to another staff member.");
    }
  }

  private inferPersonType(employmentRole: string): PersonType {
    if (employmentRole === "teacher") return "teacher";
    if (employmentRole === "accountant") return "accountant";
    if (employmentRole === "admin") return "admin_staff";
    return "other";
  }
}
