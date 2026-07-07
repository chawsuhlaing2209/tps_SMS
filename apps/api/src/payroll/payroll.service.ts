import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  StreamableFile
} from "@nestjs/common";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { DB, type Database } from "../db/db.module.js";
import {
  benefitPackages,
  incentivePrograms,
  payComponents,
  payrollLineItems,
  payrollRecords,
  payrollRuns,
  staff,
  staffBenefitEnrollments,
  staffCompensationComponents,
  staffCompensationProfiles,
  staffIncentiveEligibility,
  tenantSettings,
  tenants,
  terms
} from "../db/schema.js";
import { isPercentInRange, PERCENT_RANGE_MESSAGE } from "@sms/shared";
import { PayslipQueueService } from "./payslip-queue.service.js";
import { PayslipRenderService } from "./payslip-render.service.js";
import { S3StorageService } from "../storage/s3-storage.service.js";
import type {
  ApprovePayrollRecordDto,
  CreateBenefitPackageDto,
  CreateIncentiveProgramDto,
  CreatePayComponentDto,
  CreatePayrollRunDto,
  EnrollStaffBenefitDto,
  MarkPayrollPaidDto,
  PatchPayrollRecordDto,
  SetIncentiveEligibilityDto,
  UpdateBenefitPackageDto,
  UpdateIncentiveProgramDto,
  UpdatePayComponentDto,
  UpsertStaffCompensationDto
} from "./dto.js";

type MonthParts = { year: number; month: number };

/** Reserved — base salary is stored on staff compensation profiles, not as a pay component. */
const BASE_SALARY_PAY_COMPONENT_CODE = "basic";

function isBaseSalaryPayComponentCode(code: string) {
  return code.trim().toLowerCase() === BASE_SALARY_PAY_COMPONENT_CODE;
}

function assertAssignablePayComponentCode(code: string) {
  if (isBaseSalaryPayComponentCode(code)) {
    throw new BadRequestException(
      "Base salary is set on each staff profile, not as a pay component."
    );
  }
}

