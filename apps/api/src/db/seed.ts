import { config } from "dotenv";
import { buildInvoiceNumber, rolePermissions, roles as roleKeys } from "@sms/shared";
import argon2 from "argon2";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  academicYears,
  attendanceSessions,
  classroomSubjectTeachers,
  classroomStudents,
  classrooms,
  discountRules,
  enrollmentFeePlans,
  enrollmentFeePlanGrades,
  enrollments,
  feeItems,
  gradeChiefAssignments,
  gradeSubjects,
  grades,
  invoiceItems,
  invoices,
  paymentPlanInstallments,
  paymentPlans,
  payments,
  receipts,
  roles,
  schoolOperatingHourBlocks,
  schoolScheduleSettings,
  staff,
  students,
  subjects,
  teachingSectorGrades,
  teachingSectors,
  tenantSettings,
  tenants,
  timetablePeriods,
  userRoles,
  users
} from "./schema.js";
import { buildPeriodRowsFromSchedule } from "../school-schedule/school-schedule.service.js";
import { seedAcademicCatalog } from "./seed-academic-catalog.js";
import { seedDemoClassroomAssignments } from "./seed-demo-classroom-assignments.js";
import { seedFacilityRooms } from "./seed-facility-rooms.js";
import { seedDemoTimetable } from "./seed-demo-timetable.js";
import { printDemoAlphaCredentials, seedDemoAlpha } from "./seed-demo-alpha.js";
import { seedDemoTeachers } from "./seed-demo-teachers.js";
import { seedDemoEnquiries } from "./seed-demo-enquiries.js";
import { seedDepartments } from "./seed-departments.js";

// Load env from the API folder first, then the repo root.
config();
config({ path: "../../.env" });

const demoTenants = [
  { name: "Demo Alpha Academy", slug: "demo-alpha" },
  { name: "Demo Beta International", slug: "demo-beta" }
] as const;

// Default password for seeded demo owners so they can sign in immediately.
// Intended for local development only.
const DEMO_OWNER_PASSWORD = "ChangeMe123!";
const PLATFORM_ADMIN_EMAIL = "platform-admin@example.edu.mm";

async function seedPlatformAdmin(db: ReturnType<typeof drizzle>, passwordHash: string) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(isNull(users.tenantId), eq(users.email, PLATFORM_ADMIN_EMAIL)));

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, status: "active", displayName: "Platform Super Admin" })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const [admin] = await db
    .insert(users)
    .values({
      tenantId: null,
      email: PLATFORM_ADMIN_EMAIL,
      displayName: "Platform Super Admin",
      status: "active",
      passwordHash
    })
    .returning({ id: users.id });

  return admin?.id;
}

async function seedTeachingSectors(db: ReturnType<typeof drizzle>, tenantId: string) {
  const gradeRows = await db
    .select({ id: grades.id, sortOrder: grades.sortOrder })
    .from(grades)
    .where(and(eq(grades.tenantId, tenantId), eq(grades.status, "active")))
    .orderBy(grades.sortOrder);

  if (!gradeRows.length) {
    return;
  }

  const sectorDefs = [
    { name: "Primary", sortOrder: 1, maxSortOrder: 5 },
    { name: "Middle", sortOrder: 2, minSortOrder: 6, maxSortOrder: 9 },
    { name: "High", sortOrder: 3, minSortOrder: 10, maxSortOrder: 99 }
  ];

  for (const def of sectorDefs) {
    const [sector] = await db
      .insert(teachingSectors)
      .values({
        tenantId,
        name: def.name,
        sortOrder: def.sortOrder,
        status: "active"
      })
      .onConflictDoNothing()
      .returning({ id: teachingSectors.id });

    const sectorId =
      sector?.id ??
      (
        await db
          .select({ id: teachingSectors.id })
          .from(teachingSectors)
          .where(and(eq(teachingSectors.tenantId, tenantId), eq(teachingSectors.name, def.name)))
      )[0]?.id;

    if (!sectorId) {
      continue;
    }

    const matchedGrades = gradeRows.filter((grade) => {
      const order = grade.sortOrder ?? 0;
      const min = def.minSortOrder ?? 0;
      const max = def.maxSortOrder ?? 99;
      return order >= min && order <= max;
    });

    const gradeIds = matchedGrades.length ? matchedGrades.map((row) => row.id) : [gradeRows[0]!.id];

    for (const gradeId of gradeIds) {
      await db
        .insert(teachingSectorGrades)
        .values({ tenantId, sectorId, gradeId })
        .onConflictDoNothing();
    }
  }
}

