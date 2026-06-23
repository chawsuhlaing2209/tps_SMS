import { and, eq, notInArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import {
  attendanceSessions,
  classrooms,
  facilityRooms,
  gradeChiefAssignments,
  roles,
  staff,
  userRoles,
  users
} from "./schema.js";
import type { AcademicCatalog } from "./seed-academic-catalog.js";
import { DEMO_OPERATIONAL_GRADES } from "./seed-academic-catalog.js";

type Db = ReturnType<typeof drizzle>;

type DemoTeacherSeed = {
  emailSuffix: string;
  displayName: string;
  homeroom?: string;
  gradeChief?: string;
  salaryGross?: string;
};

const DEMO_TEACHERS: DemoTeacherSeed[] = [
  {
    emailSuffix: "teacher",
    displayName: "Daw Ni Ni",
    homeroom: "Room A",
    gradeChief: "Grade 1"
  },
  {
    emailSuffix: "teacher.kg",
    displayName: "Daw Pyone",
    homeroom: "KG-A"
  },
  {
    emailSuffix: "teacher.english",
    displayName: "Daw Khin Sandar",
    homeroom: "G2-A"
  },
  {
    emailSuffix: "teacher.myanmar",
    displayName: "U Min Thu",
    homeroom: "G3-A"
  },
  {
    emailSuffix: "teacher.science",
    displayName: "Ma Thiri Mon",
    homeroom: "G4-A"
  },
  {
    emailSuffix: "teacher.math2",
    displayName: "U Kyaw Zin",
    homeroom: "G5-A",
    gradeChief: "Grade 5"
  },
  {
    emailSuffix: "teacher.english2",
    displayName: "Daw Ei Mon",
    homeroom: "G6-A"
  },
  {
    emailSuffix: "teacher.social",
    displayName: "Mg Zaw Bo",
    homeroom: "G7-A"
  },
  {
    emailSuffix: "teacher.ict",
    displayName: "U Soe Win",
    homeroom: "G8-A"
  },
  {
    emailSuffix: "teacher.physics",
    displayName: "U Hein Zaw",
    homeroom: "G9-A",
    gradeChief: "Grade 9"
  },
  {
    emailSuffix: "teacher.chemistry",
    displayName: "Daw Phyu Phyu"
  },
  {
    emailSuffix: "teacher.biology",
    displayName: "Ma May Thin"
  },
  {
    emailSuffix: "teacher.pe",
    displayName: "Daw Nilar"
  }
];

function classroomNameForGrade(gradeName: string): string {
  if (gradeName === "KG") return "KG-A";
  if (gradeName === "Grade 1") return "Room A";
  const match = /^Grade (\d+)$/.exec(gradeName);
  return match ? `G${match[1]}-A` : `${gradeName}-A`;
}

/** Maps demo sections to seeded facility room records. */
const CLASSROOM_FACILITY_NAMES: Record<string, string> = {
  "Room A": "Main Building — Room 101",
  "Room B": "Main Building — Room 102",
  "KG-A": "Kindergarten Wing — Room A",
  "G8-A": "Computer Lab",
  "G9-A": "Science Lab A"
};

async function loadFacilityRoomIds(db: Db, tenantId: string) {
  const rows = await db
    .select({ id: facilityRooms.id, name: facilityRooms.name, capacity: facilityRooms.capacity })
    .from(facilityRooms)
    .where(eq(facilityRooms.tenantId, tenantId));

  return new Map(rows.map((row) => [row.name, row]));
}

async function ensureClassroom(
  db: Db,
  tenantId: string,
  academicYearId: string,
  gradeId: string,
  name: string,
  facilityByName: Map<string, { id: string; name: string; capacity: number | null }>,
  room?: string
) {
  const facilityName = CLASSROOM_FACILITY_NAMES[name];
  const facility = facilityName ? facilityByName.get(facilityName) : undefined;

  const [existing] = await db
    .select({ id: classrooms.id })
    .from(classrooms)
    .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.name, name)));

  if (existing) {
    await db
      .update(classrooms)
      .set({
        academicYearId,
        gradeId,
        status: "active",
        facilityRoomId: facility?.id ?? null,
        room: facility?.name ?? room ?? name,
        capacity: facility?.capacity ?? 30
      })
      .where(eq(classrooms.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(classrooms)
    .values({
      tenantId,
      academicYearId,
      gradeId,
      name,
      facilityRoomId: facility?.id ?? null,
      room: facility?.name ?? room ?? (name === "Room A" ? "Room 101" : name === "Room B" ? "Room 102" : name),
      capacity: facility?.capacity ?? 30,
      status: "active"
    })
    .returning({ id: classrooms.id });

  return created!.id;
}

async function ensureTeacherStaff(
  db: Db,
  tenantId: string,
  passwordHash: string,
  email: string,
  displayName: string
) {
  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      email,
      displayName,
      status: "active",
      passwordHash
    })
    .onConflictDoUpdate({
      target: [users.tenantId, users.email],
      set: { status: "active", passwordHash, displayName }
    })
    .returning({ id: users.id });

  const [teacherRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.key, "teacher")));

  if (user && teacherRole) {
    await db
      .insert(userRoles)
      .values({ tenantId, userId: user.id, roleId: teacherRole.id })
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
        fullName: displayName,
        employmentRole: "teacher",
        department: "Teaching",
        status: "active",
        email
      })
      .where(eq(staff.id, existingStaff.id));
    return existingStaff.id;
  }

  const [createdStaff] = await db
    .insert(staff)
    .values({
      tenantId,
      userId: user!.id,
      fullName: displayName,
      employmentRole: "teacher",
      department: "Teaching",
      email,
      status: "active"
    })
    .returning({ id: staff.id });

  return createdStaff!.id;
}

