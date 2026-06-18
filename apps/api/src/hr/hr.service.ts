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
import { and, desc, eq, ilike, ne, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { DepartmentsService } from "../departments/departments.service.js";
import {
  classroomStudents,
  classroomSubjectTeachers,
  classrooms,
  roles,
  staff,
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

@Injectable()
export class HrService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly identityService: IdentityService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
    private readonly departmentsService: DepartmentsService
  ) {}

  listStaff(tenantId: string, query: ListStaffQueryDto) {
    const filters = [eq(staff.tenantId, tenantId)];

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

    const q = this.db
      .select()
      .from(staff)
      .where(and(...filters))
      .orderBy(desc(staff.updatedAt));

    if (query.limit !== undefined) {
      q.limit(query.limit);
    }
    if (query.offset !== undefined) {
      q.offset(query.offset);
    }

    return q;
  }

  async listStaffOverview(tenantId: string, query: ListStaffQueryDto) {
    const rows = await this.listStaff(tenantId, query);

    const enriched = await Promise.all(
      rows.map(async (member) => {
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

        const [homeroomCount] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(classrooms)
          .where(
            and(eq(classrooms.tenantId, tenantId), eq(classrooms.classTeacherStaffId, member.id))
          );

        const [subjectCount] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(classroomSubjectTeachers)
          .where(
            and(
              eq(classroomSubjectTeachers.tenantId, tenantId),
              eq(classroomSubjectTeachers.teacherStaffId, member.id)
            )
          );

        return {
          ...member,
          loginEmail,
          loginStatus,
          rbacRoleKey,
          homeroomCount: homeroomCount?.count ?? 0,
          subjectCount: subjectCount?.count ?? 0
        };
      })
    );

    return enriched;
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