async function seedDemoClassroomData(
  db: ReturnType<typeof drizzle>,
  tenantId: string,
  slug: string,
  passwordHash: string
) {
  const [year] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.name, "2026-2027")));

  const [grade] = await db
    .select({ id: grades.id })
    .from(grades)
    .where(and(eq(grades.tenantId, tenantId), eq(grades.name, "Grade 1")));

  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.tenantId, tenantId), eq(subjects.code, "MATH")));

  if (!year?.id || !grade?.id || !subject?.id) {
    return;
  }

  const [existingMapping] = await db
    .select({ id: gradeSubjects.id })
    .from(gradeSubjects)
    .where(
      and(
        eq(gradeSubjects.tenantId, tenantId),
        eq(gradeSubjects.academicYearId, year.id),
        eq(gradeSubjects.gradeId, grade.id),
        eq(gradeSubjects.subjectId, subject.id)
      )
    );

  if (!existingMapping) {
    await db.insert(gradeSubjects).values({
      tenantId,
      academicYearId: year.id,
      gradeId: grade.id,
      subjectId: subject.id
    });
  }

  const teacherEmail = `teacher@${slug}.example.edu.mm`;

  const [teacherUser] = await db
    .insert(users)
    .values({
      tenantId,
      email: teacherEmail,
      displayName: "Demo Teacher",
      status: "active",
      passwordHash
    })
    .onConflictDoUpdate({
      target: [users.tenantId, users.email],
      set: { status: "active", passwordHash, displayName: "Demo Teacher" }
    })
    .returning({ id: users.id });

  const [teacherRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.key, "teacher")));

  if (teacherUser && teacherRole) {
    await db
      .insert(userRoles)
      .values({ tenantId, userId: teacherUser.id, roleId: teacherRole.id })
      .onConflictDoNothing();
  }

  let staffId: string | undefined;
  if (teacherUser) {
    const [existingStaff] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.userId, teacherUser.id)));

    if (existingStaff) {
      staffId = existingStaff.id;
    } else {
      const [createdStaff] = await db
        .insert(staff)
        .values({
          tenantId,
          userId: teacherUser.id,
          fullName: "Demo Teacher",
          employmentRole: "teacher",
          status: "active"
        })
        .returning({ id: staff.id });
      staffId = createdStaff?.id;
    }
  }

  const ensureClassroom = async (name: string) => {
    const [existing] = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.name, name)));

    if (existing) {
      await db
        .update(classrooms)
        .set({ academicYearId: year.id, gradeId: grade.id, status: "active" })
        .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, existing.id)));
      return existing.id;
    }

    const [created] = await db
      .insert(classrooms)
      .values({
        tenantId,
        academicYearId: year.id,
        gradeId: grade.id,
        name,
        room: name === "Room A" ? "Room 101" : "Room 102",
        capacity: 30,
        status: "active"
      })
      .returning({ id: classrooms.id });

    return created?.id;
  };

  const classroomAId = await ensureClassroom("Room A");
  const classroomBId = await ensureClassroom("Room B");

  if (staffId && classroomAId) {
    await db
      .update(classrooms)
      .set({ classTeacherStaffId: staffId })
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomAId)));

    await db
      .insert(gradeChiefAssignments)
      .values({
        tenantId,
        academicYearId: year.id,
        gradeId: grade.id,
        staffId
      })
      .onConflictDoNothing();

    await db
      .insert(classroomSubjectTeachers)
      .values({
        tenantId,
        classroomId: classroomAId,
        subjectId: subject.id,
        teacherStaffId: staffId
      })
      .onConflictDoNothing();

    const [existingSession] = await db
      .select({ id: attendanceSessions.id })
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, tenantId),
          eq(attendanceSessions.classroomId, classroomAId),
          eq(attendanceSessions.sessionDate, "2026-06-15")
        )
      );

    if (!existingSession) {
      await db.insert(attendanceSessions).values({
        tenantId,
        classroomId: classroomAId,
        subjectId: subject.id,
        sessionDate: "2026-06-15",
        submittedByStaffId: staffId,
        submittedAt: new Date()
      });
    }
  }

  if (classroomBId) {
    const [existingSessionB] = await db
      .select({ id: attendanceSessions.id })
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, tenantId),
          eq(attendanceSessions.classroomId, classroomBId),
          eq(attendanceSessions.sessionDate, "2026-06-16")
        )
      );

    if (!existingSessionB) {
      await db.insert(attendanceSessions).values({
        tenantId,
        classroomId: classroomBId,
        subjectId: subject.id,
        sessionDate: "2026-06-16"
      });
    }
  }

  await seedDemoEnrollmentBilling(db, tenantId, year.id, grade.id, classroomAId);
  await seedDemoPaymentPlans(db, tenantId);
}

