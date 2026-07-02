import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  createDiscountRuleSchema,
  defaultStackable,
  defaultTriggerMode,
  deriveRuleTags,
  normalizeDiscountType,
  parseDiscountCriteria,
  updateDiscountRuleSchema
} from "@sms/shared";
import { and, eq, gt, sum } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  academicYears,
  discountRules,
  enrollments,
  invoices,
  studentDiscounts,
  students
} from "../db/schema.js";
import type {
  ApproveDiscountDto,
  CreateDiscountRuleDto,
  ListStudentDiscountsQueryDto,
  RejectDiscountDto,
  RequestStudentDiscountDto,
  UpdateDiscountRuleDto
} from "./dto.js";

function enrichRule(rule: typeof discountRules.$inferSelect) {
  const criteria = parseDiscountCriteria(rule.discountType, rule.criteria as Record<string, unknown>);
  const triggerMode = (rule.triggerMode ?? defaultTriggerMode(rule.discountType)) as "auto" | "request";
  return {
    ...rule,
    criteria,
    triggerMode,
    stackable: rule.stackable ?? defaultStackable(rule.discountType),
    tags: deriveRuleTags({
      discountType: rule.discountType,
      triggerMode,
      stackable: rule.stackable ?? defaultStackable(rule.discountType),
      criteria
    })
  };
}

