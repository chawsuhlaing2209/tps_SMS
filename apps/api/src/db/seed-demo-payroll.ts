import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
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
  staffCompensationProfiles
} from "./schema.js";

type Db = ReturnType<typeof drizzle>;

const DEFAULT_COMPONENTS = [
  { code: "meal", name: "Meal allowance", kind: "earning" as const, defaultAmount: "50000" },
  { code: "ferry", name: "Ferry allowance", kind: "earning" as const, defaultAmount: "80000" },
  { code: "ssb", name: "SSB", kind: "deduction" as const, defaultAmount: "30000" },
  { code: "health", name: "Health insurance", kind: "deduction" as const, defaultAmount: "20000" }
];

/** Base salary lives on staff_compensation_profiles.base_salary, not pay_components. */
async function removeLegacyBasicPayComponent(db: Db, tenantId: string) {
  const [basic] = await db
    .select({ id: payComponents.id })
    .from(payComponents)
    .where(and(eq(payComponents.tenantId, tenantId), eq(payComponents.code, "basic")))
    .limit(1);

  if (!basic) {
    return;
  }

  await db
    .delete(staffCompensationComponents)
    .where(
      and(
        eq(staffCompensationComponents.tenantId, tenantId),
        eq(staffCompensationComponents.componentId, basic.id)
      )
    );

  await db
    .delete(payComponents)
    .where(and(eq(payComponents.tenantId, tenantId), eq(payComponents.id, basic.id)));
}

function num(value: string | null | undefined): number {
  return Number(value ?? 0);
}