const DEMO_TUITION_BY_GRADE: Record<string, string> = {
  KG: "850000",
  "Grade 1": "500000",
  "Grade 2": "520000",
  "Grade 3": "540000",
  "Grade 4": "560000",
  "Grade 5": "1000000",
  "Grade 6": "620000",
  "Grade 7": "640000",
  "Grade 8": "660000",
  "Grade 9": "1100000",
  "Grade 10": "1200000",
  "Grade 11": "1300000",
  "Grade 12": "1400000"
};

async function seedDemoEnrollmentBillingAllGrades(
  db: ReturnType<typeof drizzle>,
  tenantId: string,
  academicYearId: string,
  gradeIds: Map<string, string>
) {
  const ensureFeeItem = async (name: string, feeType: string, billingType: string) => {
    const [existing] = await db
      .select({ id: feeItems.id })
      .from(feeItems)
      .where(and(eq(feeItems.tenantId, tenantId), eq(feeItems.name, name)));

    if (existing) {
      return existing.id;
    }

    const [created] = await db
      .insert(feeItems)
      .values({ tenantId, name, feeType, billingType, status: "active" })
      .returning({ id: feeItems.id });

    return created!.id;
  };

  const registrationId = await ensureFeeItem("Registration Fee", "registration", "one_time");
  const transportId = await ensureFeeItem("School Transport", "transport", "monthly");

  const sharedPlans = [
    { feeItemId: registrationId, amount: "50000" },
    { feeItemId: transportId, amount: "40000" }
  ];

  const ensurePlanGrade = async (feeItemId: string, amount: string, gradeId: string) => {
    const [existingPlan] = await db
      .select({ id: enrollmentFeePlans.id })
      .from(enrollmentFeePlans)
      .where(
        and(
          eq(enrollmentFeePlans.tenantId, tenantId),
          eq(enrollmentFeePlans.academicYearId, academicYearId),
          eq(enrollmentFeePlans.feeItemId, feeItemId),
          eq(enrollmentFeePlans.amount, amount)
        )
      );

    const planId =
      existingPlan?.id ??
      (
        await db
          .insert(enrollmentFeePlans)
          .values({ tenantId, academicYearId, feeItemId, amount })
          .returning({ id: enrollmentFeePlans.id })
      )[0]?.id;

    if (!planId) return;

    const [existingGrade] = await db
      .select({ id: enrollmentFeePlanGrades.id })
      .from(enrollmentFeePlanGrades)
      .where(
        and(
          eq(enrollmentFeePlanGrades.tenantId, tenantId),
          eq(enrollmentFeePlanGrades.planId, planId),
          eq(enrollmentFeePlanGrades.gradeId, gradeId)
        )
      );

    if (!existingGrade) {
      await db.insert(enrollmentFeePlanGrades).values({ tenantId, planId, gradeId });
    }
  };

  // One reusable "Tuition" component with per-grade amounts (grades that share
  // an amount share a plan via ensurePlanGrade), instead of a component per grade.
  const tuitionId = await ensureFeeItem("Tuition", "tuition", "one_time");
  for (const [gradeName, gradeId] of gradeIds) {
    const tuitionAmount = DEMO_TUITION_BY_GRADE[gradeName] ?? "500000";
    await ensurePlanGrade(tuitionId, tuitionAmount, gradeId);
    for (const plan of sharedPlans) {
      await ensurePlanGrade(plan.feeItemId, plan.amount, gradeId);
    }
  }

  await seedDemoPaymentPlans(db, tenantId);
}

