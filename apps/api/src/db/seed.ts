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
  familyGroups,
  feeItems,
  gradeChiefAssignments,
  gradeSubjects,
  grades,
  guardians,
  invoiceItems,
  invoices,
  paymentPlanInstallments,
  paymentPlans,
  payments,
  receipts,
  roles,
  staff,
  studentServices,
  students,
  subjects,
  teachingSectorGrades,
  teachingSectors,
  tenantSettings,
  tenants,
  terms,
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

/** Myanmar-style student names for the people-directory seed roster (YIA-26-xxx). */
const SEED_DIRECTORY_NAMES = [
  "Pyae Sone", "Hnin Wai", "Zaw Lin", "Shwe Yi", "Kaung Khant",
  "Thazin Oo", "Ye Yint", "Su Myat", "Thiha Kyaw", "Ei Mon",
  "Phyo Wai", "Hsu Yati", "Min Khant", "Nan Htwe", "Aung Kaung",
  "Khin Sandar", "Zin Myo", "Yamone Lwin", "Kyaw Zin", "Hay Mar",
  "Nyein Chan", "Myat Noe", "Hein Htet", "Phyu Phyu", "Soe Moe",
  "May Thin", "Aung Paing", "Hlaing Hlaing", "Win Ko", "Ei Shwe",
  "Kyaw Thu", "Su Su", "Min Thu", "Hnin Hnin", "Zaw Myo",
  "Thiri Aung", "Paing Soe", "May Khaing", "Bo Bo", "Chit Su",
  "Aung Ko", "Yadanar", "Myo Min", "Hla Hla", "Soe Win",
  "Phyo Hein", "Ei Ei", "Kyaw Myo", "Thandar", "Min Ko",
  "Nilar", "Aung Zin", "Su Latt", "Hein Zaw", "May Oo",
  "Zaw Bo", "Hnin Pyae", "Myat Thu", "Kaung Set", "Ei Phyo",
  "Soe Paing", "Thiri", "Aung Hein", "May Zin", "Phyo Thu",
  "Hlaing Phyu", "Min Paing", "Su Mon", "Kyaw Hein", "Nan Wai",
  "Zaw Thu", "Ei Thiri", "Bo Hein", "May Phyu", "Aung Thu",
  "Hnin Mon", "Myo Thu", "Kaung Hein", "Thazin", "Soe Thu",
  "Phyu Mon", "Ye Hein", "Su Pyae", "Min Zaw", "Nyein Pyae",
  "Aung Mon", "Hla Pyae", "Zaw Hein", "May Thu", "Ei Zin",
  "Kyaw Paing", "Thiri Mon", "Hein Thu", "Su Hein", "Bo Zaw",
  "Nan Pyae", "Myat Zin", "Phyo Mon", "Hnin Thu", "Kaung Zaw",
  "Ye Thu", "May Hein", "Aung Pyae", "Su Thu", "Min Hein"
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
  await seedFeesBillingDemo(db, tenantId, year.id);
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

/**
 * Populates the Fees & Billing workspace with a realistic per-student roster:
 * multiple grades, classrooms, guardians, approved enrollments, Term-1 invoices,
 * and a spread of paid / partial / due / overdue payment states.
 */
async function seedFeesBillingDemo(
  db: ReturnType<typeof drizzle>,
  tenantId: string,
  academicYearId: string
) {
  // Brand the receipts/school name to match the production reference design.
  await db
    .update(tenantSettings)
    .set({
      schoolName: "Yangon International Academy",
      receiptPrefix: "PKR",
      address: "No. 12, Pyay Road, Yangon",
      contactPhone: "+95 9 771 000 000"
    })
    .where(eq(tenantSettings.tenantId, tenantId));

  // ── Terms ──────────────────────────────────────────────────────────────────
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

  // ── Grades (KG + secondary grades alongside the existing Grade 1) ────────────
  const gradeDefs = [
    { name: "KG", sortOrder: 0, code: "KG", tuition: 900000 },
    { name: "Grade 5", sortOrder: 5, code: "G5", tuition: 1000000 },
    { name: "Grade 9", sortOrder: 9, code: "G9", tuition: 1100000 },
    { name: "Grade 10", sortOrder: 10, code: "G10", tuition: 1200000 },
    { name: "Grade 11", sortOrder: 11, code: "G11", tuition: 1300000 },
    { name: "Grade 12", sortOrder: 12, code: "G12", tuition: 1400000 }
  ];

  const ensureGrade = async (name: string, sortOrder: number) => {
    const [existing] = await db
      .select({ id: grades.id })
      .from(grades)
      .where(and(eq(grades.tenantId, tenantId), eq(grades.name, name)));
    if (existing) return existing.id;
    const [created] = await db
      .insert(grades)
      .values({ tenantId, name, sortOrder, status: "active" })
      .returning({ id: grades.id });
    return created!.id;
  };

  const ensureClassroom = async (gradeId: string, name: string) => {
    const [existing] = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.name, name)));
    if (existing) return existing.id;
    const [created] = await db
      .insert(classrooms)
      .values({ tenantId, academicYearId, gradeId, name, room: name, capacity: 30, status: "active" })
      .returning({ id: classrooms.id });
    return created!.id;
  };

  const firstNames = [
    "Wai Yan Phyo", "Hnin Ei Phyu", "Zaw Lin Htet", "Shwe Yi Win", "Kaung Khant Zaw",
    "Thazin Oo", "Ye Yint Aung", "Su Myat Noe", "Thiha Kyaw", "Ei Mon Kyaw",
    "Phyo Wai Aung", "Hsu Yati", "Min Khant", "Nan Htwe", "Aung Kaung Myat",
    "Khin Sandar", "Zin Myo Aung", "Yamone Lwin", "Kyaw Zin Latt", "Hay Mar Win"
  ];
  const guardianNames = [
    "U Phyo Min", "Daw Mya Mya", "U Lin Htut", "Daw Aye Aye", "U Zaw Win",
    "Daw Hla Hla", "U Aung Kyaw", "Daw Noe Noe", "U Kyaw Soe", "Daw Thida",
    "U Myo Naing", "Daw Yati", "U Khant Min", "Daw Htwe Htwe", "U Myat Aung",
    "Daw Sandar", "U Myo Aung", "Daw Lwin Lwin", "U Zin Latt", "Daw Mar Win"
  ];

  const issueDate = "2026-06-05";
  const dueFuture = "2026-07-31";
  const duePast = "2026-06-10";

  // Per-student billing state: paid / partial / due / overdue.
  const stateForIndex = (i: number): "paid" | "partial" | "due" | "overdue" => {
    if (i < 6) return "paid";
    if (i === 6) return "partial";
    if (i === 7) return "overdue";
    return "due";
  };

  for (const gradeDef of gradeDefs) {
    const gradeId = await ensureGrade(gradeDef.name, gradeDef.sortOrder);
    const classroomName = `${gradeDef.code}-A`;
    const classroomId = await ensureClassroom(gradeId, classroomName);
    if (!classroomId) continue;

    for (let i = 0; i < 10; i += 1) {
      const seq = String(i + 1).padStart(2, "0");
      const admissionNumber = `BILL-${gradeDef.code}-${seq}`;
      const prefix = i % 2 === 0 ? "Mg" : "Ma";
      const studentName = `${prefix} ${firstNames[i % firstNames.length]!}`;
      const guardianName = guardianNames[(i + gradeDef.sortOrder) % guardianNames.length]!;

      const [existingStudent] = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.tenantId, tenantId), eq(students.admissionNumber, admissionNumber)));
      if (existingStudent) {
        await backfillBillingInvoiceLinks(
          db,
          tenantId,
          existingStudent.id,
          academicYearId,
          gradeId
        );
        continue;
      }

      const [guardian] = await db
        .insert(guardians)
        .values({ tenantId, fullName: guardianName, phone: `09-${250 + i}-123 ${gradeDef.sortOrder}${seq}`, preferredChannel: "phone" })
        .returning({ id: guardians.id });

      const [family] = await db
        .insert(familyGroups)
        .values({ tenantId, name: `${guardianName} Family`, primaryGuardianId: guardian!.id })
        .returning({ id: familyGroups.id });

      const [student] = await db
        .insert(students)
        .values({ tenantId, familyGroupId: family!.id, admissionNumber, fullName: studentName, status: "enrolled" })
        .returning({ id: students.id });

      const [enrollment] = await db
        .insert(enrollments)
        .values({
          tenantId,
          studentId: student!.id,
          academicYearId,
          gradeId,
          classroomId,
          status: "approved",
          confirmedAt: new Date(),
          billingSnapshot: { optionalFeeItemIds: [] }
        })
        .returning({ id: enrollments.id });

      await db.insert(classroomStudents).values({
        tenantId,
        classroomId,
        studentId: student!.id,
        effectiveFrom: "2026-06-01",
        movementReason: "seed_billing"
      });

      const state = stateForIndex(i);
      const total = gradeDef.tuition;
      const invoiceStatus =
        state === "paid"
          ? "paid"
          : state === "partial"
            ? "partial"
            : state === "overdue"
              ? "overdue"
              : "unpaid";
      const dueDate = state === "overdue" ? duePast : dueFuture;

      const [invoice] = await db
        .insert(invoices)
        .values({
          tenantId,
          studentId: student!.id,
          enrollmentId: enrollment!.id,
          familyGroupId: family!.id,
          source: "enrollment",
          invoiceNumber: buildInvoiceNumber(
            new Date(issueDate),
            `${gradeDef.code}${seq}`
          ),
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
        description: `${gradeDef.name} tuition — Term 1`,
        quantity: "1",
        unitAmount: String(total),
        total: String(total)
      });

      if (state === "paid" || state === "partial") {
        const amount = state === "paid" ? total : Math.round(total / 2);
        const method = i % 3 === 0 ? "kbzpay" : i % 3 === 1 ? "cash" : "wavepay";
        const [payment] = await db
          .insert(payments)
          .values({
            tenantId,
            invoiceId: invoice!.id,
            kind: "payment",
            amount: String(amount),
            method,
            referenceNumber: method === "cash" ? null : `TXN-${admissionNumber}`,
            paidAt: new Date("2026-06-12T03:00:00Z"),
            verifiedAt: new Date("2026-06-12T03:00:00Z")
          })
          .returning({ id: payments.id });

        await db.insert(receipts).values({
          tenantId,
          paymentId: payment!.id,
          receiptNumber: `PKR-${gradeDef.code}-${seq}`,
          issuedAt: new Date("2026-06-12T03:00:00Z")
        });
      }
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

  const [existingFamily] = await db
    .select({ id: familyGroups.id })
    .from(familyGroups)
    .where(and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.name, "Kyaw Family")));

  let familyGroupId = existingFamily?.id;

  if (!familyGroupId) {
    const [legacyFamily] = await db
      .select({ id: familyGroups.id })
      .from(familyGroups)
      .where(and(eq(familyGroups.tenantId, tenantId), eq(familyGroups.name, "Demo Kyaw Family")));

    if (legacyFamily) {
      await db
        .update(familyGroups)
        .set({ name: "Kyaw Family" })
        .where(eq(familyGroups.id, legacyFamily.id));
      familyGroupId = legacyFamily.id;
    }
  }

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
        name: "Kyaw Family",
        primaryGuardianId: guardian!.id
      })
      .returning({ id: familyGroups.id });

    familyGroupId = family!.id;
  }

  const directoryName = (index: number) => {
    const base = SEED_DIRECTORY_NAMES[index % SEED_DIRECTORY_NAMES.length]!;
    const prefix = index % 2 === 0 ? "Ma" : "Mg";
    return `${prefix} ${base}`;
  };

  const ensureDirectoryStudent = async (
    admissionNumber: string,
    fullName: string,
    status: "draft" | "enrolled",
    legacyAdmissionNumber?: string
  ) => {
    const [existing] = await db
      .select({ id: students.id, admissionNumber: students.admissionNumber })
      .from(students)
      .where(
        and(
          eq(students.tenantId, tenantId),
          legacyAdmissionNumber
            ? or(
                eq(students.admissionNumber, admissionNumber),
                eq(students.admissionNumber, legacyAdmissionNumber)
              )
            : eq(students.admissionNumber, admissionNumber)
        )
      );

    if (existing) {
      await db
        .update(students)
        .set({
          familyGroupId,
          status,
          fullName,
          admissionNumber
        })
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
        dateOfBirth: admissionNumber === "YIA-26-001" ? "2018-03-15" : "2020-08-20",
        status
      })
      .returning({ id: students.id });

    return created!.id;
  };

  const olderStudentId = await ensureDirectoryStudent(
    "YIA-26-001",
    "Mg Maung Maung Kyaw",
    "enrolled",
    "DEMO-001"
  );
  await ensureDirectoryStudent("YIA-26-002", "Ma Hla Kyaw", "draft", "DEMO-002");

  for (let i = 3; i <= 102; i += 1) {
    const num = String(i).padStart(3, "0");
    const legacyNum = `DEMO-${num}`;
    await ensureDirectoryStudent(
      `YIA-26-${num}`,
      directoryName(i - 3),
      i % 5 === 0 ? "enrolled" : "draft",
      legacyNum
    );
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