/** Classrooms for KG–Grade 9, homeroom teachers, and a sample attendance session. */
export async function seedDemoTeachers(
  db: Db,
  tenantId: string,
  academicYearId: string,
  slug: string,
  passwordHash: string,
  catalog: AcademicCatalog
) {
  const operationalGradeIds = DEMO_OPERATIONAL_GRADES.map((grade) => catalog.gradeIds.get(grade.name)).filter(
    (id): id is string => Boolean(id)
  );

  if (operationalGradeIds.length) {
    await db
      .update(classrooms)
      .set({ status: "archived", classTeacherStaffId: null })
      .where(
        and(
          eq(classrooms.tenantId, tenantId),
          eq(classrooms.academicYearId, academicYearId),
          notInArray(classrooms.gradeId, operationalGradeIds)
        )
      );
  }

  const classroomIds = new Map<string, string>();
  const facilityByName = await loadFacilityRoomIds(db, tenantId);

  for (const grade of DEMO_OPERATIONAL_GRADES) {
    const gradeId = catalog.gradeIds.get(grade.name);
    if (!gradeId) continue;

    const primaryName = classroomNameForGrade(grade.name);
    classroomIds.set(
      primaryName,
      await ensureClassroom(db, tenantId, academicYearId, gradeId, primaryName, facilityByName)
    );

    if (grade.name === "Grade 1") {
      classroomIds.set(
        "Room B",
        await ensureClassroom(db, tenantId, academicYearId, gradeId, "Room B", facilityByName, "Room 102")
      );
    }
  }

  const staffByEmail = new Map<string, string>();

  for (const teacher of DEMO_TEACHERS) {
    const email = `${teacher.emailSuffix}@${slug}.example.edu.mm`;
    const staffId = await ensureTeacherStaff(db, tenantId, passwordHash, email, teacher.displayName);
    staffByEmail.set(email, staffId);

    if (teacher.homeroom) {
      const classroomId = classroomIds.get(teacher.homeroom);
      if (classroomId) {
        await db
          .update(classrooms)
          .set({ classTeacherStaffId: staffId })
          .where(and(eq(classrooms.tenantId, tenantId), eq(classrooms.id, classroomId)));
      }
    }

    if (teacher.gradeChief) {
      const gradeId = catalog.gradeIds.get(teacher.gradeChief);
      if (gradeId) {
        await db
          .insert(gradeChiefAssignments)
          .values({ tenantId, academicYearId, gradeId, staffId })
          .onConflictDoNothing();
      }
    }
  }

  const roomAId = classroomIds.get("Room A");
  const mathId = catalog.subjectIds.get("MATH");
  const primaryTeacherId = staffByEmail.get(`teacher@${slug}.example.edu.mm`);

  if (roomAId && mathId && primaryTeacherId) {
    const [existingSession] = await db
      .select({ id: attendanceSessions.id })
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, tenantId),
          eq(attendanceSessions.classroomId, roomAId),
          eq(attendanceSessions.sessionDate, "2026-06-15")
        )
      );

    if (!existingSession) {
      await db.insert(attendanceSessions).values({
        tenantId,
        classroomId: roomAId,
        subjectId: mathId,
        sessionDate: "2026-06-15",
        submittedByStaffId: primaryTeacherId,
        submittedAt: new Date()
      });
    }
  }

  const roomBId = classroomIds.get("Room B");
  if (roomBId && mathId) {
    const [existingSessionB] = await db
      .select({ id: attendanceSessions.id })
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.tenantId, tenantId),
          eq(attendanceSessions.classroomId, roomBId),
          eq(attendanceSessions.sessionDate, "2026-06-16")
        )
      );

    if (!existingSessionB) {
      await db.insert(attendanceSessions).values({
        tenantId,
        classroomId: roomBId,
        subjectId: mathId,
        sessionDate: "2026-06-16"
      });
    }
  }

  return { classroomIds, staffByEmail };
}

export function demoTeacherEmails(slug: string): string[] {
  return DEMO_TEACHERS.map((t) => `${t.emailSuffix}@${slug}.example.edu.mm`);
}

export { DEMO_TEACHERS };
