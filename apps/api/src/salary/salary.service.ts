import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { salaryComponents, salaryRecords, staff } from "../db/schema.js";
import type {
  AdjustSalaryRecordDto,
  ApproveSalaryRecordDto,
  CreateSalaryComponentDto,
  GenerateSalaryRecordsDto,
  ListSalaryRecordsQueryDto,
  MarkSalaryPaidDto
} from "./dto.js";

@Injectable()
export class SalaryService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listComponents(tenantId: string) {
    return this.db
      .select()
      .from(salaryComponents)
      .where(eq(salaryComponents.tenantId, tenantId));
  }

  async createComponent(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateSalaryComponentDto
  ) {
    const [component] = await this.db
      .insert(salaryComponents)
      .values({
        tenantId,
        name: dto.name,
        componentType: dto.componentType,
        status: dto.isActive === false ? "inactive" : "active",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "salary_component.create",
      recordType: "SalaryComponent",
      recordId: component!.id,
      after: { name: component!.name, componentType: component!.componentType }
    });

    return component;
  }

  async listRecords(tenantId: string, query: ListSalaryRecordsQueryDto) {
    const filters = [eq(salaryRecords.tenantId, tenantId)];

    if (query.month) {
      filters.push(eq(salaryRecords.salaryMonth, query.month));
    }
    if (query.staffId) {
      filters.push(eq(salaryRecords.staffId, query.staffId));
    }
    if (query.approvalStatus) {
      filters.push(
        eq(salaryRecords.status, query.approvalStatus as typeof salaryRecords.status._.data)
      );
    }

    const records = await this.db
      .select({
        id: salaryRecords.id,
        tenantId: salaryRecords.tenantId,
        staffId: salaryRecords.staffId,
        salaryMonth: salaryRecords.salaryMonth,
        grossAmount: salaryRecords.grossAmount,
        deductionAmount: salaryRecords.deductionAmount,
        netAmount: salaryRecords.netAmount,
        status: salaryRecords.status,
        approvedByUserId: salaryRecords.approvedByUserId,
        paidAt: salaryRecords.paidAt,
        createdAt: salaryRecords.createdAt,
        updatedAt: salaryRecords.updatedAt,
        staffFullName: staff.fullName
      })
      .from(salaryRecords)
      .leftJoin(staff, eq(salaryRecords.staffId, staff.id))
      .where(and(...filters));

    return records;
  }

  async getRecord(tenantId: string, recordId: string) {
    const [record] = await this.db
      .select()
      .from(salaryRecords)
      .where(and(eq(salaryRecords.tenantId, tenantId), eq(salaryRecords.id, recordId)));

    if (!record) {
      throw new NotFoundException("Salary record not found.");
    }

    return record;
  }

  async generateMonthlyRecords(
    tenantId: string,
    actorUserId: string | undefined,
    dto: GenerateSalaryRecordsDto
  ) {
    const activeStaff = await this.db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.status, "active")));

    let generated = 0;

    for (const member of activeStaff) {
      const existing = await this.db
        .select()
        .from(salaryRecords)
        .where(
          and(
            eq(salaryRecords.tenantId, tenantId),
            eq(salaryRecords.staffId, member.id),
            eq(salaryRecords.salaryMonth, dto.month)
          )
        );

      if (existing.length === 0) {
        const grossAmount = "0";

        await this.db.insert(salaryRecords).values({
          tenantId,
          staffId: member.id,
          salaryMonth: dto.month,
          grossAmount,
          deductionAmount: "0",
          netAmount: grossAmount,
          status: "draft",
          createdBy: actorUserId,
          updatedBy: actorUserId
        });

        generated += 1;
      }
    }

    return { generated, month: dto.month };
  }

  async adjustRecord(
    tenantId: string,
    recordId: string,
    actorUserId: string | undefined,
    dto: AdjustSalaryRecordDto
  ) {
    const existing = await this.getRecord(tenantId, recordId);

    const gross = parseFloat(existing.grossAmount);
    const adjustment = dto.adjustmentAmount ?? 0;
    const deduction = parseFloat(existing.deductionAmount ?? "0");
    const newNet = gross + adjustment - deduction;

    const [record] = await this.db
      .update(salaryRecords)
      .set({
        netAmount: String(newNet),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(salaryRecords.tenantId, tenantId), eq(salaryRecords.id, recordId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "salary_record.adjust",
      recordType: "SalaryRecord",
      recordId,
      before: { netAmount: existing.netAmount },
      after: { netAmount: String(newNet), reason: dto.reason, notes: dto.notes }
    });

    return record;
  }

  async approveRecord(
    tenantId: string,
    recordId: string,
    actorUserId: string | undefined,
    dto: ApproveSalaryRecordDto
  ) {
    const existing = await this.getRecord(tenantId, recordId);

    const [record] = await this.db
      .update(salaryRecords)
      .set({
        status: "approved",
        approvedByUserId: actorUserId ?? null,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(salaryRecords.tenantId, tenantId), eq(salaryRecords.id, recordId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "salary_record.approve",
      recordType: "SalaryRecord",
      recordId,
      before: { status: existing.status },
      after: { status: "approved", notes: dto.notes }
    });

    return record;
  }

  async markPaid(
    tenantId: string,
    recordId: string,
    actorUserId: string | undefined,
    dto: MarkSalaryPaidDto
  ) {
    const existing = await this.getRecord(tenantId, recordId);

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const [record] = await this.db
      .update(salaryRecords)
      .set({
        paidAt,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(salaryRecords.tenantId, tenantId), eq(salaryRecords.id, recordId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "salary_record.mark_paid",
      recordType: "SalaryRecord",
      recordId,
      before: { status: existing.status, paidAt: existing.paidAt },
      after: {
        paidAt: paidAt.toISOString(),
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber
      }
    });

    return record;
  }
}