function parseMonth(value: string): MonthParts {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new BadRequestException("Month must be YYYY-MM.");
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

function money(value: number): string {
  return value.toFixed(2);
}

function num(value: string | null | undefined): number {
  return Number(value ?? 0);
}

function assertPercentAmount(
  amount: number | undefined,
  calculation: string | undefined,
  awardType?: string | undefined
) {
  const isPercent =
    calculation === "percent_of_basic" || awardType === "percent_of_basic" || awardType === "percent";
  if (!isPercent || amount === undefined) return;
  if (!isPercentInRange(amount)) {
    throw new BadRequestException(PERCENT_RANGE_MESSAGE);
  }
}

@Injectable()
export class PayrollService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly payslipQueue: PayslipQueueService,
    private readonly payslipRender: PayslipRenderService,
    private readonly storage: S3StorageService
  ) {}

  // --- Pay components ---

  listPayComponents(tenantId: string) {
    return this.db
      .select()
      .from(payComponents)
      .where(eq(payComponents.tenantId, tenantId))
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          componentType: row.kind === "deduction" ? "deduction" : "allowance"
        }))
      );
  }

  async createPayComponent(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreatePayComponentDto
  ) {
    const calculation = dto.calculation ?? "fixed";
    assertPercentAmount(dto.defaultAmount, calculation);
    assertAssignablePayComponentCode(dto.code);

    const [component] = await this.db
      .insert(payComponents)
      .values({
        tenantId,
        code: dto.code.trim().toLowerCase(),
        name: dto.name.trim(),
        kind: dto.kind,
        calculation,
        defaultAmount: money(dto.defaultAmount ?? 0),
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "pay_component.create",
      recordType: "PayComponent",
      recordId: component!.id,
      after: { name: component!.name, kind: component!.kind }
    });

    return component;
  }

  private async getPayComponentOrThrow(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(payComponents)
      .where(and(eq(payComponents.id, id), eq(payComponents.tenantId, tenantId)));
    if (!row) throw new NotFoundException("Pay component not found.");
    return row;
  }

  private async filterStaffAssignableComponentIds(tenantId: string, componentIds: string[]) {
    if (componentIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({ id: payComponents.id, code: payComponents.code })
      .from(payComponents)
      .where(
        and(eq(payComponents.tenantId, tenantId), inArray(payComponents.id, componentIds))
      );

    return rows
      .filter((row) => !isBaseSalaryPayComponentCode(row.code))
      .map((row) => row.id);
  }

  private async getIncentiveProgramOrThrow(tenantId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(incentivePrograms)
      .where(and(eq(incentivePrograms.id, id), eq(incentivePrograms.tenantId, tenantId)));
    if (!row) throw new NotFoundException("Incentive program not found.");
    return row;
  }

  async updatePayComponent(
    tenantId: string,
    id: string,
    actorUserId: string | undefined,
    dto: UpdatePayComponentDto
  ) {
    const previous = await this.getPayComponentOrThrow(tenantId, id);
    const calculation = dto.calculation ?? previous.calculation;
    assertPercentAmount(
      dto.defaultAmount !== undefined ? dto.defaultAmount : num(previous.defaultAmount),
      calculation
    );

    const [component] = await this.db
      .update(payComponents)
      .set({
        name: dto.name?.trim() ?? previous.name,
        calculation: dto.calculation ?? previous.calculation,
        defaultAmount:
          dto.defaultAmount !== undefined ? money(dto.defaultAmount) : previous.defaultAmount,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(payComponents.id, id), eq(payComponents.tenantId, tenantId)))
      .returning();
    return component;
  }

  async archivePayComponent(tenantId: string, id: string, actorUserId: string | undefined) {
    const [component] = await this.db
      .update(payComponents)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(payComponents.id, id), eq(payComponents.tenantId, tenantId)))
      .returning();
    if (!component) throw new NotFoundException("Pay component not found.");
    return component;
  }

  async restorePayComponent(tenantId: string, id: string, actorUserId: string | undefined) {
    const [component] = await this.db
      .update(payComponents)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(payComponents.id, id), eq(payComponents.tenantId, tenantId)))
      .returning();
    if (!component) throw new NotFoundException("Pay component not found.");
    return component;
  }

  /** @deprecated Use {@link restorePayComponent}. Kept for the legacy /reactivate route. */
  async reactivatePayComponent(tenantId: string, id: string, actorUserId: string | undefined) {
    return this.restorePayComponent(tenantId, id, actorUserId);
  }

  async deletePayComponent(tenantId: string, id: string, actorUserId: string | undefined) {
    const previous = await this.getPayComponentOrThrow(tenantId, id);
    if (previous.status !== "archived") {
      throw new BadRequestException("Only archived pay components can be deleted.");
    }

    if (isBaseSalaryPayComponentCode(previous.code)) {
      await this.db
        .delete(staffCompensationComponents)
        .where(
          and(
            eq(staffCompensationComponents.tenantId, tenantId),
            eq(staffCompensationComponents.componentId, id)
          )
        );
    } else {
      const [assigned] = await this.db
        .select({ id: staffCompensationComponents.id })
        .from(staffCompensationComponents)
        .where(
          and(
            eq(staffCompensationComponents.tenantId, tenantId),
            eq(staffCompensationComponents.componentId, id)
          )
        )
        .limit(1);

      if (assigned) {
        throw new BadRequestException(
          "This pay component is assigned to staff compensation profiles and cannot be deleted."
        );
      }
    }

    await this.db
      .delete(payComponents)
      .where(and(eq(payComponents.id, id), eq(payComponents.tenantId, tenantId)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "pay_component.delete",
      recordType: "PayComponent",
      recordId: id,
      before: { name: previous.name, code: previous.code }
    });

    return { ok: true as const };
  }

  // --- Benefit packages ---

  async listBenefitPackages(tenantId: string) {
    const packages = await this.db
      .select()
      .from(benefitPackages)
      .where(eq(benefitPackages.tenantId, tenantId));

    const enrollments = await this.db
      .select({
        packageId: staffBenefitEnrollments.packageId,
        count: sql<number>`count(*)::int`
      })
      .from(staffBenefitEnrollments)
      .where(eq(staffBenefitEnrollments.tenantId, tenantId))
      .groupBy(staffBenefitEnrollments.packageId);

    const countByPackage = new Map(enrollments.map((e) => [e.packageId, e.count]));

    return packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      monthlyValue: num(pkg.monthlyValue),
      icon: pkg.iconKey,
      status: pkg.status,
      enrolledCount: countByPackage.get(pkg.id) ?? 0,
      eligibility:
        pkg.eligibilityScope === "non_teaching" ? "admin_staff" : pkg.eligibilityScope
    }));
  }

  async getBenefitsSummary(tenantId: string) {
    const packages = await this.listBenefitPackages(tenantId);
    const programs = await this.db
      .select()
      .from(incentivePrograms)
      .where(
        and(eq(incentivePrograms.tenantId, tenantId), eq(incentivePrograms.status, "active"))
      );

    const benefitsPerMonth = packages
      .filter((p) => p.status === "active")
      .reduce((sum, p) => sum + p.monthlyValue * p.enrolledCount, 0);

    return {
      benefitsPerMonth,
      activePackages: packages.filter((p) => p.status === "active").length,
      bonusesThisTerm: programs.filter((p) => p.cadence === "term").length,
      incentiveAwards: programs.length
    };
  }

  async createBenefitPackage(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateBenefitPackageDto & { icon?: string | null; eligibility?: string }
  ) {
    const scope =
      dto.eligibility === "teachers"
        ? "teachers"
        : dto.eligibility === "admin_staff" || dto.eligibility === "full_time"
          ? "non_teaching"
          : (dto.eligibilityScope ?? "all_staff");

    const [pkg] = await this.db
      .insert(benefitPackages)
      .values({
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        iconKey: dto.iconKey ?? dto.icon ?? "card_giftcard",
        monthlyValue: money(dto.monthlyValue ?? 0),
        eligibilityScope: scope,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "benefit_package.create",
      recordType: "BenefitPackage",
      recordId: pkg!.id,
      after: { name: pkg!.name }
    });

    return pkg;
  }

  async updateBenefitPackage(
    tenantId: string,
    id: string,
    actorUserId: string | undefined,
    dto: UpdateBenefitPackageDto & { icon?: string | null; eligibility?: string }
  ) {
    const scope =
      dto.eligibility === "teachers"
        ? "teachers"
        : dto.eligibility === "admin_staff" || dto.eligibility === "full_time"
          ? "non_teaching"
          : dto.eligibilityScope;

    const [pkg] = await this.db
      .update(benefitPackages)
      .set({
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        iconKey: dto.iconKey ?? dto.icon ?? undefined,
        monthlyValue: dto.monthlyValue !== undefined ? money(dto.monthlyValue) : undefined,
        eligibilityScope: scope,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(benefitPackages.id, id), eq(benefitPackages.tenantId, tenantId)))
      .returning();
    if (!pkg) throw new NotFoundException("Benefit package not found.");
    return pkg;
  }

  async archiveBenefitPackage(tenantId: string, id: string, actorUserId: string | undefined) {
    const [pkg] = await this.db
      .update(benefitPackages)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(benefitPackages.id, id), eq(benefitPackages.tenantId, tenantId)))
      .returning();
    if (!pkg) throw new NotFoundException("Benefit package not found.");
    return pkg;
  }

  async restoreBenefitPackage(tenantId: string, id: string, actorUserId: string | undefined) {
    const [pkg] = await this.db
      .update(benefitPackages)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(benefitPackages.id, id), eq(benefitPackages.tenantId, tenantId)))
      .returning();
    if (!pkg) throw new NotFoundException("Benefit package not found.");
    return pkg;
  }

  async deleteBenefitPackage(tenantId: string, id: string, actorUserId: string | undefined) {
    const [pkg] = await this.db
      .select()
      .from(benefitPackages)
      .where(and(eq(benefitPackages.id, id), eq(benefitPackages.tenantId, tenantId)));
    if (!pkg) throw new NotFoundException("Benefit package not found.");

    // Two-step safety: archive before permanent deletion.
    if (pkg.status !== "archived") {
      throw new BadRequestException("Archive the benefit package before deleting it.");
    }

    const [enrolled] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(staffBenefitEnrollments)
      .where(and(eq(staffBenefitEnrollments.tenantId, tenantId), eq(staffBenefitEnrollments.packageId, id)));
    if ((enrolled?.n ?? 0) > 0) {
      throw new ConflictException({
        message:
          "This benefit package has staff enrolments and cannot be deleted. Keep it archived instead.",
        dependencies: { enrollments: enrolled?.n ?? 0 }
      });
    }

    await this.db.delete(benefitPackages).where(and(eq(benefitPackages.tenantId, tenantId), eq(benefitPackages.id, id)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "benefit_package.delete",
      recordType: "BenefitPackage",
      recordId: id,
      before: { name: pkg.name, status: pkg.status },
      after: { deleted: true }
    });

    return { id, deleted: true };
  }

  async enrollStaffBenefit(
    tenantId: string,
    packageId: string,
    actorUserId: string | undefined,
    dto: EnrollStaffBenefitDto
  ) {
    const [row] = await this.db
      .insert(staffBenefitEnrollments)
      .values({
        tenantId,
        staffId: dto.staffId,
        packageId,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo ?? null,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .onConflictDoNothing()
      .returning();
    return row ?? { staffId: dto.staffId, packageId };
  }

  async unenrollStaffBenefit(tenantId: string, packageId: string, staffId: string) {
    await this.db
      .delete(staffBenefitEnrollments)
      .where(
        and(
          eq(staffBenefitEnrollments.tenantId, tenantId),
          eq(staffBenefitEnrollments.packageId, packageId),
          eq(staffBenefitEnrollments.staffId, staffId)
        )
      );
    return { removed: true };
  }

  // --- Incentive programs ---

  async listIncentivePrograms(tenantId: string) {
    const programs = await this.db
      .select()
      .from(incentivePrograms)
      .where(eq(incentivePrograms.tenantId, tenantId));

    const eligibility = await this.db
      .select({
        programId: staffIncentiveEligibility.programId,
        count: sql<number>`count(*)::int`
      })
      .from(staffIncentiveEligibility)
      .where(
        and(
          eq(staffIncentiveEligibility.tenantId, tenantId),
          eq(staffIncentiveEligibility.isActive, true)
        )
      )
      .groupBy(staffIncentiveEligibility.programId);

    const recipientCount = new Map(eligibility.map((e) => [e.programId, e.count]));

    return programs.map((program) => ({
      id: program.id,
      name: program.name,
      description: program.description,
      cadence: this.toUiCadence(program.cadence),
      awardType: program.awardType === "percent_of_basic" ? "percent" : "fixed",
      amount: program.awardAmount ? num(program.awardAmount) : 0,
      status: program.status,
      triggerRule: program.description?.trim() || this.formatTriggerRule(program),
      eligibleCount: recipientCount.get(program.id) ?? 0,
      recipients: recipientCount.get(program.id) ?? 0,
      paidCount: 0
    }));
  }

  private toUiCadence(cadence: typeof incentivePrograms.$inferSelect.cadence) {
    if (cadence === "per_payroll") return "monthly";
    if (cadence === "term") return "quarterly";
    return cadence;
  }

  private fromUiCadence(cadence: string): typeof incentivePrograms.$inferSelect.cadence {
    if (cadence === "monthly") return "per_payroll";
    if (cadence === "quarterly") return "term";
    if (cadence === "annual") return "annual";
    return "one_time";
  }

  private fromUiAwardType(awardType: string): typeof incentivePrograms.$inferSelect.awardType {
    return awardType === "percent" ? "percent_of_basic" : "fixed";
  }

  private formatTriggerRule(program: typeof incentivePrograms.$inferSelect) {
    const parts = [program.cadence.replace("_", " "), program.awardType.replace("_", " ")];
    if (program.awardAmount) parts.push(`${num(program.awardAmount)} MMK`);
    return parts.join(" · ");
  }

  async createIncentiveProgram(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateIncentiveProgramDto & { cadence?: string; awardType?: string; amount?: number }
  ) {
    const cadence = dto.cadence ? this.fromUiCadence(dto.cadence) : dto.cadence;
    const awardType = dto.awardType
      ? this.fromUiAwardType(dto.awardType)
      : dto.awardType;
    const awardAmount = dto.amount ?? dto.awardAmount;
    assertPercentAmount(awardAmount, undefined, awardType ?? "fixed");

    const [program] = await this.db
      .insert(incentivePrograms)
      .values({
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        cadence: (cadence ?? "per_payroll") as typeof incentivePrograms.$inferInsert.cadence,
        awardType: (awardType ?? "fixed") as typeof incentivePrograms.$inferInsert.awardType,
        awardAmount: awardAmount !== undefined ? money(awardAmount) : null,
        capAmount: dto.capAmount !== undefined ? money(dto.capAmount) : null,
        termId: dto.termId ?? null,
        academicYearId: dto.academicYearId ?? null,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();
    return program;
  }

  async updateIncentiveProgram(
    tenantId: string,
    id: string,
    actorUserId: string | undefined,
    dto: UpdateIncentiveProgramDto
  ) {
    const previous = await this.getIncentiveProgramOrThrow(tenantId, id);
    if (dto.awardAmount !== undefined) {
      assertPercentAmount(dto.awardAmount, undefined, previous.awardType);
    }

    const [program] = await this.db
      .update(incentivePrograms)
      .set({
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        awardAmount: dto.awardAmount !== undefined ? money(dto.awardAmount) : undefined,
        capAmount: dto.capAmount !== undefined ? money(dto.capAmount) : undefined,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(and(eq(incentivePrograms.id, id), eq(incentivePrograms.tenantId, tenantId)))
      .returning();
    if (!program) throw new NotFoundException("Incentive program not found.");
    return program;
  }

  async archiveIncentiveProgram(tenantId: string, id: string, actorUserId: string | undefined) {
    const [program] = await this.db
      .update(incentivePrograms)
      .set({ status: "archived", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(incentivePrograms.id, id), eq(incentivePrograms.tenantId, tenantId)))
      .returning();
    if (!program) throw new NotFoundException("Incentive program not found.");
    return program;
  }

  async restoreIncentiveProgram(tenantId: string, id: string, actorUserId: string | undefined) {
    const [program] = await this.db
      .update(incentivePrograms)
      .set({ status: "active", updatedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(incentivePrograms.id, id), eq(incentivePrograms.tenantId, tenantId)))
      .returning();
    if (!program) throw new NotFoundException("Incentive program not found.");
    return program;
  }

  async deleteIncentiveProgram(tenantId: string, id: string, actorUserId: string | undefined) {
    const program = await this.getIncentiveProgramOrThrow(tenantId, id);

    // Two-step safety: archive before permanent deletion.
    if (program.status !== "archived") {
      throw new BadRequestException("Archive the incentive program before deleting it.");
    }

    const [eligible] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(staffIncentiveEligibility)
      .where(and(eq(staffIncentiveEligibility.tenantId, tenantId), eq(staffIncentiveEligibility.programId, id)));
    if ((eligible?.n ?? 0) > 0) {
      throw new ConflictException({
        message:
          "This incentive program has eligible staff and cannot be deleted. Keep it archived instead.",
        dependencies: { eligibility: eligible?.n ?? 0 }
      });
    }

    await this.db.delete(incentivePrograms).where(and(eq(incentivePrograms.tenantId, tenantId), eq(incentivePrograms.id, id)));

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "incentive_program.delete",
      recordType: "IncentiveProgram",
      recordId: id,
      before: { name: program.name, status: program.status },
      after: { deleted: true }
    });

    return { id, deleted: true };
  }

  async setIncentiveEligibility(
    tenantId: string,
    programId: string,
    dto: SetIncentiveEligibilityDto
  ) {
    const [row] = await this.db
      .insert(staffIncentiveEligibility)
      .values({
        tenantId,
        staffId: dto.staffId,
        programId,
        isActive: dto.isActive ?? true
      })
      .onConflictDoUpdate({
        target: [
          staffIncentiveEligibility.tenantId,
          staffIncentiveEligibility.staffId,
          staffIncentiveEligibility.programId
        ],
        set: { isActive: dto.isActive ?? true, updatedAt: new Date() }
      })
      .returning();
    return row;
  }

  async removeIncentiveEligibility(tenantId: string, programId: string, staffId: string) {
    await this.db
      .delete(staffIncentiveEligibility)
      .where(
        and(
          eq(staffIncentiveEligibility.tenantId, tenantId),
          eq(staffIncentiveEligibility.programId, programId),
          eq(staffIncentiveEligibility.staffId, staffId)
        )
      );
    return { removed: true };
  }

  // --- Staff compensation ---

  async getStaffCompensation(tenantId: string, staffId: string) {
    const [profile] = await this.db
      .select()
      .from(staffCompensationProfiles)
      .where(
        and(
          eq(staffCompensationProfiles.tenantId, tenantId),
          eq(staffCompensationProfiles.staffId, staffId)
        )
      );

    const components = profile
      ? await this.db
          .select({
            componentId: staffCompensationComponents.componentId,
            amountOverride: staffCompensationComponents.amountOverride,
            name: payComponents.name,
            kind: payComponents.kind,
            calculation: payComponents.calculation,
            defaultAmount: payComponents.defaultAmount
          })
          .from(staffCompensationComponents)
          .innerJoin(payComponents, eq(staffCompensationComponents.componentId, payComponents.id))
          .where(
            and(
              eq(staffCompensationComponents.profileId, profile.id),
              ne(payComponents.code, BASE_SALARY_PAY_COMPONENT_CODE)
            )
          )
      : [];

    const enrollments = await this.db
      .select({
        packageId: staffBenefitEnrollments.packageId,
        name: benefitPackages.name
      })
      .from(staffBenefitEnrollments)
      .innerJoin(benefitPackages, eq(staffBenefitEnrollments.packageId, benefitPackages.id))
      .where(
        and(
          eq(staffBenefitEnrollments.tenantId, tenantId),
          eq(staffBenefitEnrollments.staffId, staffId)
        )
      );

    const allPrograms = await this.db
      .select()
      .from(incentivePrograms)
      .where(
        and(eq(incentivePrograms.tenantId, tenantId), eq(incentivePrograms.status, "active"))
      );

    const eligibilityRows = await this.db
      .select()
      .from(staffIncentiveEligibility)
      .where(
        and(
          eq(staffIncentiveEligibility.tenantId, tenantId),
          eq(staffIncentiveEligibility.staffId, staffId)
        )
      );

    const eligibilityByProgram = new Map(
      eligibilityRows.map((row) => [row.programId, row.isActive])
    );

    const baseSalary = profile ? num(profile.baseSalary) : 0;

    return {
      staffId,
      baseSalary,
      currency: profile?.currency ?? "MMK",
      payComponentAssignments: components.map((c) => ({
        payComponentId: c.componentId,
        name: c.name,
        // Mirrors calcComponentAmount: a flat override wins; otherwise
        // percent_of_basic components resolve against the base salary. Run
        // generation books these amounts, so they must match the record view.
        amount: c.amountOverride
          ? num(c.amountOverride)
          : c.calculation === "percent_of_basic"
            ? (baseSalary * num(c.defaultAmount)) / 100
            : num(c.defaultAmount)
      })),
      benefitEnrollments: enrollments.map((e) => ({
        packageId: e.packageId,
        name: e.name
      })),
      incentiveEligibility: allPrograms.map((program) => ({
        programId: program.id,
        name: program.name,
        eligible: eligibilityByProgram.get(program.id) ?? false
      })),
      components: components.map((c) => ({
        componentId: c.componentId,
        name: c.name,
        kind: c.kind,
        amountOverride: c.amountOverride ? num(c.amountOverride) : null
      })),
      benefitPackageIds: enrollments.map((e) => e.packageId),
      incentiveProgramIds: eligibilityRows
        .filter((row) => row.isActive)
        .map((row) => row.programId)
    };
  }

  async upsertStaffCompensation(
    tenantId: string,
    staffId: string,
    actorUserId: string | undefined,
    dto: UpsertStaffCompensationDto
  ) {
    const [existing] = await this.db
      .select()
      .from(staffCompensationProfiles)
      .where(
        and(
          eq(staffCompensationProfiles.tenantId, tenantId),
          eq(staffCompensationProfiles.staffId, staffId)
        )
      );

    let profileId = existing?.id;
    if (existing) {
      await this.db
        .update(staffCompensationProfiles)
        .set({
          baseSalary: dto.baseSalary !== undefined ? money(dto.baseSalary) : existing.baseSalary,
          currency: dto.currency ?? existing.currency,
          updatedBy: actorUserId,
          updatedAt: new Date()
        })
        .where(eq(staffCompensationProfiles.id, existing.id));
    } else {
      const [created] = await this.db
        .insert(staffCompensationProfiles)
        .values({
          tenantId,
          staffId,
          baseSalary: money(dto.baseSalary ?? 0),
          currency: dto.currency ?? "MMK",
          createdBy: actorUserId,
          updatedBy: actorUserId
        })
        .returning();
      profileId = created!.id;
    }

    if (dto.components && profileId) {
      await this.db
        .delete(staffCompensationComponents)
        .where(eq(staffCompensationComponents.profileId, profileId));

      const assignableComponents = await this.filterStaffAssignableComponentIds(
        tenantId,
        dto.components.map((component) => component.componentId)
      );
      const allowedComponentIds = new Set(assignableComponents);

      const componentsToInsert = dto.components.filter((component) =>
        allowedComponentIds.has(component.componentId)
      );

      if (componentsToInsert.length > 0) {
        await this.db.insert(staffCompensationComponents).values(
          componentsToInsert.map((c) => ({
            tenantId,
            profileId,
            componentId: c.componentId,
            amountOverride:
              c.amountOverride !== undefined && c.amountOverride !== null
                ? money(c.amountOverride)
                : null,
            createdBy: actorUserId,
            updatedBy: actorUserId
          }))
        );
      }
    }

    if (dto.payComponentIds && profileId) {
      await this.db
        .delete(staffCompensationComponents)
        .where(eq(staffCompensationComponents.profileId, profileId));

      const assignableComponentIds = await this.filterStaffAssignableComponentIds(
        tenantId,
        dto.payComponentIds
      );

      if (assignableComponentIds.length > 0) {
        await this.db.insert(staffCompensationComponents).values(
          assignableComponentIds.map((componentId) => ({
            tenantId,
            profileId,
            componentId,
            createdBy: actorUserId,
            updatedBy: actorUserId
          }))
        );
      }
    }

    if (dto.benefitPackageIds) {
      await this.db
        .delete(staffBenefitEnrollments)
        .where(
          and(
            eq(staffBenefitEnrollments.tenantId, tenantId),
            eq(staffBenefitEnrollments.staffId, staffId)
          )
        );

      const today = new Date().toISOString().slice(0, 10);
      for (const packageId of dto.benefitPackageIds) {
        await this.db.insert(staffBenefitEnrollments).values({
          tenantId,
          staffId,
          packageId,
          effectiveFrom: today,
          createdBy: actorUserId,
          updatedBy: actorUserId
        });
      }
    }

    if (dto.incentiveProgramIds) {
      const allPrograms = await this.db
        .select({ id: incentivePrograms.id })
        .from(incentivePrograms)
        .where(eq(incentivePrograms.tenantId, tenantId));

      for (const program of allPrograms) {
        const isActive = dto.incentiveProgramIds.includes(program.id);
        await this.db
          .insert(staffIncentiveEligibility)
          .values({
            tenantId,
            staffId,
            programId: program.id,
            isActive
          })
          .onConflictDoUpdate({
            target: [
              staffIncentiveEligibility.tenantId,
              staffIncentiveEligibility.staffId,
              staffIncentiveEligibility.programId
            ],
            set: { isActive, updatedAt: new Date() }
          });
      }
    }

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "staff_compensation.upsert",
      recordType: "Staff",
      recordId: staffId,
      after: { baseSalary: dto.baseSalary }
    });

    return this.getStaffCompensation(tenantId, staffId);
  }

  // --- Payroll runs ---

  async listPayrollRuns(tenantId: string, month?: string) {
    const filters = [eq(payrollRuns.tenantId, tenantId)];
    if (month) {
      const { year, month: m } = parseMonth(month);
      filters.push(eq(payrollRuns.periodYear, year), eq(payrollRuns.periodMonth, m));
    }

    const runs = await this.db
      .select()
      .from(payrollRuns)
      .where(and(...filters))
      .orderBy(sql`${payrollRuns.periodYear} desc, ${payrollRuns.periodMonth} desc`);

    return runs.map((run) => ({
      id: run.id,
      month: `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`,
      status: run.status
    }));
  }

  async createPayrollRun(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreatePayrollRunDto & { month?: string }
  ) {
    const { year, month } = dto.month
      ? parseMonth(dto.month)
      : { year: dto.periodYear, month: dto.periodMonth };

    if (!year || !month) {
      throw new BadRequestException("Provide periodYear and periodMonth, or month (YYYY-MM).");
    }

    const existing = await this.listPayrollRuns(
      tenantId,
      `${year}-${String(month).padStart(2, "0")}`
    );
    if (existing[0]) return existing[0];

    const [run] = await this.db
      .insert(payrollRuns)
      .values({
        tenantId,
        periodYear: year,
        periodMonth: month,
        status: "draft",
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning();

    return { id: run!.id, month: `${year}-${String(month).padStart(2, "0")}`, status: run!.status };
  }

  private async getRunOrThrow(tenantId: string, runId: string) {
    const [run] = await this.db
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, tenantId)));
    if (!run) throw new NotFoundException("Payroll run not found.");
    return run;
  }

  private calcComponentAmount(
    component: typeof payComponents.$inferSelect,
    base: number,
    override: number | null
  ): number {
    if (override !== null) return override;
    if (component.calculation === "percent_of_basic") {
      return (base * num(component.defaultAmount)) / 100;
    }
    return num(component.defaultAmount);
  }

  private resolveIncentiveAmount(
    program: typeof incentivePrograms.$inferSelect,
    base: number,
    override?: number | null
  ): number {
    if (override !== undefined && override !== null) return override;
    if (program.awardType === "percent_of_basic") {
      const raw = (base * num(program.awardAmount)) / 100;
      return program.capAmount ? Math.min(raw, num(program.capAmount)) : raw;
    }
    if (program.awardType === "manual") {
      return num(program.awardAmount);
    }
    return num(program.awardAmount);
  }

  private async listIncentiveProgramsForRun(
    tenantId: string,
    run: typeof payrollRuns.$inferSelect
  ) {
    const programs = await this.db
      .select()
      .from(incentivePrograms)
      .where(
        and(eq(incentivePrograms.tenantId, tenantId), eq(incentivePrograms.status, "active"))
      );

    const matching: typeof programs = [];
    for (const program of programs) {
      if (program.cadence === "per_payroll") {
        matching.push(program);
        continue;
      }
      if (program.cadence === "term" && program.termId) {
        const [term] = await this.db
          .select()
          .from(terms)
          .where(and(eq(terms.id, program.termId), eq(terms.tenantId, tenantId)));
        if (!term) continue;
        const runStart = new Date(run.periodYear, run.periodMonth - 1, 1);
        const runEnd = new Date(run.periodYear, run.periodMonth, 0);
        const termStart = new Date(term.startsOn);
        const termEnd = new Date(term.endsOn);
        if (runStart <= termEnd && runEnd >= termStart) matching.push(program);
        continue;
      }
      if (program.cadence === "annual") {
        matching.push(program);
      }
    }
    return matching;
  }

  private async syncDraftRecordsForRun(
    tenantId: string,
    runId: string,
    actorUserId: string | undefined
  ) {
    const run = await this.getRunOrThrow(tenantId, runId);
    const draftRecords = await this.db
      .select()
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.tenantId, tenantId),
          eq(payrollRecords.runId, runId),
          eq(payrollRecords.status, "draft")
        )
      );

    for (const record of draftRecords) {
      await this.syncDraftRecordFromCompensation(tenantId, record, run, actorUserId);
    }

    if (draftRecords.length > 0) {
      await this.recalculateRunTotals(tenantId, runId);
    }
  }

  private async syncDraftRecordFromCompensation(
    tenantId: string,
    record: typeof payrollRecords.$inferSelect,
    run: typeof payrollRuns.$inferSelect,
    actorUserId: string | undefined
  ) {
    if (record.status !== "draft") return;

    const comp = await this.getStaffCompensation(tenantId, record.staffId);
    const base = comp.baseSalary;

    const existingLines = await this.db
      .select()
      .from(payrollLineItems)
      .where(eq(payrollLineItems.recordId, record.id));

    const enabledComponentIds = new Set(
      existingLines
        .filter(
          (line) =>
            (line.sourceType === "component" || line.sourceType === "deduction") && line.sourceId
        )
        .map((line) => line.sourceId!)
    );
    const enabledPackageIds = new Set(
      existingLines
        .filter((line) => line.sourceType === "package" && line.sourceId)
        .map((line) => line.sourceId!)
    );
    const enabledIncentiveIds = new Set(
      existingLines
        .filter((line) => line.sourceType === "incentive" && line.sourceId)
        .map((line) => line.sourceId!)
    );
    const existingCompSourceIds = new Set(
      existingLines
        .filter((line) => line.sourceType !== "incentive" && line.sourceId)
        .map((line) => line.sourceId!)
    );
    const existingLineAmountBySource = new Map(
      existingLines
        .filter((line) => line.sourceId)
        .map((line) => [line.sourceId!, line.amount] as const)
    );

    const lineItems: Array<{
      sourceType: typeof payrollLineItems.sourceType._.data;
      sourceId: string | null;
      label: string;
      amount: string;
      sortOrder: number;
    }> = [];

    let sort = 0;

    for (const assignment of comp.payComponentAssignments) {
      const componentId = assignment.payComponentId;
      const isNew = !existingCompSourceIds.has(componentId);
      if (!isNew && !enabledComponentIds.has(componentId)) continue;

      const [component] = await this.db
        .select()
        .from(payComponents)
        .where(
          and(eq(payComponents.id, componentId), eq(payComponents.tenantId, tenantId))
        );
      if (!component || component.status !== "active") continue;

      lineItems.push({
        sourceType: component.kind === "deduction" ? "deduction" : "component",
        sourceId: component.id,
        label: component.name,
        amount: existingLineAmountBySource.get(componentId) ?? money(assignment.amount),
        sortOrder: sort++
      });
    }

    for (const enrollment of comp.benefitEnrollments) {
      const packageId = enrollment.packageId;
      const isNew = !existingCompSourceIds.has(packageId);
      if (!isNew && !enabledPackageIds.has(packageId)) continue;

      const [pkg] = await this.db
        .select()
        .from(benefitPackages)
        .where(and(eq(benefitPackages.id, packageId), eq(benefitPackages.tenantId, tenantId)));
      if (!pkg || pkg.status !== "active") continue;

      lineItems.push({
        sourceType: "package",
        sourceId: pkg.id,
        label: pkg.name,
        amount: existingLineAmountBySource.get(packageId) ?? money(num(pkg.monthlyValue)),
        sortOrder: sort++
      });
    }

    const matchingPrograms = await this.listIncentiveProgramsForRun(tenantId, run);
    for (const program of matchingPrograms) {
      if (!enabledIncentiveIds.has(program.id)) continue;
      lineItems.push({
        sourceType: "incentive",
        sourceId: program.id,
        label: program.name,
        amount:
          existingLineAmountBySource.get(program.id) ??
          money(this.resolveIncentiveAmount(program, base)),
        sortOrder: sort++
      });
    }

    sort = await this.appendPreservedPayrollLineItems(
      tenantId,
      existingLines,
      lineItems,
      sort
    );

    const totals = this.sumLineItemTotals(lineItems, base);

    await this.db.delete(payrollLineItems).where(eq(payrollLineItems.recordId, record.id));

    await this.db
      .update(payrollRecords)
      .set({
        baseAmount: money(base),
        allowancesAmount: money(totals.allowances),
        bonusesAmount: money(totals.bonuses),
        deductionsAmount: money(totals.deductions),
        netAmount: money(totals.net),
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(eq(payrollRecords.id, record.id));

    if (lineItems.length > 0) {
      await this.db.insert(payrollLineItems).values(
        lineItems.map((item) => ({
          tenantId,
          recordId: record.id,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          label: item.label,
          amount: item.amount,
          sortOrder: item.sortOrder,
          createdBy: actorUserId,
          updatedBy: actorUserId
        }))
      );
    }
  }

  private async buildCompensationLineItems(
    tenantId: string,
    comp: Awaited<ReturnType<PayrollService["getStaffCompensation"]>>,
    base: number,
    enabledIncentiveProgramIds: Set<string>
  ) {
    const lineItems: Array<{
      sourceType: typeof payrollLineItems.sourceType._.data;
      sourceId: string | null;
      label: string;
      amount: string;
      sortOrder: number;
    }> = [];

    let sort = 0;
    for (const assignment of comp.payComponentAssignments) {
      const [component] = await this.db
        .select()
        .from(payComponents)
        .where(
          and(
            eq(payComponents.id, assignment.payComponentId),
            eq(payComponents.tenantId, tenantId)
          )
        );
      if (!component || component.status !== "active") continue;

      lineItems.push({
        sourceType: component.kind === "deduction" ? "deduction" : "component",
        sourceId: component.id,
        label: component.name,
        amount: money(assignment.amount),
        sortOrder: sort++
      });
    }

    for (const enrollment of comp.benefitEnrollments) {
      const [pkg] = await this.db
        .select()
        .from(benefitPackages)
        .where(
          and(eq(benefitPackages.id, enrollment.packageId), eq(benefitPackages.tenantId, tenantId))
        );
      if (!pkg || pkg.status !== "active") continue;
      lineItems.push({
        sourceType: "package",
        sourceId: pkg.id,
        label: pkg.name,
        amount: money(num(pkg.monthlyValue)),
        sortOrder: sort++
      });
    }

    if (enabledIncentiveProgramIds.size > 0) {
      const programs = await this.db
        .select()
        .from(incentivePrograms)
        .where(
          and(
            eq(incentivePrograms.tenantId, tenantId),
            eq(incentivePrograms.status, "active")
          )
        );

      for (const program of programs) {
        if (!enabledIncentiveProgramIds.has(program.id)) continue;
        const amount = this.resolveIncentiveAmount(program, base);
        lineItems.push({
          sourceType: "incentive",
          sourceId: program.id,
          label: program.name,
          amount: money(amount),
          sortOrder: sort++
        });
      }
    }

    return lineItems;
  }

  private sumLineItemTotals(
    lineItems: Array<{ sourceType: string; amount: string }>,
    base: number
  ) {
    let allowances = 0;
    let deductions = 0;
    let bonuses = 0;

    for (const line of lineItems) {
      const amount = num(line.amount);
      if (line.sourceType === "deduction") deductions += amount;
      else if (line.sourceType === "incentive") bonuses += amount;
      else allowances += amount;
    }

    return {
      allowances,
      deductions,
      bonuses,
      net: base + allowances + bonuses - deductions
    };
  }

  /** Keep run-specific selections that are not part of the staff compensation profile. */
  private async appendPreservedPayrollLineItems(
    tenantId: string,
    existingLines: Array<typeof payrollLineItems.$inferSelect>,
    lineItems: Array<{
      sourceType: typeof payrollLineItems.sourceType._.data;
      sourceId: string | null;
      label: string;
      amount: string;
      sortOrder: number;
    }>,
    sortOrder: number
  ) {
    const includedSourceIds = new Set(
      lineItems.map((item) => item.sourceId).filter((id): id is string => Boolean(id))
    );

    let sort = sortOrder;

    for (const line of existingLines) {
      if (!line.sourceId || includedSourceIds.has(line.sourceId)) continue;

      if (line.sourceType === "package") {
        const [pkg] = await this.db
          .select()
          .from(benefitPackages)
          .where(
            and(eq(benefitPackages.id, line.sourceId), eq(benefitPackages.tenantId, tenantId))
          );
        if (!pkg || pkg.status !== "active") continue;

        lineItems.push({
          sourceType: "package",
          sourceId: pkg.id,
          label: pkg.name,
          amount: line.amount,
          sortOrder: sort++
        });
        includedSourceIds.add(pkg.id);
        continue;
      }

      if (line.sourceType === "component" || line.sourceType === "deduction") {
        const [component] = await this.db
          .select()
          .from(payComponents)
          .where(
            and(eq(payComponents.id, line.sourceId), eq(payComponents.tenantId, tenantId))
          );
        if (!component || component.status !== "active") continue;

        lineItems.push({
          sourceType: component.kind === "deduction" ? "deduction" : "component",
          sourceId: component.id,
          label: component.name,
          amount: line.amount,
          sortOrder: sort++
        });
        includedSourceIds.add(component.id);
        continue;
      }

      if (line.sourceType === "incentive") {
        const [program] = await this.db
          .select()
          .from(incentivePrograms)
          .where(
            and(eq(incentivePrograms.id, line.sourceId), eq(incentivePrograms.tenantId, tenantId))
          );
        if (!program || program.status !== "active") continue;

        lineItems.push({
          sourceType: "incentive",
          sourceId: program.id,
          label: program.name,
          amount: line.amount,
          sortOrder: sort++
        });
        includedSourceIds.add(program.id);
      }
    }

    return sort;
  }

  async generatePayrollRun(tenantId: string, runId: string, actorUserId: string | undefined) {
    const run = await this.getRunOrThrow(tenantId, runId);
    const activeStaff = await this.db
      .select({
        id: staff.id,
        fullName: staff.fullName,
        department: staff.department,
        departmentId: staff.departmentId,
        employmentRole: staff.employmentRole,
        email: staff.email
      })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.status, "active")));

    let generated = 0;
    let resynced = 0;

    for (const member of activeStaff) {
      const [existingRecord] = await this.db
        .select()
        .from(payrollRecords)
        .where(
          and(
            eq(payrollRecords.tenantId, tenantId),
            eq(payrollRecords.runId, runId),
            eq(payrollRecords.staffId, member.id)
          )
        );

      if (existingRecord && existingRecord.status !== "draft") continue;

      const comp = await this.getStaffCompensation(tenantId, member.id);
      const base = comp.baseSalary;

      const lineItems = await this.buildCompensationLineItems(
        tenantId,
        comp,
        base,
        new Set<string>()
      );
      const totals = this.sumLineItemTotals(lineItems, base);

      if (existingRecord) {
        await this.syncDraftRecordFromCompensation(
          tenantId,
          existingRecord,
          run,
          actorUserId
        );
        resynced += 1;
        continue;
      }

      const [record] = await this.db
        .insert(payrollRecords)
        .values({
          tenantId,
          runId,
          staffId: member.id,
          departmentName: member.department,
          baseAmount: money(base),
          allowancesAmount: money(totals.allowances),
          bonusesAmount: money(totals.bonuses),
          deductionsAmount: money(totals.deductions),
          netAmount: money(totals.net),
          status: "draft",
          createdBy: actorUserId,
          updatedBy: actorUserId
        })
        .returning();

      if (lineItems.length > 0) {
        await this.db.insert(payrollLineItems).values(
          lineItems.map((item) => ({
            tenantId,
            recordId: record!.id,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            label: item.label,
            amount: item.amount,
            sortOrder: item.sortOrder,
            createdBy: actorUserId,
            updatedBy: actorUserId
          }))
        );
      }

      generated += 1;
    }

    await this.recalculateRunTotals(tenantId, runId);
    return { generated, resynced, runId };
  }

  async getRunSummary(tenantId: string, runId: string) {
    await this.getRunOrThrow(tenantId, runId);
    const records = await this.db
      .select()
      .from(payrollRecords)
      .where(and(eq(payrollRecords.tenantId, tenantId), eq(payrollRecords.runId, runId)));

    const netPayroll = records.reduce((s, r) => s + num(r.netAmount), 0);
    const paidOut = records
      .filter((r) => r.status === "paid")
      .reduce((s, r) => s + num(r.netAmount), 0);
    const pending = records
      .filter((r) => r.status !== "paid")
      .reduce((s, r) => s + num(r.netAmount), 0);
    const bonuses = records.reduce((s, r) => s + num(r.bonusesAmount), 0);

    return {
      netPayroll,
      paidOut,
      pending,
      bonuses,
      staffCount: records.length
    };
  }

  async listRunRecords(
    tenantId: string,
    runId: string,
    query: { search?: string; departmentId?: string; status?: string },
    actorUserId?: string
  ) {
    await this.getRunOrThrow(tenantId, runId);

    const filters = [
      eq(payrollRecords.tenantId, tenantId),
      eq(payrollRecords.runId, runId)
    ];

    if (query.status) {
      const status =
        query.status === "approved" ? "pending" : (query.status as "draft" | "pending" | "paid");
      filters.push(eq(payrollRecords.status, status));
    }

    const rows = await this.db
      .select({
        id: payrollRecords.id,
        staffId: payrollRecords.staffId,
        staffFullName: staff.fullName,
        staffEmail: staff.email,
        department: payrollRecords.departmentName,
        departmentId: staff.departmentId,
        baseSalary: payrollRecords.baseAmount,
        allowances: payrollRecords.allowancesAmount,
        bonus: payrollRecords.bonusesAmount,
        deductions: payrollRecords.deductionsAmount,
        netPay: payrollRecords.netAmount,
        status: payrollRecords.status
      })
      .from(payrollRecords)
      .leftJoin(staff, eq(payrollRecords.staffId, staff.id))
      .where(and(...filters));

    let result = rows.map((r) => ({
      ...r,
      baseSalary: num(r.baseSalary),
      allowances: num(r.allowances),
      bonus: num(r.bonus),
      deductions: num(r.deductions),
      netPay: num(r.netPay),
      status: r.status === "pending" ? "approved" : r.status
    }));

    if (query.departmentId) {
      result = result.filter((r) => r.departmentId === query.departmentId);
    }

    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.staffFullName?.toLowerCase().includes(q) ||
          r.staffEmail?.toLowerCase().includes(q) ||
          r.department?.toLowerCase().includes(q)
      );
    }

    return result;
  }

  private async getRecordOrThrow(tenantId: string, recordId: string) {
    const [record] = await this.db
      .select()
      .from(payrollRecords)
      .where(and(eq(payrollRecords.id, recordId), eq(payrollRecords.tenantId, tenantId)));
    if (!record) throw new NotFoundException("Payroll record not found.");
    return record;
  }

  async getPayrollRecord(tenantId: string, recordId: string, actorUserId?: string) {
    const record = await this.getRecordOrThrow(tenantId, recordId);
    const [run] = await this.db
      .select()
      .from(payrollRuns)
      .where(eq(payrollRuns.id, record.runId));

    const [freshRecord] = await this.db
      .select()
      .from(payrollRecords)
      .where(eq(payrollRecords.id, recordId));
    const syncedRecord = freshRecord ?? record;

    const [staffRow] = await this.db
      .select({
        fullName: staff.fullName,
        email: staff.email,
        department: staff.department,
        employmentRole: staff.employmentRole
      })
      .from(staff)
      .where(eq(staff.id, syncedRecord.staffId));

    const lines = await this.db
      .select()
      .from(payrollLineItems)
      .where(eq(payrollLineItems.recordId, recordId))
      .orderBy(payrollLineItems.sortOrder);

    const enabledPackageIds = new Set(
      lines.filter((l) => l.sourceType === "package" && l.sourceId).map((l) => l.sourceId!)
    );
    const enabledComponentIds = new Set(
      lines
        .filter((l) => (l.sourceType === "component" || l.sourceType === "deduction") && l.sourceId)
        .map((l) => l.sourceId!)
    );
    const enabledIncentiveIds = new Set(
      lines.filter((l) => l.sourceType === "incentive" && l.sourceId).map((l) => l.sourceId!)
    );
    const lineAmountBySource = new Map(
      lines.filter((l) => l.sourceId).map((l) => [l.sourceId!, num(l.amount)])
    );

    const comp = await this.getStaffCompensation(tenantId, syncedRecord.staffId);
    const baseSalary = comp.baseSalary;
    const readOnly = syncedRecord.status === "paid" || syncedRecord.status === "pending";

    const assignmentByComponentId = new Map(
      comp.payComponentAssignments.map((assignment) => [assignment.payComponentId, assignment])
    );

    const activeComponents = await this.db
      .select()
      .from(payComponents)
      .where(and(eq(payComponents.tenantId, tenantId), eq(payComponents.status, "active")));

    const availableComponents = activeComponents.map((component) => {
      const assignment = assignmentByComponentId.get(component.id);
      const lineAmount = lineAmountBySource.get(component.id);
      const amount =
        lineAmount ??
        this.calcComponentAmount(
          component,
          baseSalary,
          assignment ? assignment.amount : null
        );
      return {
        componentId: component.id,
        name: component.name,
        kind: component.kind,
        amount,
        enabled: enabledComponentIds.has(component.id)
      };
    });

    const activePackages = await this.db
      .select()
      .from(benefitPackages)
      .where(and(eq(benefitPackages.tenantId, tenantId), eq(benefitPackages.status, "active")));

    const availablePackages = activePackages.map((pkg) => ({
      packageId: pkg.id,
      name: pkg.name,
      icon: pkg.iconKey ?? "card_giftcard",
      amount: lineAmountBySource.get(pkg.id) ?? num(pkg.monthlyValue),
      enabled: enabledPackageIds.has(pkg.id)
    }));

    const matchingPrograms = run
      ? await this.listIncentiveProgramsForRun(tenantId, run)
      : [];

    const availableIncentives = matchingPrograms.map((program) => ({
      programId: program.id,
      name: program.name,
      description: program.description,
      amount:
        lineAmountBySource.get(program.id) ??
        this.resolveIncentiveAmount(program, baseSalary),
      enabled: enabledIncentiveIds.has(program.id)
    }));

    const salaryMonth = run
      ? `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`
      : "";

    const uiStatus = syncedRecord.status === "pending" ? "approved" : syncedRecord.status;

    const [settingsRow] = await this.db
      .select({
        schoolName: tenantSettings.schoolName,
        address: tenantSettings.address,
        contactPhone: tenantSettings.contactPhone
      })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId));
    const [tenantRow] = await this.db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    const schoolContact =
      [settingsRow?.address, settingsRow?.contactPhone].filter(Boolean).join(" · ") || null;

    return {
      id: syncedRecord.id,
      schoolName: settingsRow?.schoolName ?? tenantRow?.name ?? null,
      schoolContact,
      staffId: syncedRecord.staffId,
      staffFullName: staffRow?.fullName ?? null,
      staffEmail: staffRow?.email ?? null,
      staffRole: staffRow?.employmentRole ?? null,
      department: syncedRecord.departmentName ?? staffRow?.department ?? null,
      salaryMonth,
      baseSalary,
      allowances: num(syncedRecord.allowancesAmount),
      bonus: num(syncedRecord.bonusesAmount),
      deductions: num(syncedRecord.deductionsAmount),
      grossAmount:
        baseSalary + num(syncedRecord.allowancesAmount) + num(syncedRecord.bonusesAmount),
      netPay: num(syncedRecord.netAmount),
      status: uiStatus,
      readOnly,
      availableComponents,
      availablePackages,
      availableIncentives,
      lineItems: lines
        .filter((l) => l.sourceType !== "incentive")
        .map((l) => ({
          id: l.id,
          payComponentId: l.sourceId ?? l.id,
          name: l.label,
          componentType:
            l.sourceType === "deduction"
              ? "deduction"
              : l.sourceType === "package"
                ? "allowance"
                : "allowance",
          amount: num(l.amount)
        })),
      incentiveOverrides: lines
        .filter((l) => l.sourceType === "incentive")
        .map((l) => ({
          programId: l.sourceId ?? l.id,
          name: l.label,
          amount: num(l.amount),
          overridden: false
        }))
    };
  }

  async patchPayrollRecord(
    tenantId: string,
    recordId: string,
    actorUserId: string | undefined,
    dto: PatchPayrollRecordDto & {
      lineItems?: Array<{ id: string; amount: number }>;
      incentiveOverrides?: Array<{ programId: string; amount: number }>;
    }
  ) {
    const record = await this.getRecordOrThrow(tenantId, recordId);
    if (record.status === "paid" || record.status === "pending") {
      throw new BadRequestException("Approved or paid records cannot be adjusted.");
    }

    const hasStructuredPatch =
      dto.packageSelections !== undefined ||
      dto.incentiveSelections !== undefined ||
      dto.componentSelections !== undefined;

    if (hasStructuredPatch) {
      const comp = await this.getStaffCompensation(tenantId, record.staffId);
      const base = comp.baseSalary;

      const componentById = new Map(
        comp.payComponentAssignments.map((c) => [c.payComponentId, c])
      );

      const [run] = await this.db
        .select()
        .from(payrollRuns)
        .where(eq(payrollRuns.id, record.runId));

      const matchingPrograms = run
        ? await this.listIncentiveProgramsForRun(tenantId, run)
        : [];
      const programById = new Map(matchingPrograms.map((p) => [p.id, p]));

      const lineItems: Array<{
        sourceType: typeof payrollLineItems.sourceType._.data;
        sourceId: string | null;
        label: string;
        amount: string;
        sortOrder: number;
      }> = [];

      let sort = 0;

      if (dto.componentSelections) {
        for (const selection of dto.componentSelections) {
          if (!selection.enabled) continue;

          const [component] = await this.db
            .select()
            .from(payComponents)
            .where(
              and(
                eq(payComponents.id, selection.componentId),
                eq(payComponents.tenantId, tenantId)
              )
            );
          if (!component || component.status !== "active") continue;

          const assignment = componentById.get(selection.componentId);
          const amount =
            selection.amount !== undefined
              ? selection.amount
              : assignment
                ? assignment.amount
                : this.calcComponentAmount(component, base, null);
          lineItems.push({
            sourceType: component.kind === "deduction" ? "deduction" : "component",
            sourceId: component.id,
            label: component.name,
            amount: money(amount),
            sortOrder: sort++
          });
        }
      }

      if (dto.packageSelections) {
        for (const selection of dto.packageSelections) {
          if (!selection.enabled) continue;

          const [pkg] = await this.db
            .select()
            .from(benefitPackages)
            .where(
              and(
                eq(benefitPackages.id, selection.packageId),
                eq(benefitPackages.tenantId, tenantId)
              )
            );
          if (!pkg || pkg.status !== "active") continue;

          lineItems.push({
            sourceType: "package",
            sourceId: pkg.id,
            label: pkg.name,
            amount: money(num(pkg.monthlyValue)),
            sortOrder: sort++
          });
        }
      }

      if (dto.incentiveSelections) {
        for (const selection of dto.incentiveSelections) {
          if (!selection.enabled) continue;
          const program = programById.get(selection.programId);
          if (!program) continue;

          const amount = this.resolveIncentiveAmount(
            program,
            base,
            selection.amount
          );
          lineItems.push({
            sourceType: "incentive",
            sourceId: program.id,
            label: program.name,
            amount: money(amount),
            sortOrder: sort++
          });
        }
      }

      await this.db
        .delete(payrollLineItems)
        .where(eq(payrollLineItems.recordId, recordId));

      const totals = this.sumLineItemTotals(lineItems, base);

      await this.db
        .update(payrollRecords)
        .set({
          baseAmount: money(base),
          allowancesAmount: money(totals.allowances),
          bonusesAmount: money(totals.bonuses),
          deductionsAmount: money(totals.deductions),
          netAmount: money(totals.net),
          updatedBy: actorUserId,
          updatedAt: new Date()
        })
        .where(eq(payrollRecords.id, recordId));

      if (lineItems.length > 0) {
        await this.db.insert(payrollLineItems).values(
          lineItems.map((item) => ({
            tenantId,
            recordId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            label: item.label,
            amount: item.amount,
            sortOrder: item.sortOrder,
            createdBy: actorUserId,
            updatedBy: actorUserId
          }))
        );
      }

      await this.recalculateRunTotals(tenantId, record.runId);
      return this.getPayrollRecord(tenantId, recordId);
    }

    if (dto.lineItems?.length) {
      for (const item of dto.lineItems) {
        await this.db
          .update(payrollLineItems)
          .set({ amount: money(item.amount), updatedBy: actorUserId, updatedAt: new Date() })
          .where(
            and(eq(payrollLineItems.id, item.id), eq(payrollLineItems.recordId, recordId))
          );
      }
    }

    if (dto.incentiveOverrides?.length) {
      for (const override of dto.incentiveOverrides) {
        await this.db
          .update(payrollLineItems)
          .set({ amount: money(override.amount), updatedBy: actorUserId, updatedAt: new Date() })
          .where(
            and(
              eq(payrollLineItems.recordId, recordId),
              eq(payrollLineItems.sourceType, "incentive"),
              eq(payrollLineItems.sourceId, override.programId)
            )
          );
      }
    }

    if (dto.adjustments?.length) {
      for (const adj of dto.adjustments) {
        await this.db.insert(payrollLineItems).values({
          tenantId,
          recordId,
          sourceType: adj.sourceType ?? "adjustment",
          label: adj.label,
          amount: money(adj.amount),
          createdBy: actorUserId,
          updatedBy: actorUserId
        });
      }
    }

    await this.recalculateRecordTotals(tenantId, recordId);
    return this.getPayrollRecord(tenantId, recordId);
  }

  private async recalculateRecordTotals(tenantId: string, recordId: string) {
    const record = await this.getRecordOrThrow(tenantId, recordId);
    const lines = await this.db
      .select()
      .from(payrollLineItems)
      .where(eq(payrollLineItems.recordId, recordId));

    let allowances = 0;
    let deductions = 0;
    let bonuses = 0;

    for (const line of lines) {
      const amount = num(line.amount);
      if (line.sourceType === "deduction") deductions += amount;
      else if (line.sourceType === "incentive") bonuses += amount;
      else if (line.sourceType === "component" || line.sourceType === "package") allowances += amount;
      else if (line.sourceType === "adjustment") allowances += amount;
    }

    const base = num(record.baseAmount);
    const net = base + allowances + bonuses - deductions;

    await this.db
      .update(payrollRecords)
      .set({
        allowancesAmount: money(allowances),
        bonusesAmount: money(bonuses),
        deductionsAmount: money(deductions),
        netAmount: money(net),
        updatedAt: new Date()
      })
      .where(eq(payrollRecords.id, recordId));

    await this.recalculateRunTotals(tenantId, record.runId);
  }

  private async recalculateRunTotals(tenantId: string, runId: string) {
    const records = await this.db
      .select()
      .from(payrollRecords)
      .where(and(eq(payrollRecords.tenantId, tenantId), eq(payrollRecords.runId, runId)));

    const totalNet = records.reduce((s, r) => s + num(r.netAmount), 0);
    const totalPaid = records
      .filter((r) => r.status === "paid")
      .reduce((s, r) => s + num(r.netAmount), 0);
    const totalPending = records
      .filter((r) => r.status !== "paid")
      .reduce((s, r) => s + num(r.netAmount), 0);
    const totalBonuses = records.reduce((s, r) => s + num(r.bonusesAmount), 0);

    await this.db
      .update(payrollRuns)
      .set({
        totalNet: money(totalNet),
        totalPaid: money(totalPaid),
        totalPending: money(totalPending),
        totalBonuses: money(totalBonuses),
        updatedAt: new Date()
      })
      .where(eq(payrollRuns.id, runId));
  }

  async approvePayrollRecord(
    tenantId: string,
    recordId: string,
    actorUserId: string | undefined,
    _dto: ApprovePayrollRecordDto
  ) {
    const record = await this.getRecordOrThrow(tenantId, recordId);
    const [updated] = await this.db
      .update(payrollRecords)
      .set({
        status: "pending",
        approvedByUserId: actorUserId ?? null,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(eq(payrollRecords.id, recordId))
      .returning();

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "payroll_record.approve",
      recordType: "PayrollRecord",
      recordId,
      before: { status: record.status },
      after: { status: "pending" }
    });

    return this.getPayrollRecord(tenantId, updated!.id);
  }

  async markPayrollPaid(
    tenantId: string,
    recordId: string,
    actorUserId: string | undefined,
    dto: MarkPayrollPaidDto
  ) {
    const record = await this.getRecordOrThrow(tenantId, recordId);
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    await this.db
      .update(payrollRecords)
      .set({
        status: "paid",
        paidAt,
        paymentMethod: dto.paymentMethod,
        paymentRef: dto.paymentRef ?? null,
        updatedBy: actorUserId,
        updatedAt: new Date()
      })
      .where(eq(payrollRecords.id, recordId));

    await this.recalculateRunTotals(tenantId, record.runId);

    await this.auditService.recordEvent({
      tenantId,
      actorUserId: actorUserId ?? null,
      action: "payroll_record.mark_paid",
      recordType: "PayrollRecord",
      recordId,
      before: { status: record.status },
      after: { status: "paid", paidAt: paidAt.toISOString() }
    });

    await this.payslipQueue.enqueueRenderPayslipPdf({
      tenantId,
      payrollRecordId: recordId
    });

    return this.getPayrollRecord(tenantId, recordId);
  }

  async enqueuePayslip(tenantId: string, recordId: string) {
    const record = await this.getRecordOrThrow(tenantId, recordId);
    if (record.status !== "paid") {
      throw new BadRequestException("Payslip is only available for paid records.");
    }
    await this.payslipQueue.enqueueRenderPayslipPdf({ tenantId, payrollRecordId: recordId });
    return { queued: true };
  }

  async downloadPayslip(tenantId: string, recordId: string): Promise<StreamableFile> {
    const record = await this.getRecordOrThrow(tenantId, recordId);
    if (record.status !== "paid") {
      throw new BadRequestException("Payslip is only available for paid records.");
    }

    const key = await this.payslipRender.ensurePayslip(tenantId, recordId);
    const buffer = await this.storage.getObject(key);
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: `attachment; filename="payslip-${recordId}.pdf"`
    });
  }
}