/** Default school hours + generated lesson periods for the active academic year. */
async function seedTimetableSchedule(
  db: ReturnType<typeof drizzle>,
  tenantId: string,
  academicYearId: string,
  actorUserId: string | null
) {
  const [existingPeriod] = await db
    .select({ id: timetablePeriods.id })
    .from(timetablePeriods)
    .where(
      and(
        eq(timetablePeriods.tenantId, tenantId),
        eq(timetablePeriods.academicYearId, academicYearId)
      )
    )
    .limit(1);

  if (existingPeriod) {
    return;
  }

  const [existingSettings] = await db
    .select({ id: schoolScheduleSettings.id })
    .from(schoolScheduleSettings)
    .where(eq(schoolScheduleSettings.tenantId, tenantId))
    .limit(1);

  if (!existingSettings) {
    await db.insert(schoolScheduleSettings).values({
      tenantId,
      shortBreakStartsAt: "10:15",
      shortBreakEndsAt: "10:30",
      lunchBreakStartsAt: "12:00",
      lunchBreakEndsAt: "13:00",
      periodDurationMinutes: 45,
      workingDays: [1, 2, 3, 4, 5],
      createdBy: actorUserId,
      updatedBy: actorUserId
    });
  }

  const [existingBlock] = await db
    .select({ id: schoolOperatingHourBlocks.id })
    .from(schoolOperatingHourBlocks)
    .where(eq(schoolOperatingHourBlocks.tenantId, tenantId))
    .limit(1);

  let blockId = existingBlock?.id;

  if (!blockId) {
    const [block] = await db
      .insert(schoolOperatingHourBlocks)
      .values({
        tenantId,
        label: "Regular school day",
        startsAt: "08:00",
        endsAt: "15:00",
        isPrimary: true,
        sortOrder: 0,
        createdBy: actorUserId,
        updatedBy: actorUserId
      })
      .returning({ id: schoolOperatingHourBlocks.id });
    blockId = block?.id;
  }

  if (!blockId || !actorUserId) {
    return;
  }

  const rows = buildPeriodRowsFromSchedule({
    tenantId,
    academicYearId,
    actorUserId,
    periodDurationMinutes: 45,
    shortBreakStartsAt: "10:15",
    shortBreakEndsAt: "10:30",
    lunchBreakStartsAt: "12:00",
    lunchBreakEndsAt: "13:00",
    blocks: [
      {
        id: blockId,
        label: "Regular school day",
        startsAt: "08:00",
        endsAt: "15:00",
        isPrimary: true,
        sortOrder: 0
      }
    ]
  });

  if (rows.length) {
    await db.insert(timetablePeriods).values(rows);
  }
}

/**
 * Links legacy seeded invoices to enrollments so finance list/payment APIs resolve grade and year.
 */
