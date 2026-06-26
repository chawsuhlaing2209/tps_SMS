import { buildInvoiceNumber, type Role } from "@sms/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import {
  classroomStudents,
  classrooms,
  enrollments,
  familyGroups,
  grades,
  guardians,
  invoiceItems,
  invoices,
  payments,
  receipts,
  roles,
  salaryComponents,
  salaryRecords,
  staff,
  studentGuardians,
  students,
  tenantSettings,
  terms,
  userRoles,
  users
} from "./schema.js";
import { demoTeacherEmails } from "./seed-demo-teachers.js";
import { seedDemoPayroll } from "./seed-demo-payroll.js";

type Db = ReturnType<typeof drizzle>;

type BillingState = "paid" | "partial" | "due" | "overdue";

type DemoChildSeed = {
  admissionNumber: string;
  fullName: string;
  dateOfBirth: string;
  status: "enrolled" | "draft";
  gradeName: string;
  classroomName: string;
  billing?: BillingState;
};

type DemoFamilySeed = {
  name: string;
  primaryGuardian: { fullName: string; phone: string; relationship: string };
  secondaryGuardian?: { fullName: string; phone: string; relationship: string };
  children: DemoChildSeed[];
};

const TUITION_BY_GRADE: Record<string, number> = {
  KG: 850_000,
  "Grade 1": 500_000,
  "Grade 2": 520_000,
  "Grade 3": 540_000,
  "Grade 4": 560_000,
  "Grade 5": 1_000_000,
  "Grade 6": 620_000,
  "Grade 7": 640_000,
  "Grade 8": 660_000,
  "Grade 9": 1_100_000,
  "Grade 10": 1_200_000,
  "Grade 11": 1_300_000,
  "Grade 12": 1_400_000
};

