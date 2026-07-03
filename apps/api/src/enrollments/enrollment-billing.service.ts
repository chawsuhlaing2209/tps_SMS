import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  buildInvoiceNumber,
  mandatoryEnrollmentFeeTypes,
  type EnrollmentConfirmInput,
  type EnrollmentConfirmResult,
  type EnrollmentPreviewInput,
  type EnrollmentPreviewResult
} from "@sms/shared";
import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  evaluateDiscountsFromDb,
  persistInvoiceDiscountLines,
  siblingSummaryMessage
} from "../discounts/discount-evaluation.logic.js";
import { previewRecurringBilling } from "./enrollment-billing.logic.js";
import {
  classrooms,
  classroomStudents,
  discountRules,
  enrollmentFeePlans,
  enrollmentFeePlanGrades,
  enrollments,
  feeItems,
  guardians,
  invoiceItems,
  invoices,
  payments,
  enquiries,
  staff,
  studentDiscounts,
  studentGuardians,
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
    const { discounts, discountTotal, discountApprovalRequired, discountOptions } =
      await this.evaluateDiscounts(
        tenantId,
        student.id,
        input.academicYearId,
        input.gradeId,
        feeLines,
        siblingSummary,
        {
          billingContext: "enrollment",
          collectPayment: input.collectPayment,
          paymentMethod: input.paymentMethod,
          excludedDiscountRuleIds: input.excludedDiscountRuleIds,
          forcedDiscountRuleIds: input.forcedDiscountRuleIds
        }
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
      discountOptions,
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
    discountOptions?: EnrollmentPreviewResult["discountOptions"];
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
      discountOptions: input.discountOptions ?? [],
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

    if (enrollment.invoiceId) {
      throw new ConflictException("Enrollment is already confirmed.");
    }

    // Classroom is optional — a student can be enrolled into a grade before a
    // room has been planned. When a classroom is set, its placement is the
    // source of truth for academic year / grade; otherwise the enrollment's own
    // grade + year (chosen at create) are used and room placement is deferred.
    const placement = enrollment.classroomId
      ? await this.getClassroomPlacement(tenantId, enrollment.classroomId)
      : null;

    if (
      placement &&
      (enrollment.academicYearId !== placement.academicYearId ||
        enrollment.gradeId !== placement.gradeId)
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
      academicYearId: enrollment.academicYearId,
      gradeId: enrollment.gradeId,
      classroomId: enrollment.classroomId ?? undefined,
      optionalFeeItemIds,
      collectPayment: dto.collectPayment,
      paymentMethod: dto.paymentMethod,
      excludedDiscountRuleIds: dto.excludedDiscountRuleIds,
      forcedDiscountRuleIds: dto.forcedDiscountRuleIds
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
    const invoiceNumber = buildInvoiceNumber(new Date(today));

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

      await persistInvoiceDiscountLines(
        tx,
        tenantId,
        invoice!.id,
        preview.discounts.map((discount) => ({
          id: discount.id,
          ruleId: discount.ruleId ?? discount.id,
          name: discount.name,
          discountType: discount.discountType,
          amount: discount.amount,
          source: discount.source,
          stackable: discount.stackable ?? false,
          requiresApproval: discount.requiresApproval ?? false,
          status: discount.status,
          eligibilityReason: discount.eligibilityReason
        })),
        actorUserId
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
        studentPosition: 1,
        message: siblingSummaryMessage(
          { eligible: false, enrolledSiblingCount: 0, studentPosition: 1 },
          false
        )
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
    const summary = {
      eligible: count >= 1,
      enrolledSiblingCount: count,
      studentPosition: count + 1
    };

    return {
      ...summary,
      message: siblingSummaryMessage(summary, true)
    };
  }

  private async evaluateDiscounts(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    gradeId: string,
    feeLines: EnrollmentPreviewResult["feeLines"],
    siblingSummary: EnrollmentPreviewResult["siblingSummary"],
    options?: {
      billingContext?: "enrollment" | "recurring";
      collectPayment?: boolean;
      paymentMethod?: string;
      excludedDiscountRuleIds?: string[];
      forcedDiscountRuleIds?: string[];
    }
  ): Promise<{
    discounts: EnrollmentPreviewResult["discounts"];
    discountTotal: number;
    discountApprovalRequired: boolean;
    discountOptions: EnrollmentPreviewResult["discountOptions"];
  }> {
    const parentIsFullTimeStaff = await this.hasActiveStaffGuardian(tenantId, studentId);

    const result = await evaluateDiscountsFromDb(this.db, {
      tenantId,
      studentId,
      context: {
        billingContext: options?.billingContext ?? "enrollment",
        academicYearId,
        gradeId,
        feeLines,
        siblingSummary: {
          eligible: siblingSummary.eligible,
          enrolledSiblingCount: siblingSummary.enrolledSiblingCount,
          studentPosition: siblingSummary.studentPosition ?? siblingSummary.enrolledSiblingCount + 1
        },
        collectPayment: options?.collectPayment,
        paymentMethod: options?.paymentMethod,
        parentIsFullTimeStaff
      },
      excludedDiscountRuleIds: options?.excludedDiscountRuleIds,
      forcedDiscountRuleIds: options?.forcedDiscountRuleIds
    });

    return {
      discounts: result.discounts.map((discount) => ({
        id: discount.id,
        ruleId: discount.ruleId,
        name: discount.name,
        discountType: discount.discountType,
        amount: discount.amount,
        source: discount.source,
        stackable: discount.stackable,
        eligibilityReason: discount.eligibilityReason,
        status: discount.status,
        requiresApproval: discount.requiresApproval
      })),
      discountTotal: result.discountTotal,
      discountApprovalRequired: result.discountApprovalRequired,
      discountOptions: result.discountOptions
    };
  }

  /**
   * A guardian linked to an active staff record marks the student as a
   * staff child — powers the parentIsFullTimeStaff discount criterion.
   */
  private async hasActiveStaffGuardian(tenantId: string, studentId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: guardians.id })
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .innerJoin(staff, eq(guardians.staffId, staff.id))
      .where(
        and(
          eq(studentGuardians.tenantId, tenantId),
          eq(studentGuardians.studentId, studentId),
          eq(staff.tenantId, tenantId),
          eq(staff.status, "active")
        )
      )
      .limit(1);
    return Boolean(row);
  }

  /**
   * Assigns (or moves) an enrollment to a classroom after the fact — the
   * ceremony allows enrolling without picking a room, and confirmed
   * enrollments are otherwise immutable. Validates the classroom matches the
   * enrollment's year and grade; approved enrollments get their classroom
   * placement synced immediately.
   */
  async assignClassroom(
    tenantId: string,
    enrollmentId: string,
    classroomId: string,
    actorUserId: string
  ) {
    const [enrollment] = await this.db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)));

    if (!enrollment) {
      throw new NotFoundException("Enrollment not found.");
    }
    if (enrollment.cancelledAt) {
      throw new BadRequestException("Cancelled enrollments cannot be assigned to a classroom.");
    }
    if (enrollment.classroomId === classroomId) {
      return enrollment;
    }

    await this.assertClassroomPlacement(
      tenantId,
      classroomId,
      enrollment.academicYearId,
      enrollment.gradeId
    );

    const today = new Date().toISOString().slice(0, 10);

    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(enrollments)
        .set({ classroomId, updatedBy: actorUserId, updatedAt: new Date() })
        .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, enrollmentId)))
        .returning();

      if (row!.status === "approved") {
        await this.syncClassroomPlacementTx(tx, tenantId, row!, actorUserId, today, "classroom_assigned");
      }

      return row!;
    });

    await this.auditService.recordEvent({
      tenantId,
      actorUserId,
      action: "enrollment.assign_classroom",
      recordType: "enrollment",
      recordId: enrollmentId,
      before: { classroomId: enrollment.classroomId },
      after: { classroomId }
    });

    return updated;
  }

  private async syncClassroomPlacementTx(
    tx: Pick<Database, "select" | "insert" | "update">,
    tenantId: string,
    enrollment: typeof enrollments.$inferSelect,
    actorUserId: string,
    today: string,
    movementReason = "enrollment_confirmed"
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
        movementReason,
        createdBy: actorUserId,
        updatedBy: actorUserId
      });
    }

    await tx
      .update(students)
      .set({ status: "enrolled", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(students.tenantId, tenantId), eq(students.id, enrollment.studentId)));
  }

  async listAvailableOptionalServices(tenantId: string, studentId: string) {
    const enrollment = await this.resolveApprovedEnrollment(tenantId, studentId);
    const plans = await this.loadFeePlans(
      tenantId,
      enrollment.academicYearId,
      enrollment.gradeId
    );
    const mandatoryTypes = new Set<string>(mandatoryEnrollmentFeeTypes);
    const activeFeeItemIds = await this.loadActiveServiceFeeItemIds(tenantId, studentId);

    return plans
      .filter((plan) => !mandatoryTypes.has(plan.feeType))
      .filter((plan) => !activeFeeItemIds.has(plan.feeItemId))
      .map((plan) => ({
        feeItemId: plan.feeItemId,
        name: plan.feeItemName,
        feeType: plan.feeType,
        billingType: plan.billingType,
        unitAmount: Number(plan.amount),
        isRecurring: RECURRING_BILLING_TYPES.has(plan.billingType)
      }));
  }

  async previewAddStudentService(
    tenantId: string,
    input: { studentId: string; feeItemIds: string[]; effectiveFrom: string }
  ) {
    const enrollment = await this.resolveApprovedEnrollment(tenantId, input.studentId);

    const feeLines: EnrollmentPreviewResult["feeLines"] = [];
    for (const feeItemId of input.feeItemIds) {
      const plan = await this.resolveOptionalServicePlan(
        tenantId,
        enrollment,
        feeItemId,
        input.studentId
      );
      feeLines.push(this.buildOptionalServiceFeeLine(plan));
    }

    const anyRecurring = feeLines.some((line) => RECURRING_BILLING_TYPES.has(line.billingType));
    const subtotal = feeLines.reduce((sum, line) => sum + line.lineTotal, 0);

    const [studentRow] = await this.db
      .select({ familyGroupId: students.familyGroupId })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, input.studentId)));
    const siblingSummary = await this.buildSiblingSummary(
      tenantId,
      studentRow?.familyGroupId ?? null,
      input.studentId,
      enrollment.academicYearId
    );

    const { discounts, discountTotal, discountApprovalRequired } = feeLines.length
      ? await this.evaluateDiscounts(
          tenantId,
          input.studentId,
          enrollment.academicYearId,
          enrollment.gradeId,
          feeLines,
          siblingSummary,
          { billingContext: anyRecurring ? "recurring" : "enrollment" }
        )
      : { discounts: [], discountTotal: 0, discountApprovalRequired: false };

    return {
      studentId: input.studentId,
      enrollmentId: enrollment.id,
      effectiveFrom: input.effectiveFrom,
      isRecurring: anyRecurring,
      feeLines,
      subtotal,
      discountTotal,
      total: Math.max(0, subtotal - discountTotal),
      discounts,
      discountApprovalRequired,
      createsInvoice: feeLines.length > 0
    };
  }

  async confirmAddStudentService(
    tenantId: string,
    actorUserId: string,
    input: {
      studentId: string;
      feeItemIds: string[];
      startDate: string;
      dueDate?: string;
      collectPayment?: boolean;
      paymentMethod?: string;
      paymentAmount?: number;
      paymentReference?: string;
      paymentNotes?: string;
    },
    actorPermissions: string[] = []
  ) {
    if (!input.feeItemIds.length) {
      throw new BadRequestException("Select at least one service to add.");
    }

    const preview = await this.previewAddStudentService(tenantId, {
      studentId: input.studentId,
      feeItemIds: input.feeItemIds,
      effectiveFrom: input.startDate
    });

    if (preview.discountApprovalRequired) {
      throw new ForbiddenException(
        "Discount approval is required before adding this service. Resolve pending discounts first."
      );
    }

    if (input.collectPayment && !actorPermissions.includes("finance.manage")) {
      throw new ForbiddenException("Finance permission is required to collect payment.");
    }

    const paymentAmount = input.paymentAmount ?? preview.total;
    if (input.collectPayment) {
      if (!input.paymentMethod) {
        throw new BadRequestException("Payment method is required when collecting payment.");
      }
      if (paymentAmount <= 0 || paymentAmount > preview.total) {
        throw new BadRequestException("Payment amount must be between 0 and the invoice total.");
      }
      if (input.paymentMethod !== "cash" && !input.paymentReference?.trim()) {
        throw new BadRequestException("Transaction ID is required for non-cash payments.");
      }
    }

    const enrollment = await this.resolveApprovedEnrollment(tenantId, input.studentId);
    const [student] = await this.db
      .select({ familyGroupId: students.familyGroupId })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.id, input.studentId)));

    const today = new Date().toISOString().slice(0, 10);
    const invoiceNumber = buildInvoiceNumber(new Date(today));
    const isCash = input.paymentMethod === "cash";
    const recurringLines = preview.feeLines.filter((line) =>
      RECURRING_BILLING_TYPES.has(line.billingType)
    );

    const result = await this.db.transaction(async (tx) => {
      // One invoice carries every selected optional service. Recurring services
      // are also registered so they continue billing on future monthly runs
      // ("first period billed today, then continues monthly").
      const [invoice] = await tx
        .insert(invoices)
        .values({
          tenantId,
          studentId: input.studentId,
          enrollmentId: enrollment.id,
          familyGroupId: student?.familyGroupId ?? null,
          invoiceNumber,
          issueDate: today,
          dueDate: input.dueDate ?? input.startDate,
          subtotal: String(preview.subtotal),
          discountTotal: String(preview.discountTotal),
          total: String(preview.total),
          status: "unpaid",
          source: preview.isRecurring ? "recurring" : "ad_hoc",
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

      await persistInvoiceDiscountLines(
        tx,
        tenantId,
        invoice!.id,
        preview.discounts.map((discount) => ({
          id: discount.id,
          ruleId: discount.ruleId ?? discount.id,
          name: discount.name,
          discountType: discount.discountType,
          amount: discount.amount,
          source: discount.source,
          stackable: discount.stackable ?? false,
          requiresApproval: discount.requiresApproval ?? false,
          status: discount.status,
          eligibilityReason: discount.eligibilityReason
        })),
        actorUserId
      );

      const studentServiceRows = recurringLines.length
        ? await tx
            .insert(studentServices)
            .values(
              recurringLines.map((line) => ({
                tenantId,
                studentId: input.studentId,
                feeItemId: line.feeItemId,
                effectiveFrom: input.startDate,
                createdBy: actorUserId,
                updatedBy: actorUserId
              }))
            )
            .returning()
        : [];

      let paymentId: string | undefined;
      if (input.collectPayment && input.paymentMethod) {
        const [payment] = await tx
          .insert(payments)
          .values({
            tenantId,
            invoiceId: invoice!.id,
            kind: "payment",
            amount: String(paymentAmount),
            method: input.paymentMethod as any,
            referenceNumber: input.paymentReference?.trim() || null,
            notes: input.paymentNotes,
            paidAt: new Date(),
            verifiedAt: isCash ? new Date() : null,
            verifiedByUserId: isCash ? actorUserId : null,
            createdBy: actorUserId,
            updatedBy: actorUserId
          })
          .returning();
        paymentId = payment!.id;
        if (isCash) {
          const newStatus =
            paymentAmount >= preview.total ? "paid" : paymentAmount > 0 ? "partial" : "unpaid";
          await tx
            .update(invoices)
            .set({ status: newStatus, updatedBy: actorUserId })
            .where(eq(invoices.id, invoice!.id));
        }
      }

      await this.auditService.recordEvent({
        tenantId,
        actorUserId: actorUserId ?? null,
        action: "invoice.create",
        recordType: "invoice",
        recordId: invoice!.id,
        after: {
          ...(invoice as Record<string, unknown>),
          source: preview.isRecurring ? "recurring" : "ad_hoc",
          studentServiceAdd: true
        }
      });
      for (const row of studentServiceRows) {
        await this.auditService.recordEvent({
          tenantId,
          actorUserId: actorUserId ?? null,
          action: "student_service.create",
          recordType: "StudentService",
          recordId: row.id,
          after: row as Record<string, unknown>
        });
      }
      if (paymentId) {
        await this.auditService.recordEvent(
          this.auditService.createEvent({
            tenantId,
            actorUserId,
            action: "payment.record",
            recordType: "payment",
            recordId: paymentId,
            after: { invoiceId: invoice!.id, studentServiceAdd: true }
          })
        );
      }

      return { invoice: invoice!, studentServices: studentServiceRows, paymentId };
    });

    return {
      kind: preview.isRecurring ? ("recurring" as const) : ("one_time" as const),
      studentServices: result.studentServices,
      invoice: result.invoice,
      paymentId: result.paymentId
    };
  }

  private async resolveApprovedEnrollment(tenantId: string, studentId: string) {
    const [enrollment] = await this.db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, "approved")
        )
      )
      .orderBy(desc(enrollments.confirmedAt))
      .limit(1);

    if (!enrollment?.confirmedAt) {
      throw new BadRequestException(
        "Student must have a confirmed enrollment before adding optional services."
      );
    }

    return enrollment;
  }

  private async loadActiveServiceFeeItemIds(tenantId: string, studentId: string) {
    const rows = await this.db
      .select({ feeItemId: studentServices.feeItemId })
      .from(studentServices)
      .where(
        and(
          eq(studentServices.tenantId, tenantId),
          eq(studentServices.studentId, studentId),
          isNull(studentServices.effectiveTo)
        )
      );

    return new Set(rows.map((row) => row.feeItemId));
  }

  private async resolveOptionalServicePlan(
    tenantId: string,
    enrollment: typeof enrollments.$inferSelect,
    feeItemId: string,
    studentId: string
  ): Promise<PlanRow> {
    const plans = await this.loadFeePlans(
      tenantId,
      enrollment.academicYearId,
      enrollment.gradeId
    );
    const mandatoryTypes = new Set<string>(mandatoryEnrollmentFeeTypes);
    const plan = plans.find((row) => row.feeItemId === feeItemId);

    if (!plan || mandatoryTypes.has(plan.feeType)) {
      throw new BadRequestException("Selected service is not available for this student's grade.");
    }

    const activeFeeItemIds = await this.loadActiveServiceFeeItemIds(tenantId, studentId);
    if (activeFeeItemIds.has(feeItemId)) {
      throw new ConflictException("Student already has this service active.");
    }

    return plan;
  }

  private buildOptionalServiceFeeLine(plan: PlanRow): EnrollmentPreviewResult["feeLines"][number] {
    const unitAmount = Number(plan.amount);
    return {
      planId: plan.planId,
      feeItemId: plan.feeItemId,
      feeItemName: plan.feeItemName,
      description: plan.feeItemName,
      unitAmount,
      quantity: 1,
      lineTotal: unitAmount,
      source: "optional",
      feeType: plan.feeType,
      billingType: plan.billingType,
      mandatory: false
    };
  }

  /**
   * Cancel (withdraw) an enrollment. Cash-basis treatment:
   * - Refund up to the net cash already paid (full / partial / none). The refund
   *   is cash out; the non-refunded paid amount is forfeited and stays as
   *   revenue automatically (net cash retained).
   * - Void the unpaid remainder by closing the enrollment's invoices
   *   (status = cancelled → recordable becomes 0).
   * - Stop future recurring services so no further invoices are generated.
   */
  async cancelEnrollment(
    tenantId: string,
    enrollmentId: string,
    actorUserId: string,
    dto: {
      refundMode: "full" | "partial" | "none";
      refundAmount?: number;
      method?: string;
      referenceNumber?: string;
      reason: string;
    }
  ) {
    const reason = dto.reason.trim();
    const result = await this.db.transaction(async (tx) => {
      const [enr] = await tx
        .select()
        .from(enrollments)
        .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.tenantId, tenantId)));
      if (!enr) throw new NotFoundException("Enrollment not found");
      if (enr.cancelledAt) throw new BadRequestException("This enrollment is already cancelled.");

      const invoiceRows = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.enrollmentId, enrollmentId)));
      const invoiceIds = invoiceRows.map((r) => r.id);

      // Net refundable cash across the enrollment's invoices, per verified payment.
      let netCash = 0;
      const refundable: Array<{ id: string; invoiceId: string; method: string; left: number }> = [];
      if (invoiceIds.length) {
        const payRows = await tx
          .select({
            id: payments.id,
            invoiceId: payments.invoiceId,
            kind: payments.kind,
            amount: payments.amount,
            method: payments.method,
            refundedPaymentId: payments.refundedPaymentId,
            verifiedAt: payments.verifiedAt
          })
          .from(payments)
          .where(and(eq(payments.tenantId, tenantId), inArray(payments.invoiceId, invoiceIds)));

        const refundedByPayment = new Map<string, number>();
        for (const p of payRows) {
          if (p.kind === "refund" && p.verifiedAt && p.refundedPaymentId) {
            refundedByPayment.set(
              p.refundedPaymentId,
              (refundedByPayment.get(p.refundedPaymentId) ?? 0) + Number(p.amount)
            );
          }
        }
        for (const p of payRows) {
          if (p.kind === "payment" && p.verifiedAt) {
            const left = Math.max(0, Number(p.amount) - (refundedByPayment.get(p.id) ?? 0));
            netCash += left;
            if (left > 0) refundable.push({ id: p.id, invoiceId: p.invoiceId, method: p.method, left });
          }
        }
      }

      let refundTarget = 0;
      if (dto.refundMode === "full") refundTarget = netCash;
      else if (dto.refundMode === "partial") {
        refundTarget = dto.refundAmount ?? 0;
        if (refundTarget <= 0)
          throw new BadRequestException("Partial refund amount must be greater than zero.");
        if (refundTarget > netCash)
          throw new BadRequestException(`Refund cannot exceed cash paid (${netCash}).`);
      }

      const refundMethod = dto.method ?? "cash";
      const isCash = refundMethod === "cash";
      if (refundTarget > 0 && !isCash && !dto.referenceNumber?.trim()) {
        throw new BadRequestException("Refund transaction ID is required for non-cash refunds.");
      }

      // Allocate the refund across verified payments, largest refundable first.
      const refundIds: string[] = [];
      let remaining = refundTarget;
      refundable.sort((a, b) => b.left - a.left);
      for (const vp of refundable) {
        if (remaining <= 0) break;
        const amt = Math.min(remaining, vp.left);
        const [refund] = await tx
          .insert(payments)
          .values({
            tenantId,
            createdBy: actorUserId,
            updatedBy: actorUserId,
            invoiceId: vp.invoiceId,
            kind: "refund",
            refundedPaymentId: vp.id,
            amount: String(amt),
            method: refundMethod as any,
            referenceNumber: dto.referenceNumber?.trim() || null,
            notes: reason,
            paidAt: new Date(),
            verifiedAt: isCash ? new Date() : null,
            verifiedByUserId: isCash ? actorUserId : null
          })
          .returning();
        if (refund) refundIds.push(refund.id);
        remaining -= amt;
      }

      // Void the unpaid remainder by closing the enrollment's invoices.
      if (invoiceIds.length) {
        await tx
          .update(invoices)
          .set({ status: "cancelled", updatedBy: actorUserId, updatedAt: new Date() })
          .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, invoiceIds)));
      }

      // Stop future recurring services for the student.
      const today = new Date().toISOString().slice(0, 10);
      await tx
        .update(studentServices)
        .set({ effectiveTo: today, updatedBy: actorUserId, updatedAt: new Date() })
        .where(
          and(
            eq(studentServices.tenantId, tenantId),
            eq(studentServices.studentId, enr.studentId),
            isNull(studentServices.effectiveTo)
          )
        );

      // Remove the student from the classroom roster this enrollment placed
      // them in.
      if (enr.classroomId) {
        await tx
          .update(classroomStudents)
          .set({
            effectiveTo: today,
            movementReason: "enrollment_cancelled",
            updatedBy: actorUserId,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(classroomStudents.tenantId, tenantId),
              eq(classroomStudents.studentId, enr.studentId),
              eq(classroomStudents.classroomId, enr.classroomId),
              isNull(classroomStudents.effectiveTo)
            )
          );
      }

      await tx
        .update(enrollments)
        .set({
          cancelledAt: new Date(),
          cancellationReason: reason,
          refundMode: dto.refundMode,
          updatedBy: actorUserId,
          updatedAt: new Date()
        })
        .where(eq(enrollments.id, enrollmentId));

      // Revert the student to draft when no other active enrollment remains.
      const [otherActive] = await tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.tenantId, tenantId),
            eq(enrollments.studentId, enr.studentId),
            ne(enrollments.id, enrollmentId),
            isNull(enrollments.cancelledAt),
            inArray(enrollments.status, ["approved", "published"])
          )
        )
        .limit(1);
      if (!otherActive) {
        await tx
          .update(students)
          .set({ status: "draft", updatedBy: actorUserId, updatedAt: new Date() })
          .where(and(eq(students.tenantId, tenantId), eq(students.id, enr.studentId)));
      }

      return {
        studentId: enr.studentId,
        refunded: refundTarget,
        forfeited: netCash - refundTarget,
        voidedInvoices: invoiceIds.length,
        refundIds
      };
    });

    await this.auditService.recordEvent(
      this.auditService.createEvent({
        tenantId,
        actorUserId,
        action: "enrollment.cancel",
        recordType: "enrollment",
        recordId: enrollmentId,
        reason,
        after: {
          refundMode: dto.refundMode,
          refunded: result.refunded,
          forfeited: result.forfeited,
          voidedInvoices: result.voidedInvoices
        }
      })
    );

    return {
      enrollmentId,
      refundMode: dto.refundMode,
      refunded: result.refunded,
      forfeited: result.forfeited,
      voidedInvoices: result.voidedInvoices
    };
  }
}
