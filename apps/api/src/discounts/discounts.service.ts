import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { discountRules, studentDiscounts } from "../db/schema.js";
import type {
  ApproveDiscountDto,
  CreateDiscountRuleDto,
  ListStudentDiscountsQueryDto,
  RejectDiscountDto,
  RequestStudentDiscountDto
} from "./dto.js";

@Injectable()
export class DiscountsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listDiscountRules(tenantId: string) {
    return this.db.select().from(discountRules).where(eq(discountRules.tenantId, tenantId));
  }

  async createDiscountRule(tenantId: string, actorUserId: string, dto: CreateDiscountRuleDto) {
    const [rule] = await this.db
      .insert(discountRules)
      .values({
        tenantId,
        name: dto.name,
        discountType: dto.discountType,
        valueType: dto.valueType,
        value: String(dto.value),
        approvalThreshold: dto.approvalThreshold != null ? String(dto.approvalThreshold) : null,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "discount_rule.create",
      recordType: "DiscountRule",
      recordId: rule!.id,
      after: { name: dto.name, discountType: dto.discountType }
    });

    return rule;
  }

  async listStudentDiscounts(tenantId: string, query: ListStudentDiscountsQueryDto) {
    const filters = [eq(studentDiscounts.tenantId, tenantId)];

    if (query.studentId) {
      filters.push(eq(studentDiscounts.studentId, query.studentId));
    }

    if (query.status) {
      filters.push(eq(studentDiscounts.status, query.status as "draft" | "submitted" | "reviewed" | "approved" | "published" | "archived" | "rejected"));
    }

    return this.db
      .select({
        id: studentDiscounts.id,
        tenantId: studentDiscounts.tenantId,
        studentId: studentDiscounts.studentId,
        discountRuleId: studentDiscounts.discountRuleId,
        reason: studentDiscounts.reason,
        effectiveFrom: studentDiscounts.effectiveFrom,
        effectiveTo: studentDiscounts.effectiveTo,
        status: studentDiscounts.status,
        createdAt: studentDiscounts.createdAt,
        updatedAt: studentDiscounts.updatedAt,
        ruleName: discountRules.name
      })
      .from(studentDiscounts)
      .leftJoin(discountRules, eq(studentDiscounts.discountRuleId, discountRules.id))
      .where(and(...filters));
  }

  async requestDiscount(tenantId: string, actorUserId: string, dto: RequestStudentDiscountDto) {
    const [discount] = await this.db
      .insert(studentDiscounts)
      .values({
        tenantId,
        studentId: dto.studentId,
        discountRuleId: dto.discountRuleId,
        reason: dto.reason,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
        status: "draft",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "student_discount.request",
      recordType: "StudentDiscount",
      recordId: discount!.id,
      after: { studentId: dto.studentId, discountRuleId: dto.discountRuleId, status: "draft" }
    });

    return discount;
  }

  async approveDiscount(tenantId: string, discountId: string, actorUserId: string, dto: ApproveDiscountDto) {
    const [existing] = await this.db
      .select()
      .from(studentDiscounts)
      .where(and(eq(studentDiscounts.id, discountId), eq(studentDiscounts.tenantId, tenantId)));

    if (!existing) {
      throw new NotFoundException("Student discount not found.");
    }

    const [updated] = await this.db
      .update(studentDiscounts)
      .set({
        status: "approved",
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(studentDiscounts.id, discountId), eq(studentDiscounts.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "student_discount.approve",
      recordType: "StudentDiscount",
      recordId: discountId,
      before: { status: existing.status },
      after: { status: "approved", notes: dto.notes }
    });

    return updated;
  }

  async rejectDiscount(tenantId: string, discountId: string, actorUserId: string, dto: RejectDiscountDto) {
    const [existing] = await this.db
      .select()
      .from(studentDiscounts)
      .where(and(eq(studentDiscounts.id, discountId), eq(studentDiscounts.tenantId, tenantId)));

    if (!existing) {
      throw new NotFoundException("Student discount not found.");
    }

    const [updated] = await this.db
      .update(studentDiscounts)
      .set({
        status: "rejected",
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(studentDiscounts.id, discountId), eq(studentDiscounts.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "student_discount.reject",
      recordType: "StudentDiscount",
      recordId: discountId,
      before: { status: existing.status },
      after: { status: "rejected", reason: dto.reason }
    });

    return updated;
  }
}
