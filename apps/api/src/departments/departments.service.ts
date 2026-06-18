import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { departments, staff } from "../db/schema.js";
import type { CreateDepartmentDto, UpdateDepartmentDto } from "./dto.js";

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listDepartments(tenantId: string) {
    return this.db
      .select({
        id: departments.id,
        name: departments.name,
        description: departments.description,
        status: departments.status,
        staffCount: sql<number>`count(${staff.id})::int`
      })
      .from(departments)
      .leftJoin(
        staff,
        and(eq(staff.departmentId, departments.id), eq(staff.tenantId, tenantId))
      )
      .where(eq(departments.tenantId, tenantId))
      .groupBy(departments.id)
      .orderBy(asc(departments.name));
  }

  listActiveDepartments(tenantId: string) {
    return this.db
      .select({
        id: departments.id,
        name: departments.name,
        description: departments.description
      })
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.status, "active")))
      .orderBy(asc(departments.name));
  }

  async getDepartment(tenantId: string, departmentId: string) {
    const rows = await this.listDepartments(tenantId);
    const department = rows.find((row) => row.id === departmentId);
    if (!department) {
      throw new NotFoundException("Department not found.");
    }
    return department;
  }

  async resolveDepartment(
    tenantId: string,
    departmentId: string | undefined,
    departmentName: string | undefined
  ) {
    if (departmentId) {
      const [department] = await this.db
        .select()
        .from(departments)
        .where(and(eq(departments.tenantId, tenantId), eq(departments.id, departmentId)));

      if (!department || department.status !== "active") {
        throw new BadRequestException("Department not found or inactive.");
      }

      return { departmentId: department.id, departmentName: department.name };
    }

    if (departmentName?.trim()) {
      return { departmentId: null, departmentName: departmentName.trim() };
    }

    return { departmentId: null, departmentName: null };
  }

  async createDepartment(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateDepartmentDto
  ) {
    const name = dto.name.trim();
    const [existing] = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.name, name)));

    if (existing) {
      throw new ConflictException(`Department "${name}" already exists.`);
    }

    const [department] = await this.db
      .insert(departments)
      .values({
        tenantId,
        name,
        description: dto.description?.trim() || null,
        status: "active"
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "department.create",
      recordType: "Department",
      recordId: department!.id,
      after: { name, description: dto.description?.trim() || null }
    });

    return this.getDepartment(tenantId, department!.id);
  }

  async updateDepartment(
    tenantId: string,
    departmentId: string,
    actorUserId: string | undefined,
    dto: UpdateDepartmentDto
  ) {
    const [existing] = await this.db
      .select()
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.id, departmentId)));

    if (!existing) {
      throw new NotFoundException("Department not found.");
    }

    const name = dto.name?.trim();
    if (name && name !== existing.name) {
      const [conflict] = await this.db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.tenantId, tenantId), eq(departments.name, name)));

      if (conflict) {
        throw new ConflictException(`Department "${name}" already exists.`);
      }
    }

    if (dto.status === "inactive") {
      const [assigned] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(staff)
        .where(and(eq(staff.tenantId, tenantId), eq(staff.departmentId, departmentId)));

      if ((assigned?.count ?? 0) > 0) {
        throw new BadRequestException("Cannot disable a department that has assigned staff.");
      }
    }

    await this.db
      .update(departments)
      .set({
        ...(name ? { name } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(departments.tenantId, tenantId), eq(departments.id, departmentId)));

    if (name && name !== existing.name) {
      await this.db
        .update(staff)
        .set({ department: name, updatedAt: new Date() })
        .where(and(eq(staff.tenantId, tenantId), eq(staff.departmentId, departmentId)));
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "department.update",
      recordType: "Department",
      recordId: departmentId,
      before: {
        name: existing.name,
        description: existing.description,
        status: existing.status
      },
      after: {
        ...(name ? { name } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.status ? { status: dto.status } : {})
      }
    });

    return this.getDepartment(tenantId, departmentId);
  }
}