async function backfillBillingInvoiceLinks(
  db: ReturnType<typeof drizzle>,
  tenantId: string,
  studentId: string,
  academicYearId: string,
  gradeId: string
) {
  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.gradeId, gradeId),
        eq(enrollments.status, "approved")
      )
    );

  if (!enrollment) return;

  const [student] = await db
    .select({ familyGroupId: students.familyGroupId })
    .from(students)
    .where(and(eq(students.tenantId, tenantId), eq(students.id, studentId)));

  await db
    .update(invoices)
    .set({
      enrollmentId: enrollment.id,
      familyGroupId: student?.familyGroupId ?? null
    })
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, studentId),
        isNull(invoices.enrollmentId)
      )
    );

  const openInvoices = await db
    .select({ id: invoices.id, dueDate: invoices.dueDate, status: invoices.status })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        eq(invoices.studentId, studentId),
        eq(invoices.status, "unpaid")
      )
    );

  const today = new Date().toISOString().slice(0, 10);
  for (const invoice of openInvoices) {
    if (invoice.dueDate && invoice.dueDate < today) {
      await db
        .update(invoices)
        .set({ status: "overdue" })
        .where(eq(invoices.id, invoice.id));
    }
  }

  const invoiceRows = await db
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, studentId)));

  for (const invoice of invoiceRows) {
    const [payment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.invoiceId, invoice.id),
          eq(payments.kind, "payment")
        )
      );

    if (!payment) continue;

    const [existingReceipt] = await db
      .select({ id: receipts.id })
      .from(receipts)
      .where(and(eq(receipts.tenantId, tenantId), eq(receipts.paymentId, payment.id)));

    if (!existingReceipt) {
      const suffix = invoice.invoiceNumber.split("-").pop() ?? payment.id.slice(0, 6);
      await db.insert(receipts).values({
        tenantId,
        paymentId: payment.id,
        receiptNumber: `PKR-${suffix}`,
        issuedAt: new Date("2026-06-12T03:00:00Z")
      });
    }
  }
}

async function seedDemoPaymentPlans(db: ReturnType<typeof drizzle>, tenantId: string) {
  const ensurePlan = async (
    name: string,
    description: string,
    frequency: string,
    status: "active" | "inactive",
    sortOrder: number,
    installments: Array<{ label: string; dueDate: string; installmentCount?: number }>
  ) => {
    const [existing] = await db
      .select({ id: paymentPlans.id })
      .from(paymentPlans)
      .where(and(eq(paymentPlans.tenantId, tenantId), eq(paymentPlans.name, name)));

    if (existing) {
      return existing.id;
    }

    const [created] = await db
      .insert(paymentPlans)
      .values({ tenantId, name, description, frequency, status, sortOrder })
      .returning({ id: paymentPlans.id });

    await db.insert(paymentPlanInstallments).values(
      installments.map((item, index) => ({
        tenantId,
        planId: created!.id,
        label: item.label,
        dueDate: item.dueDate,
        installmentCount: item.installmentCount ?? null,
        sortOrder: index
      }))
    );

    return created!.id;
  };

  await ensurePlan(
    "Annual",
    "One full payment at the start of the academic year.",
    "annual",
    "active",
    0,
    [{ label: "Full payment due", dueDate: "1 Jun 2026" }]
  );

  await ensurePlan(
    "Term",
    "Three equal installments, one per term.",
    "term",
    "active",
    1,
    [
      { label: "Term 1", dueDate: "1 Jun 2026" },
      { label: "Term 2", dueDate: "1 Oct 2026" },
      { label: "Term 3", dueDate: "1 Feb 2027" }
    ]
  );

  await ensurePlan(
    "Monthly",
    "Twelve monthly installments grouped by collection period.",
    "monthly",
    "inactive",
    2,
    [
      { label: "Jun–Aug 2026 (3×)", dueDate: "1 Jun 2026", installmentCount: 3 },
      { label: "Sep–Dec 2026 (4×)", dueDate: "1 Sep 2026", installmentCount: 4 },
      { label: "Jan–Mar 2027 (3×)", dueDate: "1 Jan 2027", installmentCount: 3 }
    ]
  );
}

