import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { discountRules, studentDiscounts, students } from "../db/schema.js";
import type {
  ApproveDiscountDto,
  CreateDiscountRuleDto,
  ListStudentDiscountsQueryDto,
  RejectDiscountDto,
  RequestStudentDiscountDto,
  UpdateDiscountRuleDto
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
        criteria: dto.criteria ?? {},
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

  private async getDiscountRuleOrThrow(tenantId: string, ruleId: string) {
    const [rule] = await this.db
      .select()
      .from(discountRules)
      .where(and(eq(discountRules.id, ruleId), eq(discountRules.tenantId, tenantId)));

    if (!rule) {
      throw new NotFoundException("Discount rule not found.");
    }

    return rule;
  }

  async updateDiscountRule(
    tenantId: string,
    ruleId: string,
    actorUserId: string,
    dto: UpdateDiscountRuleDto
  ) {
    const previous = await this.getDiscountRuleOrThrow(tenantId, ruleId);

    const [rule] = await this.db
      .update(discountRules)
      .set({
        name: dto.name ?? previous.name,
        discountType: dto.discountType ?? previous.discountType,
        valueType: dto.valueType ?? previous.valueType,
        value: dto.value != null ? String(dto.value) : previous.value,
        approvalThreshold:
          dto.approvalThreshold === null
            ? null
            : dto.approvalThreshold != null
              ? String(dto.approvalThreshold)
              : previous.approvalThreshold,
        criteria: dto.criteria ?? previous.criteria,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(discountRules.id, ruleId), eq(discountRules.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "discount_rule.update",
      recordType: "DiscountRule",
      recordId: ruleId,
      before: previous as Record<string, unknown>,
      after: rule as Record<string, unknown>
    });

    return rule;
  }

  async archiveDiscountRule(tenantId: string, ruleId: string, actorUserId: string) {
    const previous = await this.getDiscountRuleOrThrow(tenantId, ruleId);
    if (previous.status === "archived") {
      return previous;
    }

    const [rule] = await this.db
      .update(discountRules)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(discountRules.id, ruleId), eq(discountRules.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "discount_rule.archive",
      recordType: "DiscountRule",
      recordId: ruleId,
      before: { status: previous.status },
      after: { status: "archived" }
    });

    return rule;
  }

  async reactivateDiscountRule(tenantId: string, ruleId: string, actorUserId: string) {
    const previous = await this.getDiscountRuleOrThrow(tenantId, ruleId);
    if (previous.status === "active") {
      return previous;
    }

    const [rule] = await this.db
      .update(discountRules)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(discountRules.id, ruleId), eq(discountRules.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "discount_rule.reactivate",
      recordType: "DiscountRule",
      recordId: ruleId,
      before: { status: previous.status },
      after: { status: "active" }
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
        ruleName: discountRules.name,
        studentFullName: students.fullName
      })
      .from(studentDiscounts)
      .leftJoin(discountRules, eq(studentDiscounts.discountRuleId, discountRules.id))
      .leftJoin(students, eq(studentDiscounts.studentId, students.id))
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