/** Realistic households for early-adopter demos — no mega-families. */
const DEMO_FAMILIES: DemoFamilySeed[] = [
  {
    name: "Kyaw Family",
    primaryGuardian: { fullName: "U Kyaw Kyaw", phone: "09123456789", relationship: "father" },
    secondaryGuardian: { fullName: "Daw Hla Kyaw", phone: "09987654321", relationship: "mother" },
    children: [
      {
        admissionNumber: "YIA-26-001",
        fullName: "Mg Maung Maung Kyaw",
        dateOfBirth: "2018-03-15",
        status: "enrolled",
        gradeName: "Grade 1",
        classroomName: "Room A",
        billing: "paid"
      },
      {
        admissionNumber: "YIA-26-002",
        fullName: "Ma Hla Kyaw",
        dateOfBirth: "2014-08-20",
        status: "enrolled",
        gradeName: "Grade 5",
        classroomName: "G5-A",
        billing: "due"
      }
    ]
  },
  {
    name: "Aung Family",
    primaryGuardian: { fullName: "Daw Aye Aye", phone: "09250111222", relationship: "mother" },
    children: [
      {
        admissionNumber: "YIA-26-003",
        fullName: "Mg Zaw Lin",
        dateOfBirth: "2019-01-10",
        status: "enrolled",
        gradeName: "KG",
        classroomName: "KG-A",
        billing: "paid"
      },
      {
        admissionNumber: "YIA-26-004",
        fullName: "Ma Shwe Yi",
        dateOfBirth: "2019-06-22",
        status: "enrolled",
        gradeName: "KG",
        classroomName: "KG-A",
        billing: "partial"
      }
    ]
  },
  {
    name: "Hnin Family",
    primaryGuardian: { fullName: "U Lin Htut", phone: "09250222333", relationship: "father" },
    children: [
      {
        admissionNumber: "YIA-26-005",
        fullName: "Ma Hnin Wai",
        dateOfBirth: "2010-11-05",
        status: "enrolled",
        gradeName: "Grade 9",
        classroomName: "G9-A",
        billing: "overdue"
      }
    ]
  },
  {
    name: "Myint Family",
    primaryGuardian: { fullName: "Daw Mya Mya", phone: "09250333444", relationship: "mother" },
    children: [
      {
        admissionNumber: "YIA-26-006",
        fullName: "Mg Kaung Khant",
        dateOfBirth: "2012-04-18",
        status: "enrolled",
        gradeName: "Grade 8",
        classroomName: "G8-A",
        billing: "partial"
      }
    ]
  },
  {
    name: "Win Family",
    primaryGuardian: { fullName: "U Zaw Win", phone: "09250444555", relationship: "father" },
    children: [
      {
        admissionNumber: "YIA-26-007",
        fullName: "Ma Thazin Oo",
        dateOfBirth: "2011-07-30",
        status: "enrolled",
        gradeName: "Grade 7",
        classroomName: "G7-A",
        billing: "paid"
      }
    ]
  },
  {
    name: "Soe Family",
    primaryGuardian: { fullName: "Daw Noe Noe", phone: "09250555666", relationship: "mother" },
    children: [
      {
        admissionNumber: "YIA-26-008",
        fullName: "Mg Ye Yint",
        dateOfBirth: "2010-12-12",
        status: "enrolled",
        gradeName: "Grade 9",
        classroomName: "G9-A",
        billing: "due"
      }
    ]
  },
  {
    name: "Hein Family",
    primaryGuardian: { fullName: "U Aung Kyaw", phone: "09250666777", relationship: "father" },
    children: [
      {
        admissionNumber: "YIA-26-009",
        fullName: "Ma Su Myat",
        dateOfBirth: "2017-02-14",
        status: "draft",
        gradeName: "Grade 1",
        classroomName: "Room A"
      }
    ]
  },
  {
    name: "Phyu Family",
    primaryGuardian: { fullName: "Daw Thida", phone: "09250777888", relationship: "mother" },
    children: [
      {
        admissionNumber: "YIA-26-010",
        fullName: "Mg Thiha Kyaw",
        dateOfBirth: "2016-09-09",
        status: "draft",
        gradeName: "Grade 5",
        classroomName: "G5-A"
      }
    ]
  },
  {
    name: "Kaung Family",
    primaryGuardian: { fullName: "U Myo Naing", phone: "09250888999", relationship: "father" },
    children: [
      {
        admissionNumber: "YIA-26-011",
        fullName: "Ma Ei Mon",
        dateOfBirth: "2014-05-25",
        status: "enrolled",
        gradeName: "Grade 5",
        classroomName: "G5-A",
        billing: "paid"
      }
    ]
  },
  {
    name: "Thin Family",
    primaryGuardian: { fullName: "Daw Yati", phone: "09250999000", relationship: "mother" },
    children: [
      {
        admissionNumber: "YIA-26-012",
        fullName: "Mg Phyo Wai",
        dateOfBirth: "2019-10-03",
        status: "enrolled",
        gradeName: "KG",
        classroomName: "KG-A",
        billing: "paid"
      }
    ]
  }
];

const DEMO_STAFF: Array<{
  email: string;
  displayName: string;
  roleKey: Role;
  staff: { fullName: string; employmentRole: string; department: string; salaryBasis: string };
  salaryGross: string;
  salaryStatus: "draft" | "approved";
  salaryPaid?: boolean;
}> = [
  {
    email: "principal@demo-alpha.example.edu.mm",
    displayName: "U Zaw Lin",
    roleKey: "principal",
    staff: {
      fullName: "U Zaw Lin",
      employmentRole: "admin",
      department: "Leadership",
      salaryBasis: "monthly"
    },
    salaryGross: "950000",
    salaryStatus: "approved",
    salaryPaid: true
  },
  {
    email: "admin@demo-alpha.example.edu.mm",
    displayName: "Ma Thiri Aung",
    roleKey: "school_admin",
    staff: {
      fullName: "Ma Thiri Aung",
      employmentRole: "admin",
      department: "Administration",
      salaryBasis: "monthly"
    },
    salaryGross: "700000",
    salaryStatus: "approved"
  },
  {
    email: "finance@demo-alpha.example.edu.mm",
    displayName: "Daw Sandar Win",
    roleKey: "accountant",
    staff: {
      fullName: "Daw Sandar Win",
      employmentRole: "accountant",
      department: "Finance",
      salaryBasis: "monthly"
    },
    salaryGross: "650000",
    salaryStatus: "draft"
  },
  {
    email: "hr@demo-alpha.example.edu.mm",
    displayName: "U Myo Min",
    roleKey: "hr_staff",
    staff: {
      fullName: "U Myo Min",
      employmentRole: "staff",
      department: "Human Resources",
      salaryBasis: "monthly"
    },
    salaryGross: "600000",
    salaryStatus: "draft"
  }
];