async function seedDemoEnrollmentBilling(
  db: ReturnType<typeof drizzle>,
  tenantId: string,
  academicYearId: string,
  gradeId: string,
  classroomId: string | undefined
) {
  if (!classroomId) {
    return;
  }

  const ensureFeeItem = async (name: string, feeType: string, billingType: string) => {
    const [existing] = await db
      .select({ id: feeItems.id })
      .from(feeItems)
      .where(and(eq(feeItems.tenantId, tenantId), eq(feeItems.name, name)));

    if (existing) {
      return existing.id;
    }

    const [created] = await db
      .insert(feeItems)
      .values({ tenantId, name, feeType, billingType, status: "active" })
      .returning({ id: feeItems.id });

    return created!.id;
  };

  const tuitionId = await ensureFeeItem("Tuition", "tuition", "one_time");
  const registrationId = await ensureFeeItem("Registration Fee", "registration", "one_time");
  const transportId = await ensureFeeItem("School Transport", "transport", "monthly");

  const planRows = [
    { feeItemId: tuitionId, amount: "500000" },
    { feeItemId: registrationId, amount: "50000" },
    { feeItemId: transportId, amount: "40000" }
  ];

  const ensurePlansForYear = async (yearId: string) => {
    for (const plan of planRows) {
      const [existingPlan] = await db
        .select({ id: enrollmentFeePlans.id })
        .from(enrollmentFeePlans)
        .where(
          and(
            eq(enrollmentFeePlans.tenantId, tenantId),
            eq(enrollmentFeePlans.academicYearId, yearId),
            eq(enrollmentFeePlans.feeItemId, plan.feeItemId),
            eq(enrollmentFeePlans.amount, plan.amount)
          )
        );

      if (existingPlan) {
        const [existingGrade] = await db
          .select({ id: enrollmentFeePlanGrades.id })
          .from(enrollmentFeePlanGrades)
          .where(
            and(
              eq(enrollmentFeePlanGrades.tenantId, tenantId),
              eq(enrollmentFeePlanGrades.planId, existingPlan.id),
              eq(enrollmentFeePlanGrades.gradeId, gradeId)
            )
          );

        if (!existingGrade) {
          await db.insert(enrollmentFeePlanGrades).values({
            tenantId,
            planId: existingPlan.id,
            gradeId
          });
        }
        continue;
      }

      const [createdPlan] = await db
        .insert(enrollmentFeePlans)
        .values({
          tenantId,
          academicYearId: yearId,
          feeItemId: plan.feeItemId,
          amount: plan.amount
        })
        .returning({ id: enrollmentFeePlans.id });

      await db.insert(enrollmentFeePlanGrades).values({
        tenantId,
        planId: createdPlan!.id,
        gradeId
      });
    }
  };

  await ensurePlansForYear(academicYearId);

  const [canonicalYear] = await db
    .select({ name: academicYears.name })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.id, academicYearId)));

  if (canonicalYear) {
    const normalized = canonicalYear.name.replace(/\s+/g, "");
    const aliasYears = await db
      .select({ id: academicYears.id, name: academicYears.name })
      .from(academicYears)
      .where(eq(academicYears.tenantId, tenantId));

    for (const alias of aliasYears) {
      if (alias.id === academicYearId) continue;
      if (alias.name.replace(/\s+/g, "") === normalized) {
        await ensurePlansForYear(alias.id);
      }
    }
  }

  const [existingSiblingRule] = await db
    .select({ id: discountRules.id })
    .from(discountRules)
    .where(and(eq(discountRules.tenantId, tenantId), eq(discountRules.name, "Sibling discount — 2nd child")));

  if (!existingSiblingRule) {
    await db.insert(discountRules).values({
      tenantId,
      name: "Sibling discount — 2nd child",
      discountType: "sibling",
      valueType: "percentage",
      value: "10",
      triggerMode: "auto",
      stackable: true,
      sortOrder: 0,
      criteria: {
        type: "sibling",
        appliesTo: {
          billingContexts: ["enrollment", "recurring"],
          feeTypes: ["tuition"]
        },
        minEnrolledSiblings: 1,
        siblingOrdinal: 2,
        notes: "Applied when enrolling the 2nd child in the same family for the academic year."
      },
      status: "active"
    });
  }

  const demoRules = [
    {
      name: "Merit scholarship — top 3",
      discountType: "scholarship",
      value: "15",
      triggerMode: "request",
      stackable: false,
      criteria: {
        type: "scholarship",
        appliesTo: {
          billingContexts: ["enrollment"],
          feeTypes: ["tuition"]
        },
        requiresDocumentation: true,
        notes: "Awarded to top 3 students in each grade every term."
      }
    },
    {
      name: "Staff child waiver",
      discountType: "staff",
      value: "20",
      triggerMode: "request",
      stackable: false,
      criteria: {
        type: "staff_child",
        appliesTo: {
          billingContexts: ["enrollment", "recurring"],
          feeTypes: ["tuition"]
        },
        requiresDocumentation: true,
        notes: "For children of full-time staff members."
      }
    },
    {
      name: "Financial-Need Bursary",
      discountType: "custom",
      value: "25",
      triggerMode: "request",
      stackable: false,
      status: "inactive" as const,
      criteria: {
        type: "custom",
        appliesTo: {
          billingContexts: ["enrollment", "recurring"],
          feeTypes: ["tuition", "registration", "transport"]
        },
        requiresDocumentation: true,
        notes: "Awarded on application for families with demonstrated financial need."
      }
    }
  ] as const;

  for (const rule of demoRules) {
    const [existing] = await db
      .select({ id: discountRules.id })
      .from(discountRules)
      .where(and(eq(discountRules.tenantId, tenantId), eq(discountRules.name, rule.name)));

    if (!existing) {
      await db.insert(discountRules).values({
        tenantId,
        name: rule.name,
        discountType: rule.discountType,
        valueType: "percentage",
        value: rule.value,
        triggerMode: rule.triggerMode,
        stackable: rule.stackable,
        criteria: rule.criteria,
        status: "status" in rule ? rule.status : "active"
      });
    }
  }

  await db
    .update(discountRules)
    .set({ status: "inactive" })
    .where(and(eq(discountRules.tenantId, tenantId), eq(discountRules.status, "archived")));
}