@Injectable()
export class DiscountsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  listDiscountRules(tenantId: string) {
    return this.db
      .select()
      .from(discountRules)
      .where(eq(discountRules.tenantId, tenantId))
      .then((rows) => rows.map(enrichRule));
  }

  async getDiscountMetrics(tenantId: string, academicYearId?: string) {
    let yearId = academicYearId;
    if (!yearId) {
      const [activeYear] = await this.db
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.status, "active")))
        .limit(1);
      yearId = activeYear?.id;
    }

    const rules = await this.db
      .select()
      .from(discountRules)
      .where(eq(discountRules.tenantId, tenantId));

    const activeTypes = rules.filter((rule) => rule.status === "active").length;
    const configuredTotal = rules.length;
    const activePercentageRules = rules.filter(
      (rule) => rule.status === "active" && rule.valueType === "percentage"
    );
    const avgDiscountPercent =
      activePercentageRules.length > 0
        ? Math.round(
            activePercentageRules.reduce((total, rule) => total + Number(rule.value), 0) /
              activePercentageRules.length
          )
        : 0;

    let enrolledStudents = 0;
    let studentsBenefiting = 0;
    let annualDiscountValue = 0;

    if (yearId) {
      const enrolledRows = await this.db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.tenantId, tenantId),
            eq(enrollments.academicYearId, yearId),
            eq(enrollments.status, "approved")
          )
        );
      enrolledStudents = new Set(enrolledRows.map((row) => row.studentId)).size;

      const approvedDiscountRows = await this.db
        .select({ studentId: studentDiscounts.studentId })
        .from(studentDiscounts)
        .where(
          and(eq(studentDiscounts.tenantId, tenantId), eq(studentDiscounts.status, "approved"))
        );

      const invoiceDiscountRows = await this.db
        .select({ studentId: invoices.studentId })
        .from(invoices)
        .innerJoin(enrollments, eq(invoices.enrollmentId, enrollments.id))
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(enrollments.academicYearId, yearId),
            gt(invoices.discountTotal, "0")
          )
        );

      studentsBenefiting = new Set([
        ...approvedDiscountRows.map((row) => row.studentId),
        ...invoiceDiscountRows.map((row) => row.studentId)
      ]).size;

      const [discountSum] = await this.db
        .select({ total: sum(invoices.discountTotal) })
        .from(invoices)
        .innerJoin(enrollments, eq(invoices.enrollmentId, enrollments.id))
        .where(and(eq(invoices.tenantId, tenantId), eq(enrollments.academicYearId, yearId)));

      annualDiscountValue = Number(discountSum?.total ?? 0);
    }

    const enrollmentSharePercent =
      enrolledStudents > 0 ? Math.round((studentsBenefiting / enrolledStudents) * 100) : 0;

    return {
      activeTypes,
      configuredTotal,
      studentsBenefiting,
      enrolledStudents,
      enrollmentSharePercent,
      annualDiscountValue,
      avgDiscountPercent
    };
  }

  async createDiscountRule(tenantId: string, actorUserId: string, dto: CreateDiscountRuleDto) {
    const parsed = createDiscountRuleSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const input = parsed.data;
    const discountType =
      normalizeDiscountType(input.discountType) === "staff_child" && input.discountType === "staff"
        ? "staff"
        : input.discountType;

    const [rule] = await this.db
      .insert(discountRules)
      .values({
        tenantId,
        name: input.name,
        discountType,
        valueType: input.valueType,
        value: String(input.value),
        approvalThreshold: input.approvalThreshold != null ? String(input.approvalThreshold) : null,
        triggerMode: input.triggerMode ?? defaultTriggerMode(discountType),
        stackable: input.stackable ?? defaultStackable(discountType),
        sortOrder: input.sortOrder ?? 0,
        criteria: input.criteria,
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
      after: { name: input.name, discountType }
    });

    return enrichRule(rule!);
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
    const parsed = updateDiscountRuleSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const input = parsed.data;
    const discountType = input.discountType ?? previous.discountType;

    const [rule] = await this.db
      .update(discountRules)
      .set({
        name: input.name ?? previous.name,
        discountType,
        valueType: input.valueType ?? previous.valueType,
        value: input.value != null ? String(input.value) : previous.value,
        approvalThreshold:
          input.approvalThreshold === null
            ? null
            : input.approvalThreshold != null
              ? String(input.approvalThreshold)
              : previous.approvalThreshold,
        triggerMode: input.triggerMode ?? previous.triggerMode ?? defaultTriggerMode(discountType),
        stackable: input.stackable ?? previous.stackable ?? defaultStackable(discountType),
        sortOrder: input.sortOrder ?? previous.sortOrder ?? 0,
        criteria: input.criteria ?? parseDiscountCriteria(discountType, previous.criteria as Record<string, unknown>),
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
      before: { name: previous.name },
      after: { name: rule!.name }
    });

    return enrichRule(rule!);
  }

  async archiveDiscountRule(tenantId: string, ruleId: string, actorUserId: string) {
    const previous = await this.getDiscountRuleOrThrow(tenantId, ruleId);

    const [rule] = await this.db
      .update(discountRules)
      .set({ status: "inactive", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(discountRules.id, ruleId), eq(discountRules.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "discount_rule.deactivate",
      recordType: "DiscountRule",
      recordId: ruleId,
      before: { status: previous.status },
      after: { status: "inactive" }
    });

    return enrichRule(rule!);
  }

  async restoreDiscountRule(tenantId: string, ruleId: string, actorUserId: string) {
    const previous = await this.getDiscountRuleOrThrow(tenantId, ruleId);

    const [rule] = await this.db
      .update(discountRules)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(discountRules.id, ruleId), eq(discountRules.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "discount_rule.restore",
      recordType: "DiscountRule",
      recordId: ruleId,
      before: { status: previous.status },
      after: { status: "active" }
    });

    return enrichRule(rule!);
  }

  /** @deprecated Use {@link restoreDiscountRule}. Kept for the legacy /reactivate route. */
  async reactivateDiscountRule(tenantId: string, ruleId: string, actorUserId: string) {
    return this.restoreDiscountRule(tenantId, ruleId, actorUserId);
  }

  listStudentDiscounts(tenantId: string, query: ListStudentDiscountsQueryDto) {
    const filters = [eq(studentDiscounts.tenantId, tenantId)];
    if (query.studentId) {
      filters.push(eq(studentDiscounts.studentId, query.studentId));
    }
    if (query.status) {
      filters.push(eq(studentDiscounts.status, query.status as typeof studentDiscounts.$inferSelect.status));
    }

    return this.db
      .select({
        id: studentDiscounts.id,
        studentId: studentDiscounts.studentId,
        studentName: students.fullName,
        discountRuleId: studentDiscounts.discountRuleId,
        ruleName: discountRules.name,
        discountType: discountRules.discountType,
        reason: studentDiscounts.reason,
        effectiveFrom: studentDiscounts.effectiveFrom,
        effectiveTo: studentDiscounts.effectiveTo,
        status: studentDiscounts.status
      })
      .from(studentDiscounts)
      .innerJoin(students, eq(studentDiscounts.studentId, students.id))
      .innerJoin(discountRules, eq(studentDiscounts.discountRuleId, discountRules.id))
      .where(and(...filters));
  }

  async requestDiscount(tenantId: string, actorUserId: string, dto: RequestStudentDiscountDto) {
    const rule = await this.getDiscountRuleOrThrow(tenantId, dto.discountRuleId);

    const [discount] = await this.db
      .insert(studentDiscounts)
      .values({
        tenantId,
        studentId: dto.studentId,
        discountRuleId: dto.discountRuleId,
        reason: dto.reason,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
        status: "submitted",
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
      after: { ruleName: rule.name, studentId: dto.studentId }
    });

    return discount;
  }

  async approveDiscount(
    tenantId: string,
    discountId: string,
    actorUserId: string,
    dto: ApproveDiscountDto
  ) {
    const [existing] = await this.db
      .select()
      .from(studentDiscounts)
      .where(and(eq(studentDiscounts.id, discountId), eq(studentDiscounts.tenantId, tenantId)));

    if (!existing) {
      throw new NotFoundException("Student discount not found.");
    }

    const [discount] = await this.db
      .update(studentDiscounts)
      .set({ status: "approved", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(studentDiscounts.id, discountId), eq(studentDiscounts.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "student_discount.approve",
      recordType: "StudentDiscount",
      recordId: discountId,
      reason: dto.notes,
      after: { status: "approved" }
    });

    return discount;
  }

  async rejectDiscount(
    tenantId: string,
    discountId: string,
    actorUserId: string,
    dto: RejectDiscountDto
  ) {
    const [existing] = await this.db
      .select()
      .from(studentDiscounts)
      .where(and(eq(studentDiscounts.id, discountId), eq(studentDiscounts.tenantId, tenantId)));

    if (!existing) {
      throw new NotFoundException("Student discount not found.");
    }

    const [discount] = await this.db
      .update(studentDiscounts)
      .set({ status: "rejected", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(studentDiscounts.id, discountId), eq(studentDiscounts.tenantId, tenantId)))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "student_discount.reject",
      recordType: "StudentDiscount",
      recordId: discountId,
      reason: dto.reason,
      after: { status: "rejected" }
    });

    return discount;
  }
}
