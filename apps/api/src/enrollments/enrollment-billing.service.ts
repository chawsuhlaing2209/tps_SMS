import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  mandatoryEnrollmentFeeTypes,
  type EnrollmentConfirmInput,
  type EnrollmentConfirmResult,
  type EnrollmentPreviewInput,
  type EnrollmentPreviewResult,
  siblingDiscountCriteriaSchema
} from "@sms/shared";
import { and, eq, inArray, isNull, ne, or, gte, lte } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import { previewRecurringBilling } from "./enrollment-billing.logic.js";
import {
  classrooms,
  classroomStudents,
  discountRules,
  enrollmentFeePlans,
  enrollmentFeePlanGrades,
  enrollments,
  feeItems,
  invoiceItems,
  invoices,
  payments,
  enquiries,
  studentDiscounts,
  studentServices,
  students
} from "../db/schema.js";

type PlanRow = {
  planId: string;
  feeItemId: string;
  amount: string;
  feeItemName: string;
  feeType: string;
  billingType: string;
};

const RECURRING_BILLING_TYPES = new Set(["monthly", "term", "annual"]);
const PENDING_DISCOUNT_STATUSES = ["draft", "submitted", "reviewed"] as const;

@Injectable()
export class EnrollmentBillingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  async preview(tenantId: string, input: EnrollmentPreviewInput): Promise<EnrollmentPreviewResult> {
    const [student] = await this.db
      .select({
        id: students.id,
        fullName: students.fullName,
        familyGroupId: students.familyGroupId,
        status: students.status
      })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, input.studentId)));

    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    const plans = await this.loadFeePlans(tenantId, input.academicYearId, input.gradeId);
    if (plans.length === 0) {
      throw new BadRequestException(
        "No enrollment fee plans configured for this academic year and grade."
      );
    }

    const optionalIds = new Set(input.optionalFeeItemIds ?? []);
    const mandatoryTypes = new Set<string>(mandatoryEnrollmentFeeTypes);
    const feeLines: EnrollmentPreviewResult["feeLines"] = [];
    const availableOptionalFees: EnrollmentPreviewResult["availableOptionalFees"] = [];
    const warnings: string[] = [];

    for (const plan of plans) {
      const unitAmount = Number(plan.amount);
      const isMandatory = mandatoryTypes.has(plan.feeType);
      const selected = isMandatory || optionalIds.has(plan.feeItemId);

      if (!isMandatory) {
        if (!availableOptionalFees.some((fee) => fee.feeItemId === plan.feeItemId)) {
          availableOptionalFees.push({
            feeItemId: plan.feeItemId,
            name: plan.feeItemName,
            feeType: plan.feeType,
            billingType: plan.billingType,
            unitAmount,
            selected
          });
        }
      }

      if (!selected) {
        continue;
      }

      if (feeLines.some((line) => line.feeItemId === plan.feeItemId)) {
        continue;
      }

      feeLines.push({
        planId: plan.planId,
        feeItemId: plan.feeItemId,
        feeItemName: plan.feeItemName,
        description: plan.feeItemName,
        unitAmount,
        quantity: 1,
        lineTotal: unitAmount,
        source: isMandatory ? "fee_plan" : "optional",
        feeType: plan.feeType,
        billingType: plan.billingType,
        mandatory: isMandatory
      });
    }

    const unknownOptional = [...optionalIds].filter(
      (id) => !availableOptionalFees.some((fee) => fee.feeItemId === id)
    );
    if (unknownOptional.length > 0) {
      warnings.push("Some selected optional services are not available for this grade.");
    }

    const subtotal = feeLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const siblingSummary = await this.buildSiblingSummary(
      tenantId,
      student.familyGroupId,
      input.studentId,
      input.academicYearId
    );
    const { discounts, discountTotal, discountApprovalRequired } = await this.evaluateDiscounts(
      tenantId,
      student.id,
      feeLines,
      siblingSummary
    );
    const pendingDiscounts = await this.loadPendingDiscounts(tenantId, student.id);

    const confirmBlockers: string[] = [];
    if (pendingDiscounts.length > 0) {
      confirmBlockers.push(
        `${pendingDiscounts.length} discount request(s) awaiting approval — resolve before confirming.`
      );
    }

    return this.buildPreviewResult({
      feeLines,
      availableOptionalFees,
      discounts,
      pendingDiscounts,
      siblingSummary,
      subtotal,
      discountTotal,
      total: Math.max(0, subtotal - discountTotal),
      warnings,
      discountApprovalRequired,
      confirmBlockers,
      canConfirm: confirmBlockers.length === 0
    });
  }

  async previewRecurring(
    tenantId: string,
    input: {
      studentId: string;
      academicYearId: string;
      gradeId: string;
      feeItemIds: string[];
    }
  ): Promise<EnrollmentPreviewResult> {
    const preview = await previewRecurringBilling(this.db, tenantId, input);

    return this.buildPreviewResult({
      feeLines: preview.feeLines,
      availableOptionalFees: [],
      discounts: preview.discounts,
      pendingDiscounts: [],
      siblingSummary: preview.siblingSummary,
      subtotal: preview.subtotal,
      discountTotal: preview.discountTotal,
      total: preview.total,
      warnings: [],
      discountApprovalRequired: preview.discountApprovalRequired,
      confirmBlockers: [],
      canConfirm: true
    });
  }

  private buildPreviewResult(input: {
    feeLines: EnrollmentPreviewResult["feeLines"];
    availableOptionalFees: EnrollmentPreviewResult["availableOptionalFees"];
    discounts: EnrollmentPreviewResult["discounts"];
    pendingDiscounts: EnrollmentPreviewResult["pendingDiscounts"];
    siblingSummary: EnrollmentPreviewResult["siblingSummary"];
    subtotal: number;
    discountTotal: number;
    total: number;
    warnings: string[];
    discountApprovalRequired: boolean;
    confirmBlockers: string[];
    canConfirm: boolean;
  }): EnrollmentPreviewResult {
    return {
      feeLines: input.feeLines,
      availableOptionalFees: input.availableOptionalFees,
      discounts: input.discounts,
      pendingDiscounts: input.pendingDiscounts,
      siblingSummary: input.siblingSummary,
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      total: input.total,
      warnings: input.warnings,
      discountApprovalRequired: input.discountApprovalRequired,
      confirmBlockers: input.confirmBlockers,
      canConfirm: input.canConfirm
    };
  }

  async confirm(
    tenantId: string,
    enrollmentId: string,
    actorUserId: string,
    dto: EnrollmentConfirmInput,
    actorPermissions: string[]
  ): Promise<EnrollmentConfirmResult> {
    let [enrollment] = await this.db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)));

    if (!enrollment) {
      throw new NotFoundException("Enrollment not found.");
    }

    if (enrollment.invoiceId || enrollment.confirmedAt) {
      throw new ConflictException("Enrollment is already confirmed.");
    }

    if (!enrollment.classroomId) {
      throw new BadRequestException("Enrollment has no classroom — cannot confirm.");
    }

    const classroomId = enrollment.classroomId;
    const placement = await this.getClassroomPlacement(tenantId, classroomId);

    if (
      enrollment.academicYearId !== placement.academicYearId ||
      enrollment.gradeId !== placement.gradeId
    ) {
      await this.db
        .update(enrollments)
        .set({
          academicYearId: placement.academicYearId,
          gradeId: placement.gradeId,
          updatedAt: new Date()
        })
        .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)));
      enrollment = {
        ...enrollment,
        academicYearId: placement.academicYearId,
        gradeId: placement.gradeId
      };
    }

    const optionalFeeItemIds =
      dto.optionalFeeItemIds ??
      enrollment.billingSnapshot?.optionalFeeItemIds ??
      [];

    const preview = await this.preview(tenantId, {
      studentId: enrollment.studentId,
      academicYearId: placement.academicYearId,
      gradeId: placement.gradeId,
      classroomId,
      optionalFeeItemIds
    });

    if (!preview.canConfirm) {
      throw new BadRequestException(preview.confirmBlockers.join(" "));
    }

    if (preview.discountApprovalRequired && !actorPermissions.includes("discount.approve")) {
      throw new ForbiddenException(
        "Discount approval permission is required to confirm this enrollment."
      );
    }

    if (dto.collectPayment && !actorPermissions.includes("finance.manage")) {
      throw new ForbiddenException("Finance permission is required to record payment at enrollment.");
    }

    const paymentAmount = dto.paymentAmount ?? preview.total;
    if (dto.collectPayment) {
      if (!dto.paymentMethod) {
        throw new BadRequestException("Payment method is required when collecting payment.");
      }
      if (paymentAmount <= 0 || paymentAmount > preview.total) {
        throw new BadRequestException("Payment amount must be between 0 and the invoice total.");
      }
    }

    const [student] = await this.db
      .select({ familyGroupId: students.familyGroupId })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, enrollment.studentId)));

    const today = new Date().toISOString().slice(0, 10);
    const invoiceNumber = `INV-${Date.now()}`;

    const result = await this.db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          tenantId,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          familyGroupId: student?.familyGroupId ?? null,
          invoiceNumber,
          issueDate: today,
          dueDate: dto.dueDate ?? today,
          subtotal: String(preview.subtotal),
          discountTotal: String(preview.discountTotal),
          total: String(preview.total),
          status: "unpaid",
          source: "enrollment",
          createdBy: actorUserId,
          updatedBy: actorUserId
        })
        .returning();

      await tx.insert(invoiceItems).values(
        preview.feeLines.map((line) => ({
          tenantId,
          invoiceId: invoice!.id,
          feeItemId: line.feeItemId,
          description: line.description,
          quantity: String(line.quantity),
          unitAmount: String(line.unitAmount),
          total: String(line.lineTotal),
          createdBy: actorUserId,
          updatedBy: actorUserId
        }))
      );

      const recurringLines = preview.feeLines.filter((line) =>
        RECURRING_BILLING_TYPES.has(line.billingType)
      );

      if (recurringLines.length > 0) {
        await tx.insert(studentServices).values(
          recurringLines.map((line) => ({
            tenantId,
            studentId: enrollment.studentId,
            feeItemId: line.feeItemId,
            effectiveFrom: today,
            createdBy: actorUserId,
            updatedBy: actorUserId
          }))
        );
      }

      await this.syncClassroomPlacementTx(tx, tenantId, enrollment, actorUserId, today);

      if (enrollment.enquiryId) {
        await tx
          .update(enquiries)
          .set({ status: "enrolled", updatedBy: actorUserId, updatedAt: new Date() })
          .where(
            and(eq(enquiries.tenantId, tenantId), eq(enquiries.id, enrollment.enquiryId))
          );
      }

      const [updatedEnrollment] = await tx
        .update(enrollments)
        .set({
          status: "approved",
          invoiceId: invoice!.id,
          confirmedAt: new Date(),
          billingSnapshot: {
            optionalFeeItemIds,
            lastPreviewAt: new Date().toISOString(),
            preview
          },
          updatedBy: actorUserId,
          updatedAt: new Date()
        })
        .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)))
        .returning();

      let paymentId: string | undefined;

      if (dto.collectPayment && dto.paymentMethod) {
        const isCash = dto.paymentMethod === "cash";
        const [payment] = await tx
          .insert(payments)
          .values({
            tenantId,
            invoiceId: invoice!.id,
            kind: "payment",
            amount: String(paymentAmount),
            method: dto.paymentMethod,
            referenceNumber: dto.paymentReference,
            notes: dto.paymentNotes,
            paidAt: new Date(),
            verifiedAt: isCash ? new Date() : null,
            verifiedByUserId: isCash ? actorUserId : null,
            createdBy: actorUserId,
            updatedBy: actorUserId
          })
          .returning();

        paymentId = payment!.id;

        if (isCash) {
          const paid = paymentAmount;
          const newStatus =
            paid >= preview.total ? "paid" : paid > 0 ? "partial" : "unpaid";
          await tx
            .update(invoices)
            .set({ status: newStatus, updatedBy: actorUserId })
            .where(eq(invoices.id, invoice!.id));
        }
      }

      return { invoice: invoice!, enrollment: updatedEnrollment!, paymentId };
    });

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "enrollment.confirm",
      recordType: "Enrollment",
      recordId: enrollmentId,
      after: {
        invoiceId: result.invoice.id,
        total: preview.total,
        collectPayment: dto.collectPayment ?? false
      }
    });

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: "invoice.create",
        recordType: "invoice",
        recordId: result.invoice.id,
        after: { enrollmentId, source: "enrollment_confirm" }
      })
    );

    if (result.paymentId) {
      await this.auditService.recordEvent(
        this.auditService.createEvent({
          tenantId,
          actorUserId,
          action: "payment.record",
          recordType: "payment",
          recordId: result.paymentId,
          after: { enrollmentId, invoiceId: result.invoice.id }
        })
      );
    }

    return {
      enrollmentId,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      paymentId: result.paymentId,
      preview
    };
  }

  async assertClassroomPlacement(
    tenantId: string,
    classroomId: string,
    academicYearId: string,
    gradeId: string
  ) {
    const placement = await this.getClassroomPlacement(tenantId, classroomId);
    if (
      placement.academicYearId !== academicYearId ||
      placement.gradeId !== gradeId
    ) {
      throw new BadRequestException(
        "Enrollment placement does not match the selected classroom's academic year and grade."
      );
    }
  }

  private async getClassroomPlacement(tenantId: string, classroomId: string) {
    const [classroom] = await this.db
      .select({
        academicYearId: classrooms.academicYearId,
        gradeId: classrooms.gradeId,
        status: classrooms.status
      })
      .from(classrooms)
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)));

    if (!classroom) {
      throw new NotFoundException("Classroom not found.");
    }

    if (classroom.status !== "active") {
      throw new BadRequestException("Classroom is not active.");
    }

    return classroom;
  }

  private async loadFeePlans(
    tenantId: string,
    academicYearId: string,
    gradeId: string
  ): Promise<PlanRow[]> {
    const rows = await this.db
      .select({
        planId: enrollmentFeePlans.id,
        feeItemId: enrollmentFeePlans.feeItemId,
        amount: enrollmentFeePlans.amount,
        feeItemName: feeItems.name,
        feeType: feeItems.feeType,
        billingType: feeItems.billingType
      })
      .from(enrollmentFeePlans)
      .innerJoin(
        enrollmentFeePlanGrades,
        eq(enrollmentFeePlanGrades.planId, enrollmentFeePlans.id)
      )
      .innerJoin(feeItems, eq(enrollmentFeePlans.feeItemId, feeItems.id))
      .where(
        and(
          eq(enrollmentFeePlans.tenantId, tenantId),
          eq(enrollmentFeePlans.academicYearId, academicYearId),
          eq(enrollmentFeePlanGrades.gradeId, gradeId),
          eq(feeItems.status, "active")
        )
      );

    const byFeeItem = new Map<string, PlanRow>();
    for (const row of rows) {
      const existing = byFeeItem.get(row.feeItemId);
      if (!existing || Number(row.amount) >= Number(existing.amount)) {
        byFeeItem.set(row.feeItemId, row);
      }
    }

    return [...byFeeItem.values()];
  }

  private async loadPendingDiscounts(tenantId: string, studentId: string) {
    return this.db
      .select({
        id: studentDiscounts.id,
        ruleName: discountRules.name,
        status: studentDiscounts.status,
        reason: studentDiscounts.reason
      })
      .from(studentDiscounts)
      .innerJoin(discountRules, eq(studentDiscounts.discountRuleId, discountRules.id))
      .where(
        and(
          eq(studentDiscounts.tenantId, tenantId),
          eq(studentDiscounts.studentId, studentId),
          inArray(studentDiscounts.status, [...PENDING_DISCOUNT_STATUSES])
        )
      );
  }

  private async buildSiblingSummary(
    tenantId: string,
    familyGroupId: string | null,
    studentId: string,
    academicYearId: string
  ): Promise<EnrollmentPreviewResult["siblingSummary"]> {
    if (!familyGroupId) {
      return {
        eligible: false,
        enrolledSiblingCount: 0,
        message: "No family group linked — sibling discount not evaluated."
      };
    }

    const siblingRows = await this.db
      .select({ id: students.id })
      .from(students)
      .innerJoin(
        enrollments,
        and(
          eq(enrollments.studentId, students.id),
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.academicYearId, academicYearId),
          eq(enrollments.status, "approved")
        )
      )
      .where(
        and(
          eq(students.tenantId, tenantId),
          eq(students.familyGroupId, familyGroupId),
          ne(students.id, studentId),
          eq(students.status, "enrolled")
        )
      );

    const count = siblingRows.length;
    const eligible = count >= 1;

    return {
      eligible,
      enrolledSiblingCount: count,
      message: eligible
        ? `${count} enrolled sibling(s) in this family for the selected year.`
        : "No enrolled siblings in this family for the selected year."
    };
  }

  private async evaluateDiscounts(
    tenantId: string,
    studentId: string,
    feeLines: EnrollmentPreviewResult["feeLines"],
    siblingSummary: EnrollmentPreviewResult["siblingSummary"]
  ): Promise<{
    discounts: EnrollmentPreviewResult["discounts"];
    discountTotal: number;
    discountApprovalRequired: boolean;
  }> {
    const today = new Date().toISOString().slice(0, 10);
    const discounts: EnrollmentPreviewResult["discounts"] = [];
    let discountTotal = 0;
    let discountApprovalRequired = false;

    const approvedStudentDiscounts = await this.db
      .select({
        id: studentDiscounts.id,
        ruleName: discountRules.name,
        discountType: discountRules.discountType,
        valueType: discountRules.valueType,
        value: discountRules.value,
        approvalThreshold: discountRules.approvalThreshold,
        criteria: discountRules.criteria
      })
      .from(studentDiscounts)
      .innerJoin(discountRules, eq(studentDiscounts.discountRuleId, discountRules.id))
      .where(
        and(
          eq(studentDiscounts.tenantId, tenantId),
          eq(studentDiscounts.studentId, studentId),
          eq(studentDiscounts.status, "approved"),
          eq(discountRules.status, "active"),
          lte(studentDiscounts.effectiveFrom, today),
          or(isNull(studentDiscounts.effectiveTo), gte(studentDiscounts.effectiveTo, today))
        )
      );

    for (const row of approvedStudentDiscounts) {
      const amount = this.computeDiscountAmount(
        feeLines,
        row.valueType,
        Number(row.value),
        row.discountType,
        row.criteria
      );
      if (amount <= 0) continue;

      const requiresApproval = this.exceedsThreshold(amount, row.approvalThreshold);
      if (requiresApproval) discountApprovalRequired = true;

      discounts.push({
        id: row.id,
        name: row.ruleName,
        discountType: row.discountType,
        amount,
        source: "student_discount",
        status: "approved",
        requiresApproval
      });
      discountTotal += amount;
    }

    if (siblingSummary.eligible) {
      const siblingRules = await this.db
        .select()
        .from(discountRules)
        .where(
          and(
            eq(discountRules.tenantId, tenantId),
            eq(discountRules.discountType, "sibling"),
            eq(discountRules.status, "active")
          )
        );

      for (const rule of siblingRules) {
        if (discounts.some((d) => d.source === "rule" && d.discountType === "sibling")) {
          continue;
        }

        const parsed = siblingDiscountCriteriaSchema.safeParse(rule.criteria);
        const criteria = parsed.success ? parsed.data : { type: "sibling" as const };
        const minSiblings = criteria.minEnrolledSiblings ?? 1;
        if (siblingSummary.enrolledSiblingCount < minSiblings) {
          continue;
        }

        const amount = this.computeDiscountAmount(
          feeLines,
          rule.valueType,
          Number(rule.value),
          rule.discountType,
          rule.criteria
        );
        if (amount <= 0) continue;

        const requiresApproval = this.exceedsThreshold(amount, rule.approvalThreshold);
        if (requiresApproval) discountApprovalRequired = true;

        discounts.push({
          id: rule.id,
          name: rule.name,
          discountType: rule.discountType,
          amount,
          source: "rule",
          requiresApproval
        });
        discountTotal += amount;
      }
    }

    return { discounts, discountTotal, discountApprovalRequired };
  }

  private exceedsThreshold(amount: number, threshold: string | null): boolean {
    if (threshold == null) return false;
    return amount > Number(threshold);
  }

  private computeDiscountAmount(
    feeLines: EnrollmentPreviewResult["feeLines"],
    valueType: string,
    value: number,
    discountType: string,
    criteria: Record<string, unknown> | null
  ): number {
    const parsed = siblingDiscountCriteriaSchema.safeParse(criteria);
    const appliesToFeeTypes =
      parsed.success && parsed.data.appliesToFeeTypes?.length
        ? parsed.data.appliesToFeeTypes
        : discountType === "sibling"
          ? [...mandatoryEnrollmentFeeTypes]
          : null;

    const eligibleLines =
      appliesToFeeTypes != null
        ? feeLines.filter((line) => appliesToFeeTypes.includes(line.feeType))
        : feeLines;

    const base = eligibleLines.reduce((sum, line) => sum + line.lineTotal, 0);
    if (base <= 0) return 0;

    if (valueType === "percentage") {
      return Math.round((base * value) / 100);
    }

    return Math.min(value, base);
  }

  private async syncClassroomPlacementTx(
    tx: Pick<Database, "select" | "insert" | "update">,
    tenantId: string,
    enrollment: typeof enrollments.$inferSelect,
    actorUserId: string,
    today: string
  ) {
    if (!enrollment.classroomId) return;

    const activePlacements = await tx
      .select()
      .from(classroomStudents)
      .where(
        and(
          eq(classroomStudents.tenantId, tenantId),
          eq(classroomStudents.studentId, enrollment.studentId),
          isNull(classroomStudents.effectiveTo)
        )
      );

    for (const placement of activePlacements) {
      if (placement.classroomId === enrollment.classroomId) continue;
      await tx
        .update(classroomStudents)
        .set({ effectiveTo: today, updatedBy: actorUserId, updatedAt: new Date() })
        .where(eq(classroomStudents.id, placement.id));
    }

    const alreadyInClassroom = activePlacements.some(
      (p) => p.classroomId === enrollment.classroomId
    );

    if (!alreadyInClassroom) {
      await tx.insert(classroomStudents).values({
        tenantId,
        classroomId: enrollment.classroomId,
        studentId: enrollment.studentId,
        effectiveFrom: today,
        movementReason: "enrollment_confirmed",
        createdBy: actorUserId,
        updatedBy: actorUserId
      });
    }

    await tx
      .update(students)
      .set({ status: "enrolled", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, enrollment.studentId)));
  }
}
