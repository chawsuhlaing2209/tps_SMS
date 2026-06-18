import { config } from "dotenv";
import { rolePermissions, roles as roleKeys } from "@sms/shared";
import argon2 from "argon2";
import { and, eq, isNull, ne } from "drizzle-orm";
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
  familyGroups,
  feeItems,
  gradeChiefAssignments,
  gradeSubjects,
  grades,
  guardians,
  paymentPlanInstallments,
  paymentPlans,
  roles,
  staff,
  studentServices,
  students,
  subjects,
  teachingSectorGrades,
  teachingSectors,
  tenantSettings,
  tenants,
  userRoles,
  users
} from "./schema.js";

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

  const tuitionId = await ensureFeeItem("Grade 1 Tuition", "tuition", "one_time");
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
    .where(and(eq(discountRules.tenantId, tenantId), eq(discountRules.name, "Sibling 10%")));

  if (!existingSiblingRule) {
    await db.insert(discountRules).values({
      tenantId,
      name: "Sibling 10%",
      discountType: "sibling",
      valueType: "percentage",
      value: "10",
      criteria: {
        type: "sibling",
        minEnrolledSiblings: 1,
        appliesToFeeTypes: ["tuition"]
      },
      status: "active"
    });
  }

  const [existingFamily] = await db
    .select({ id: familyGroups.id })
    .from(familyGroups)
    .where(and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.name, "Demo Kyaw Family")));

  let familyGroupId = existingFamily?.id;

  if (!familyGroupId) {
    const [guardian] = await db
      .insert(guardians)
      .values({
        tenantId,
        fullName: "U Kyaw Kyaw",
        phone: "09123456789",
        preferredChannel: "phone"
      })
      .returning({ id: guardians.id });

    const [family] = await db
      .insert(familyGroups)
      .values({
        tenantId,
        name: "Demo Kyaw Family",
        primaryGuardianId: guardian!.id
      })
      .returning({ id: familyGroups.id });

    familyGroupId = family!.id;
  }

  const ensureStudent = async (admissionNumber: string, fullName: string, status: "draft" | "enrolled") => {
    const [existing] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.tenantId, tenantId), eq(students.admissionNumber, admissionNumber)));

    if (existing) {
      await db
        .update(students)
        .set({ familyGroupId, status, fullName })
        .where(eq(students.id, existing.id));
      return existing.id;
    }

    const [created] = await db
      .insert(students)
      .values({
        tenantId,
        familyGroupId,
        admissionNumber,
        fullName,
        dateOfBirth: admissionNumber === "DEMO-001" ? "2018-03-15" : "2020-08-20",
        status
      })
      .returning({ id: students.id });

    return created!.id;
  };

  const olderStudentId = await ensureStudent("DEMO-001", "Maung Maung Kyaw", "enrolled");
  await ensureStudent("DEMO-002", "Ma Hla Kyaw", "draft");

  for (let i = 3; i <= 102; i++) {
    const num = String(i).padStart(3, "0");
    await ensureStudent(`DEMO-${num}`, `Demo Student ${num}`, i % 5 === 0 ? "enrolled" : "draft");
  }

  const [existingEnrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, olderStudentId),
        eq(enrollments.academicYearId, academicYearId)
      )
    );

  if (!existingEnrollment) {
    await db.insert(enrollments).values({
      tenantId,
      studentId: olderStudentId,
      academicYearId,
      gradeId,
      classroomId,
      status: "approved",
      billingSnapshot: { optionalFeeItemIds: [] }
    });

    await db.insert(classroomStudents).values({
      tenantId,
      classroomId,
      studentId: olderStudentId,
      effectiveFrom: "2026-06-01",
      movementReason: "seed_enrollment"
    });
  }

  const [transportFee] = await db
    .select({ id: feeItems.id })
    .from(feeItems)
    .where(and(eq(feeItems.tenantId, tenantId), eq(feeItems.name, "School Transport")));

  if (transportFee) {
    const [existingService] = await db
      .select({ id: studentServices.id })
      .from(studentServices)
      .where(
        and(
          eq(studentServices.tenantId, tenantId),
          eq(studentServices.studentId, olderStudentId),
          eq(studentServices.feeItemId, transportFee.id),
          isNull(studentServices.effectiveTo)
        )
      );

    if (!existingService) {
      await db.insert(studentServices).values({
        tenantId,
        studentId: olderStudentId,
        feeItemId: transportFee.id,
        effectiveFrom: "2026-06-01"
      });
    }
  }
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

  if (!academicYearId) {
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

  if (input.slug === "demo-alpha") {
    await seedTeachingSectors(db, tenant.id);
    await seedDemoClassroomData(db, tenant.id, input.slug, ownerPasswordHash);
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
      `  • Demo teacher (demo-alpha only)  ·  tenant demo-alpha  ·  email teacher@demo-alpha.example.edu.mm  ·  password ${DEMO_OWNER_PASSWORD}`
    );
    console.log(
      "    Grade chief of Grade 1, homeroom of Room A, teaches Maths in Room A — edit under People → Teacher assignments."
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