const SALARY_COMPONENTS = [
  { name: "Basic Pay", componentType: "basic" },
  { name: "Transport Allowance", componentType: "allowance" },
  { name: "SSB Deduction", componentType: "deduction" }
] as const;

async function ensureStaffUser(
  db: Db,
  tenantId: string,
  passwordHash: string,
  input: (typeof DEMO_STAFF)[number]
) {
  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      email: input.email,
      displayName: input.displayName,
      status: "active",
      passwordHash
    })
    .onConflictDoUpdate({
      target: [users.tenantId, users.email],
      set: { status: "active", passwordHash, displayName: input.displayName }
    })
    .returning({ id: users.id });

  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.key, input.roleKey)));

  if (user && role) {
    await db
      .insert(userRoles)
      .values({ tenantId, userId: user.id, roleId: role.id })
      .onConflictDoNothing();
  }

  const [existingStaff] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.tenantId, tenantId), eq(staff.userId, user!.id)));

  if (existingStaff) {
    await db
      .update(staff)
      .set({
        fullName: input.staff.fullName,
        employmentRole: input.staff.employmentRole,
        department: input.staff.department,
        salaryBasis: input.staff.salaryBasis,
        email: input.email,
        status: "active"
      })
      .where(eq(staff.id, existingStaff.id));
    return { staffId: existingStaff.id, userId: user!.id };
  }

  const [createdStaff] = await db
    .insert(staff)
    .values({
      tenantId,
      userId: user!.id,
      fullName: input.staff.fullName,
      employmentRole: input.staff.employmentRole,
      department: input.staff.department,
      salaryBasis: input.staff.salaryBasis,
      email: input.email,
      status: "active"
    })
    .returning({ id: staff.id });

  return { staffId: createdStaff!.id, userId: user!.id };
}

async function ensureClassroom(
  db: Db,
  tenantId: string,
  academicYearId: string,
  gradeId: string,
  name: string
) {
  const [existing] = await db
    .select({ id: classrooms.id })
    .from(classrooms)
    .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.name, name)));
  if (existing) return existing.id;
  const [created] = await db
    .insert(classrooms)
    .values({
      tenantId,
      academicYearId,
      gradeId,
      name,
      room: name,
      capacity: 30,
      status: "active"
    })
    .returning({ id: classrooms.id });
  return created!.id;
}

async function ensureGuardian(
  db: Db,
  tenantId: string,
  input: { fullName: string; phone: string }
) {
  const [existing] = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(
      and(
        eq(guardians.tenantId, tenantId),
        eq(guardians.fullName, input.fullName),
        eq(guardians.phone, input.phone)
      )
    );
  if (existing) return existing.id;

  const [created] = await db
    .insert(guardians)
    .values({
      tenantId,
      fullName: input.fullName,
      phone: input.phone,
      preferredChannel: "phone"
    })
    .returning({ id: guardians.id });
  return created!.id;
}

async function linkGuardianToStudent(
  db: Db,
  tenantId: string,
  studentId: string,
  guardianId: string,
  relationship: string
) {
  const [existing] = await db
    .select({ id: studentGuardians.id })
    .from(studentGuardians)
    .where(
      and(
        eq(studentGuardians.tenantId, tenantId),
        eq(studentGuardians.studentId, studentId),
        eq(studentGuardians.guardianId, guardianId)
      )
    );
  if (existing) return;
  await db.insert(studentGuardians).values({
    tenantId,
    studentId,
    guardianId,
    relationship,
    pickupAuthorized: true,
    emergencyContact: relationship === "father" || relationship === "mother"
  });
}