async function seedTenant(
  db: ReturnType<typeof drizzle>,
  input: { name: string; slug: string },
  ownerPasswordHash: string
) {
  const [tenant] = await db
    .insert(tenants)
    .values({ name: input.name, slug: input.slug, status: "active" })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: input.name } })
    .returning();

  if (!tenant) {
    throw new Error(`Failed to seed tenant ${input.slug}`);
  }

  await db
    .insert(tenantSettings)
    .values({ tenantId: tenant.id, schoolName: input.name })
    .onConflictDoNothing();

  for (const roleKey of roleKeys) {
    await db
      .insert(roles)
      .values({ tenantId: tenant.id, key: roleKey, name: roleKey, permissions: rolePermissions[roleKey] })
      .onConflictDoUpdate({
        target: [roles.tenantId, roles.key],
        set: { permissions: rolePermissions[roleKey] }
      });
  }

  const ownerEmail = `owner@${input.slug}.example.edu.mm`;
  const [owner] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: ownerEmail,
      displayName: `${input.name} Owner`,
      status: "active",
      passwordHash: ownerPasswordHash
    })
    .onConflictDoUpdate({
      target: [users.tenantId, users.email],
      set: { status: "active", passwordHash: ownerPasswordHash }
    })
    .returning();

  const [ownerRole] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.tenantId, tenant.id), eq(roles.key, "school_owner")));

  if (owner && ownerRole) {
    await db
      .insert(userRoles)
      .values({ tenantId: tenant.id, userId: owner.id, roleId: ownerRole.id })
      .onConflictDoNothing();
  }

  // Academic master data has no natural unique key, so guard on existence to
  // keep the seed idempotent across repeated runs.
  const [existingYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenant.id), eq(academicYears.name, "2026-2027")));

  let academicYearId = existingYear?.id;

  if (academicYearId) {
    await db
      .update(academicYears)
      .set({ status: "active" })
      .where(eq(academicYears.id, academicYearId));
  } else {
    const [academicYear] = await db
      .insert(academicYears)
      .values({
        tenantId: tenant.id,
        name: "2026-2027",
        startsOn: "2026-06-01",
        endsOn: "2027-03-31",
        status: "active"
      })
      .returning();
    academicYearId = academicYear?.id;

    await db.insert(grades).values({
      tenantId: tenant.id,
      name: "Grade 1",
      sortOrder: 1,
      minAge: 6,
      maxAge: 7
    });
    await db.insert(subjects).values({ tenantId: tenant.id, name: "Mathematics", code: "MATH" });
  }

  if (input.slug === "demo-alpha" && academicYearId) {
    const catalog = await seedAcademicCatalog(db, tenant.id, academicYearId);
    await seedTeachingSectors(db, tenant.id);
    await seedFacilityRooms(db, tenant.id);
    await seedDemoTeachers(db, tenant.id, academicYearId, input.slug, ownerPasswordHash, catalog);
    await seedDemoClassroomAssignments(db, tenant.id, academicYearId, input.slug, catalog);
    await seedDemoEnrollmentBillingAllGrades(db, tenant.id, academicYearId, catalog.gradeIds);
    await seedDemoAlpha(db, tenant.id, academicYearId, ownerPasswordHash);
    await seedDepartments(db, tenant.id);
    await seedDemoEnquiries(db, tenant.id);
  }

  if (academicYearId && owner?.id) {
    await seedTimetableSchedule(db, tenant.id, academicYearId, owner.id);
    if (input.slug === "demo-alpha") {
      await seedDemoTimetable(db, tenant.id, academicYearId, owner.id);
    }
  }

  return { tenant, academicYearId };
}