export async function seedDemoPayroll(db: Db, tenantId: string, staffIds: string[]) {
  await removeLegacyBasicPayComponent(db, tenantId);

  const componentIds = new Map<string, string>();

  for (const component of DEFAULT_COMPONENTS) {
    const [existing] = await db
      .select({ id: payComponents.id })
      .from(payComponents)
      .where(and(eq(payComponents.tenantId, tenantId), eq(payComponents.code, component.code)));

    if (existing) {
      componentIds.set(component.code, existing.id);
      continue;
    }

    const [created] = await db
      .insert(payComponents)
      .values({
        tenantId,
        code: component.code,
        name: component.name,
        kind: component.kind,
        defaultAmount: component.defaultAmount,
        status: "active"
      })
      .returning({ id: payComponents.id });

    componentIds.set(component.code, created!.id);
  }

  const packageSpecs = [
    {
      name: "Transport package",
      description: "Monthly ferry and travel support",
      monthlyValue: "80000",
      iconKey: "directions_bus",
      eligibilityScope: "all_staff" as const
    },
    {
      name: "Meal support",
      description: "Daily meal allowance for teaching staff",
      monthlyValue: "50000",
      iconKey: "restaurant",
      eligibilityScope: "teachers" as const
    }
  ];

  const packageIds: string[] = [];
  for (const spec of packageSpecs) {
    const [existing] = await db
      .select({ id: benefitPackages.id })
      .from(benefitPackages)
      .where(and(eq(benefitPackages.tenantId, tenantId), eq(benefitPackages.name, spec.name)));

    if (existing) {
      packageIds.push(existing.id);
      continue;
    }

    const [created] = await db
      .insert(benefitPackages)
      .values({ tenantId, ...spec, status: "active" })
      .returning({ id: benefitPackages.id });
    packageIds.push(created!.id);
  }

  const programSpecs = [
    {
      name: "Monthly performance",
      cadence: "per_payroll" as const,
      awardType: "fixed" as const,
      awardAmount: "100000",
      description: "Monthly performance allowance"
    },
    {
      name: "Term excellence",
      cadence: "term" as const,
      awardType: "fixed" as const,
      awardAmount: "250000",
      description: "End-of-term bonus for eligible staff"
    },
    {
      name: "Long service",
      cadence: "annual" as const,
      awardType: "fixed" as const,
      awardAmount: "500000",
      description: "Annual long-service recognition"
    }
  ];

  for (const spec of programSpecs) {
    const [existing] = await db
      .select({ id: incentivePrograms.id })
      .from(incentivePrograms)
      .where(and(eq(incentivePrograms.tenantId, tenantId), eq(incentivePrograms.name, spec.name)));

    if (existing) continue;

    await db.insert(incentivePrograms).values({ tenantId, ...spec, status: "active" });
  }

  const profileBaseByStaff = new Map<string, string>();
  const activeStaff = staffIds.slice(0, 6);
  for (const [index, staffId] of activeStaff.entries()) {
    const baseSalary = index === 0 ? "950000" : index === 1 ? "800000" : "650000";
    profileBaseByStaff.set(staffId, baseSalary);

    const [profile] = await db
      .insert(staffCompensationProfiles)
      .values({ tenantId, staffId, baseSalary, currency: "MMK" })
      .onConflictDoNothing()
      .returning({ id: staffCompensationProfiles.id });

    const profileId =
      profile?.id ??
      (
        await db
          .select({ id: staffCompensationProfiles.id })
          .from(staffCompensationProfiles)
          .where(
            and(
              eq(staffCompensationProfiles.tenantId, tenantId),
              eq(staffCompensationProfiles.staffId, staffId)
            )
          )
      )[0]?.id;

    if (profileId) {
      for (const code of ["meal", "ferry", "ssb", "health"]) {
        const componentId = componentIds.get(code);
        if (!componentId) continue;
        await db
          .insert(staffCompensationComponents)
          .values({ tenantId, profileId, componentId })
          .onConflictDoNothing();
      }
    }

    if (packageIds[0]) {
      await db
        .insert(staffBenefitEnrollments)
        .values({
          tenantId,
          staffId,
          packageId: packageIds[0]!,
          effectiveFrom: "2026-01-01"
        })
        .onConflictDoNothing();
    }
  }

  const [existingRun] = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.tenantId, tenantId),
        eq(payrollRuns.periodYear, 2026),
        eq(payrollRuns.periodMonth, 6)
      )
    );

  let runId = existingRun?.id;
  if (!runId) {
    const [run] = await db
      .insert(payrollRuns)
      .values({
        tenantId,
        periodYear: 2026,
        periodMonth: 6,
        status: "draft"
      })
      .returning({ id: payrollRuns.id });
    runId = run!.id;
  }

  const staffRows = await db
    .select({ id: staff.id, department: staff.department, fullName: staff.fullName })
    .from(staff)
    .where(and(eq(staff.tenantId, tenantId), eq(staff.status, "active")));

  const profiles = await db
    .select({
      staffId: staffCompensationProfiles.staffId,
      baseSalary: staffCompensationProfiles.baseSalary,
      profileId: staffCompensationProfiles.id
    })
    .from(staffCompensationProfiles)
    .where(eq(staffCompensationProfiles.tenantId, tenantId));

  const profileByStaff = new Map(profiles.map((p) => [p.staffId, p]));

  let profileIndex = 0;
  for (const member of staffRows) {
    const [existingRecord] = await db
      .select({ id: payrollRecords.id })
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.tenantId, tenantId),
          eq(payrollRecords.runId, runId!),
          eq(payrollRecords.staffId, member.id)
        )
      );

    if (existingRecord) continue;

    const profile = profileByStaff.get(member.id);
    const base = profile ? num(profile.baseSalary) : 0;

    let allowances = 0;
    let deductions = 0;
    const lineItems: Array<{
      sourceType: "component" | "deduction" | "package";
      label: string;
      amount: string;
      sortOrder: number;
      sourceId?: string;
    }> = [];

    if (profile) {
      const components = await db
        .select({
          name: payComponents.name,
          kind: payComponents.kind,
          defaultAmount: payComponents.defaultAmount,
          componentId: staffCompensationComponents.componentId
        })
        .from(staffCompensationComponents)
        .innerJoin(payComponents, eq(staffCompensationComponents.componentId, payComponents.id))
        .where(eq(staffCompensationComponents.profileId, profile.profileId));

      let sort = 0;
      for (const component of components) {
        const amount = num(component.defaultAmount);
        const sourceType = component.kind === "deduction" ? "deduction" : "component";
        if (sourceType === "deduction") deductions += amount;
        else allowances += amount;
        lineItems.push({
          sourceType,
          label: component.name,
          amount: amount.toFixed(2),
          sortOrder: sort++,
          sourceId: component.componentId
        });
      }

      const enrollments = await db
        .select({
          name: benefitPackages.name,
          monthlyValue: benefitPackages.monthlyValue,
          packageId: staffBenefitEnrollments.packageId
        })
        .from(staffBenefitEnrollments)
        .innerJoin(benefitPackages, eq(staffBenefitEnrollments.packageId, benefitPackages.id))
        .where(
          and(
            eq(staffBenefitEnrollments.tenantId, tenantId),
            eq(staffBenefitEnrollments.staffId, member.id)
          )
        );

      for (const enrollment of enrollments) {
        const amount = num(enrollment.monthlyValue);
        allowances += amount;
        lineItems.push({
          sourceType: "package",
          label: enrollment.name,
          amount: amount.toFixed(2),
          sortOrder: lineItems.length,
          sourceId: enrollment.packageId
        });
      }
    }

    const status =
      profile && profileIndex === 0 ? "paid" : profile && profileIndex === 1 ? "pending" : "draft";
    if (profile) profileIndex += 1;

    const net = base + allowances - deductions;

    const [record] = await db
      .insert(payrollRecords)
      .values({
        tenantId,
        runId: runId!,
        staffId: member.id,
        departmentName: member.department,
        baseAmount: base.toFixed(2),
        allowancesAmount: allowances.toFixed(2),
        bonusesAmount: "0.00",
        deductionsAmount: deductions.toFixed(2),
        netAmount: net.toFixed(2),
        status,
        paidAt: status === "paid" ? new Date("2026-06-15T10:00:00Z") : null,
        paymentMethod: status === "paid" ? "bank_transfer" : null
      })
      .returning({ id: payrollRecords.id });

    if (lineItems.length > 0) {
      await db.insert(payrollLineItems).values(
        lineItems.map((item) => ({
          tenantId,
          recordId: record!.id,
          sourceType: item.sourceType,
          sourceId: item.sourceId ?? null,
          label: item.label,
          amount: item.amount,
          sortOrder: item.sortOrder
        }))
      );
    }
  }

  console.log("  payroll        components, packages, June 2026 run seeded");
}