async function seedInvoiceForStudent(
  db: Db,
  tenantId: string,
  input: {
    studentId: string;
    familyGroupId: string;
    enrollmentId: string;
    gradeName: string;
    admissionNumber: string;
    billing: BillingState;
  }
) {
  const [existingInvoice] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, input.studentId), eq(invoices.enrollmentId, input.enrollmentId))
    );

  const linkEnrollmentToInvoice = async (invoiceId: string) => {
    await db
      .update(enrollments)
      .set({
        invoiceId,
        status: "approved",
        confirmedAt: new Date()
      })
      .where(
        and(eq(enrollments.tenantId, tenantId), eq(enrollments.id, input.enrollmentId))
      );
  };

  if (existingInvoice) {
    await linkEnrollmentToInvoice(existingInvoice.id);
    return;
  }

  const total = TUITION_BY_GRADE[input.gradeName] ?? 500_000;
  const issueDate = "2026-06-05";
  const dueFuture = "2026-07-31";
  const duePast = "2026-06-10";
  const invoiceStatus =
    input.billing === "paid"
      ? "paid"
      : input.billing === "partial"
        ? "partial"
        : input.billing === "overdue"
          ? "overdue"
          : "unpaid";
  const dueDate = input.billing === "overdue" ? duePast : dueFuture;
  const code = input.admissionNumber.replace("YIA-26-", "");

  const [invoice] = await db
    .insert(invoices)
    .values({
      tenantId,
      studentId: input.studentId,
      enrollmentId: input.enrollmentId,
      familyGroupId: input.familyGroupId,
      source: "enrollment",
      invoiceNumber: buildInvoiceNumber(new Date(issueDate), code),
      issueDate,
      dueDate,
      subtotal: String(total),
      discountTotal: "0",
      total: String(total),
      status: invoiceStatus
    })
    .returning({ id: invoices.id });

  await db.insert(invoiceItems).values({
    tenantId,
    invoiceId: invoice!.id,
    description: `${input.gradeName} tuition — Term 1`,
    quantity: "1",
    unitAmount: String(total),
    total: String(total)
  });

  if (input.billing === "paid" || input.billing === "partial") {
    const amount = input.billing === "paid" ? total : Math.round(total / 2);
    const [payment] = await db
      .insert(payments)
      .values({
        tenantId,
        invoiceId: invoice!.id,
        kind: "payment",
        amount: String(amount),
        method: input.billing === "paid" ? "kbzpay" : "cash",
        referenceNumber: input.billing === "paid" ? `TXN-${input.admissionNumber}` : null,
        paidAt: new Date("2026-06-12T03:00:00Z"),
        verifiedAt: new Date("2026-06-12T03:00:00Z")
      })
      .returning({ id: payments.id });

    await db.insert(receipts).values({
      tenantId,
      paymentId: payment!.id,
      receiptNumber: `PKR-${code}`,
      issuedAt: new Date("2026-06-12T03:00:00Z")
    });
  }

  await linkEnrollmentToInvoice(invoice!.id);
}