async function verifyIsolation(db: ReturnType<typeof drizzle>, tenantId: string) {
  const leakedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), ne(users.tenantId, tenantId)));

  if (leakedUsers.length > 0) {
    throw new Error(`Tenant isolation check failed for ${tenantId}`);
  }
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://sms:sms@localhost:5432/sms"
  });
  const db = drizzle(pool);

  try {
    const ownerPasswordHash = await argon2.hash(DEMO_OWNER_PASSWORD, { type: argon2.argon2id });

    await seedPlatformAdmin(db, ownerPasswordHash);

    const results = [];
    for (const tenantInput of demoTenants) {
      const result = await seedTenant(db, tenantInput, ownerPasswordHash);
      await verifyIsolation(db, result.tenant.id);
      results.push(result);
    }

    const tenantIds = results.map((result) => result.tenant.id);
    if (new Set(tenantIds).size !== tenantIds.length) {
      throw new Error("Duplicate tenant ids detected during seed.");
    }

    console.log(
      "Seeded demo tenants:",
      results.map((result) => ({ id: result.tenant.id, slug: result.tenant.slug }))
    );
    console.log("\nDemo sign-in credentials (local development only):");
    console.log(
      `  • Platform console  ·  /platform/login  ·  email ${PLATFORM_ADMIN_EMAIL}  ·  password ${DEMO_OWNER_PASSWORD}`
    );
    for (const result of results) {
      console.log(
        `  • Tenant "${result.tenant.slug}"  ·  email owner@${result.tenant.slug}.example.edu.mm  ·  password ${DEMO_OWNER_PASSWORD}`
      );
    }
    console.log(
      `  • Demo teachers (demo-alpha)  ·  13 accounts  ·  e.g. teacher@demo-alpha.example.edu.mm  ·  password ${DEMO_OWNER_PASSWORD}`
    );
    printDemoAlphaCredentials(DEMO_OWNER_PASSWORD);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