export async function seedDemoAlpha(
  db: Db,
  tenantId: string,
  academicYearId: string,
  passwordHash: string
) {
  await db
    .update(tenantSettings)
    .set({
      schoolName: "Yangon International Academy",
      receiptPrefix: "PKR",
      address: "No. 12, Pyay Road, Yangon",
      contactPhone: "+95 9 771 000 000"
    })
    .where(eq(tenantSettings.tenantId, tenantId));

  const termDefs = [
    { name: "Term 1", startsOn: "2026-06-01", endsOn: "2026-09-30" },
    { name: "Term 2", startsOn: "2026-10-01", endsOn: "2027-01-15" },
    { name: "Term 3", startsOn: "2027-01-16", endsOn: "2027-03-31" }
  ];
  for (const term of termDefs) {
    const [existing] = await db
      .select({ id: terms.id })
      .from(terms)
      .where(
        and(
          eq(terms.tenantId, tenantId),
          eq(terms.academicYearId, academicYearId),
          eq(terms.name, term.name)
        )
      );
    if (!existing) {
      await db.insert(terms).values({ tenantId, academicYearId, ...term });
    }
  }

  const gradeRows = await db
    .select({ id: grades.id, name: grades.name })
    .from(grades)
    .where(eq(grades.tenantId, tenantId));

  const gradeIds = new Map(gradeRows.map((row) => [row.name, row.id]));

  const classroomIds = new Map<string, string>();
  for (const family of DEMO_FAMILIES) {
    for (const child of family.children) {
      const gradeId = gradeIds.get(child.gradeName);
      if (!gradeId) continue;
      const classroomId = await ensureClassroom(
        db,
        tenantId,
        academicYearId,
        gradeId,
        child.classroomName
      );
      classroomIds.set(child.classroomName, classroomId);
    }
  }

  const staffIds: Array<{ email: string; staffId: string }> = [];
  for (const member of DEMO_STAFF) {
    const { staffId } = await ensureStaffUser(db, tenantId, passwordHash, member);
    staffIds.push({ email: member.email, staffId });
  }

  for (const component of SALARY_COMPONENTS) {
    const [existing] = await db
      .select({ id: salaryComponents.id })
      .from(salaryComponents)
      .where(
        and(eq(salaryComponents.tenantId, tenantId), eq(salaryComponents.name, component.name))
      );
    if (!existing) {
      await db.insert(salaryComponents).values({
        tenantId,
        name: component.name,
        componentType: component.componentType,
        status: "active"
      });
    }
  }

  const salaryMonth = "2026-06";
  const teacherEmails = demoTeacherEmails("demo-alpha");
  const teacherStaffRows = await db
    .select({ id: staff.id, email: users.email })
    .from(staff)
    .innerJoin(users, eq(staff.userId, users.id))
    .where(and(eq(staff.tenantId, tenantId), eq(staff.employmentRole, "teacher")));

  const salaryTargets = [
    ...teacherStaffRows
      .filter((row): row is typeof row & { email: string } =>
        Boolean(row.email && teacherEmails.includes(row.email))
      )
      .map((row, index) => ({
        staffId: row.id,
        gross: index === 0 ? "800000" : "750000",
        status: "approved" as const,
        paid: index < 3
      })),
    ...DEMO_STAFF.map((member, index) => ({
      staffId: staffIds[index]!.staffId,
      gross: member.salaryGross,
      status: member.salaryStatus,
      paid: member.salaryPaid ?? false
    }))
  ];

  for (const target of salaryTargets) {
    const [existing] = await db
      .select({ id: salaryRecords.id })
      .from(salaryRecords)
      .where(
        and(
          eq(salaryRecords.tenantId, tenantId),
          eq(salaryRecords.staffId, target.staffId),
          eq(salaryRecords.salaryMonth, salaryMonth)
        )
      );
    if (existing) continue;

    await db.insert(salaryRecords).values({
      tenantId,
      staffId: target.staffId,
      salaryMonth,
      grossAmount: target.gross,
      deductionAmount: "0",
      netAmount: target.gross,
      status: target.status,
      paidAt: target.paid ? new Date("2026-06-25T03:00:00Z") : null
    });
  }

  await seedDemoPayroll(
    db,
    tenantId,
    staffIds.map((row) => row.staffId)
  );

  for (const familySeed of DEMO_FAMILIES) {
    const [existingFamily] = await db
      .select({ id: familyGroups.id })
      .from(familyGroups)
      .where(and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.name, familySeed.name)));

    let familyGroupId = existingFamily?.id;

    const primaryGuardianId = await ensureGuardian(db, tenantId, familySeed.primaryGuardian);

    if (!familyGroupId && primaryGuardianId) {
      const [family] = await db
        .insert(familyGroups)
        .values({
          tenantId,
          name: familySeed.name,
          primaryGuardianId
        })
        .returning({ id: familyGroups.id });
      familyGroupId = family!.id;
    } else if (familyGroupId && primaryGuardianId) {
      await db
        .update(familyGroups)
        .set({ primaryGuardianId })
        .where(eq(familyGroups.id, familyGroupId));
    }

    if (!familyGroupId || !primaryGuardianId) continue;

    let secondaryGuardianId: string | undefined;
    if (familySeed.secondaryGuardian) {
      secondaryGuardianId = await ensureGuardian(db, tenantId, familySeed.secondaryGuardian);
    }

    for (const child of familySeed.children) {
      const gradeId = gradeIds.get(child.gradeName);
      const classroomId = classroomIds.get(child.classroomName);
      if (!gradeId) continue;

      const [existingStudent] = await db
        .select({ id: students.id })
        .from(students)
        .where(
          and(eq(students.tenantId, tenantId), eq(students.admissionNumber, child.admissionNumber))
        );

      let studentId = existingStudent?.id;
      if (studentId) {
        await db
          .update(students)
          .set({
            familyGroupId,
            fullName: child.fullName,
            dateOfBirth: child.dateOfBirth,
            status: child.status
          })
          .where(eq(students.id, studentId));
      } else {
        const [created] = await db
          .insert(students)
          .values({
            tenantId,
            familyGroupId,
            admissionNumber: child.admissionNumber,
            fullName: child.fullName,
            dateOfBirth: child.dateOfBirth,
            status: child.status
          })
          .returning({ id: students.id });
        studentId = created!.id;
      }

      await linkGuardianToStudent(
        db,
        tenantId,
        studentId,
        primaryGuardianId,
        familySeed.primaryGuardian.relationship
      );
      if (secondaryGuardianId && familySeed.secondaryGuardian) {
        await linkGuardianToStudent(
          db,
          tenantId,
          studentId,
          secondaryGuardianId,
          familySeed.secondaryGuardian.relationship
        );
      }

      if (child.status !== "enrolled" || !classroomId) continue;

      const [existingEnrollment] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.tenantId, tenantId),
            eq(enrollments.studentId, studentId),
            eq(enrollments.academicYearId, academicYearId)
          )
        );

      let enrollmentId = existingEnrollment?.id;
      if (!enrollmentId) {
        const [enrollment] = await db
          .insert(enrollments)
          .values({
            tenantId,
            studentId,
            academicYearId,
            gradeId,
            classroomId,
            status: "approved",
            billingSnapshot: { optionalFeeItemIds: [] }
          })
          .returning({ id: enrollments.id });
        enrollmentId = enrollment!.id;

        const [existingRoster] = await db
          .select({ id: classroomStudents.id })
          .from(classroomStudents)
          .where(
            and(
              eq(classroomStudents.tenantId, tenantId),
              eq(classroomStudents.classroomId, classroomId),
              eq(classroomStudents.studentId, studentId),
              isNull(classroomStudents.effectiveTo)
            )
          );
        if (!existingRoster) {
          await db.insert(classroomStudents).values({
            tenantId,
            classroomId,
            studentId,
            effectiveFrom: "2026-06-01",
            movementReason: "seed_demo_alpha"
          });
        }
      }

      if (child.billing && enrollmentId) {
        await seedInvoiceForStudent(db, tenantId, {
          studentId,
          familyGroupId,
          enrollmentId,
          gradeName: child.gradeName,
          admissionNumber: child.admissionNumber,
          billing: child.billing
        });
      }
    }
  }
}

export function printDemoAlphaCredentials(password: string) {
  console.log("\n── demo-alpha early-adopter demo ──");
  console.log("Run npm run db:reset before the demo for a clean dataset.");
  console.log(`Password for all accounts below: ${password}\n`);
  console.log("Role-based sign-in (tenant slug: demo-alpha):");
  console.log("  school_owner   owner@demo-alpha.example.edu.mm     — full access");
  console.log("  principal      principal@demo-alpha.example.edu.mm — academics, no finance");
  console.log("  school_admin   admin@demo-alpha.example.edu.mm     — students, enrollments");
  console.log("  accountant     finance@demo-alpha.example.edu.mm   — fees & billing only");
  console.log("  hr_staff       hr@demo-alpha.example.edu.mm        — team & salary");
  console.log("\nTeachers (13 accounts, homeroom + subject assignments):");
  for (const email of demoTeacherEmails("demo-alpha")) {
    console.log(`  teacher        ${email}`);
  }
  console.log("\nStructure: KG + Grade 1–12 · 13 subjects · grade–subject mappings for 2026-2027");
  console.log("Timetable: published weekly slots for all sections · teachers assigned per subject");
  console.log("Households: 10 families · 12 students (10 enrolled, 2 draft) · max 2 children per family");
  console.log("Highlight families: Kyaw (2 siblings), Aung (2 siblings in KG)");
}
