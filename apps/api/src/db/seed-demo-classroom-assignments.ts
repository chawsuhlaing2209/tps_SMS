import { and, eq, inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import {
  classroomSubjectTeachers,
  classrooms,
  gradeChiefAssignments,
  grades,
  staff,
  users
} from "./schema.js";
import type { AcademicCatalog } from "./seed-academic-catalog.js";
import { subjectCodesForGrade } from "./seed-academic-catalog.js";

type Db = ReturnType<typeof drizzle>;

/** Internal keys matching demo teacher email suffixes in seed-demo-teachers.ts */
type TeacherKey =
  | "niNi"
  | "pyone"
  | "khinSandar"
  | "minThu"
  | "thiriMon"
  | "kyawZin"
  | "eiMon"
  | "zawBo"
  | "soeWin"
  | "heinZaw"
  | "phyuPhyu"
  | "mayThin"
  | "nilar";

const TEACHER_EMAIL_SUFFIX: Record<TeacherKey, string> = {
  niNi: "teacher",
  pyone: "teacher.kg",
  khinSandar: "teacher.english",
  minThu: "teacher.myanmar",
  thiriMon: "teacher.science",
  kyawZin: "teacher.math2",
  eiMon: "teacher.english2",
  zawBo: "teacher.social",
  soeWin: "teacher.ict",
  heinZaw: "teacher.physics",
  phyuPhyu: "teacher.chemistry",
  mayThin: "teacher.biology",
  nilar: "teacher.pe"
};

/** Homeroom teacher per section — drives ART/MUS in primary & middle. */
const HOMEROOM_TEACHER_KEY: Record<string, TeacherKey> = {
  "Room A": "niNi",
  "Room B": "niNi",
  "KG-A": "pyone",
  "G2-A": "khinSandar",
  "G3-A": "minThu",
  "G4-A": "thiriMon",
  "G5-A": "kyawZin",
  "G6-A": "eiMon",
  "G7-A": "zawBo",
  "G8-A": "soeWin",
  "G9-A": "heinZaw",
  "G10-A": "heinZaw",
  "G11-A": "heinZaw",
  "G12-A": "heinZaw"
};

/** Canonical demo competencies — single source of truth for teacher profiles. */
const TEACHER_COMPETENCIES: Record<TeacherKey, { grades: string[]; subjects: string[] }> = {
  niNi: { grades: ["Grade 1"], subjects: ["MATH", "ART", "MUS"] },
  pyone: { grades: ["KG"], subjects: ["MATH", "ENG", "MYA", "ART", "MUS"] },
  khinSandar: { grades: ["Grade 2", "Grade 3"], subjects: ["ENG"] },
  minThu: {
    grades: ["Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"],
    subjects: ["MYA"]
  },
  thiriMon: {
    grades: ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8"],
    subjects: ["SCI"]
  },
  kyawZin: {
    grades: ["Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"],
    subjects: ["MATH"]
  },
  eiMon: {
    grades: ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"],
    subjects: ["ENG"]
  },
  zawBo: { grades: ["Grade 7", "Grade 8", "Grade 9"], subjects: ["SCI", "SOC", "HIS"] },
  soeWin: {
    grades: ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"],
    subjects: ["ICT"]
  },
  heinZaw: { grades: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"], subjects: ["PHY"] },
  phyuPhyu: { grades: ["Grade 10", "Grade 11", "Grade 12"], subjects: ["CHEM"] },
  mayThin: { grades: ["Grade 10", "Grade 11", "Grade 12"], subjects: ["BIO"] },
  nilar: {
    grades: [
      "KG",
      "Grade 1",
      "Grade 2",
      "Grade 3",
      "Grade 4",
      "Grade 5",
      "Grade 6",
      "Grade 7",
      "Grade 8",
      "Grade 9"
    ],
    subjects: ["PE"]
  }
};

function gradeLevel(gradeName: string): number {
  if (gradeName === "KG") return 0;
  const match = /^Grade (\d+)$/.exec(gradeName);
  return match ? Number(match[1]) : 1;
}

/**
 * Sector-scoped specialists — primary (G1–5), middle (G6–9), high (G10–12).
 * High-school teachers never teach KG–G9 subjects in seed assignments.
 */
function resolveTeacherKey(gradeName: string, subjectCode: string, homeroomKey: TeacherKey): TeacherKey {
  if (gradeName === "KG") {
    if (subjectCode === "PE") return "nilar";
    return "pyone";
  }

  const level = gradeLevel(gradeName);

  if (level <= 5) {
    switch (subjectCode) {
      case "MATH":
        return level === 1 ? "niNi" : "kyawZin";
      case "ENG":
        return level <= 3 ? "khinSandar" : "eiMon";
      case "MYA":
        return "minThu";
      case "SCI":
        return "thiriMon";
      case "ART":
      case "MUS":
        return homeroomKey;
      case "PE":
        return "nilar";
      case "ICT":
        return level >= 4 ? "soeWin" : homeroomKey;
      default:
        return homeroomKey;
    }
  }

  if (level <= 9) {
    switch (subjectCode) {
      case "MATH":
        return "kyawZin";
      case "ENG":
        return "eiMon";
      case "MYA":
        return "minThu";
      case "SCI":
        return level <= 8 ? "thiriMon" : "zawBo";
      case "SOC":
      case "HIS":
        return "zawBo";
      case "ART":
      case "MUS":
        return homeroomKey;
      case "PE":
        return "nilar";
      case "ICT":
        return "soeWin";
      default:
        return homeroomKey;
    }
  }

  switch (subjectCode) {
    case "MATH":
      return "kyawZin";
    case "ENG":
      return "eiMon";
    case "MYA":
      return "minThu";
    case "PHY":
      return "heinZaw";
    case "CHEM":
      return "phyuPhyu";
    case "BIO":
      return "mayThin";
    case "SOC":
    case "HIS":
      return "zawBo";
    case "PE":
      return "nilar";
    case "ICT":
      return "soeWin";
    default:
      return homeroomKey;
  }
}

async function loadStaffByTeacherKey(db: Db, tenantId: string, slug: string) {
  const rows = await db
    .select({ id: staff.id, email: users.email })
    .from(staff)
    .innerJoin(users, eq(staff.userId, users.id))
    .where(and(eq(staff.tenantId, tenantId), eq(staff.employmentRole, "teacher")));

  const staffByKey = new Map<TeacherKey, string>();
  for (const [key, suffix] of Object.entries(TEACHER_EMAIL_SUFFIX) as Array<
    [TeacherKey, string]
  >) {
    const email = `${suffix}@${slug}.example.edu.mm`;
    const row = rows.find((entry) => entry.email === email);
    if (row) {
      staffByKey.set(key, row.id);
    }
  }
  return staffByKey;
}

/** Assign a subject specialist to every grade subject in every active classroom. */
export async function seedDemoClassroomAssignments(
  db: Db,
  tenantId: string,
  academicYearId: string,
  slug: string,
  catalog: AcademicCatalog
) {
  const staffByKey = await loadStaffByTeacherKey(db, tenantId, slug);

  await db
    .delete(classroomSubjectTeachers)
    .where(eq(classroomSubjectTeachers.tenantId, tenantId));

  const classroomRows = await db
    .select({
      id: classrooms.id,
      name: classrooms.name,
      gradeName: grades.name
    })
    .from(classrooms)
    .innerJoin(grades, eq(classrooms.gradeId, grades.id))
    .where(
      and(
        eq(classrooms.tenantId, tenantId),
        eq(classrooms.academicYearId, academicYearId),
        eq(classrooms.status, "active")
      )
    );

  for (const classroom of classroomRows) {
    const homeroomKey = HOMEROOM_TEACHER_KEY[classroom.name];
    if (!homeroomKey) continue;

    const subjectCodes = subjectCodesForGrade(classroom.gradeName);

    for (const subjectCode of subjectCodes) {
      const teacherKey = resolveTeacherKey(classroom.gradeName, subjectCode, homeroomKey);
      const teacherStaffId = staffByKey.get(teacherKey);
      const subjectId = catalog.subjectIds.get(subjectCode);
      if (!teacherStaffId || !subjectId) continue;

      await db.insert(classroomSubjectTeachers).values({
        tenantId,
        classroomId: classroom.id,
        subjectId,
        teacherStaffId
      });
    }
  }

  await syncTeacherProfilesFromAssignments(db, tenantId, academicYearId, catalog, staffByKey);
}

async function syncTeacherProfilesFromAssignments(
  db: Db,
  tenantId: string,
  academicYearId: string,
  catalog: AcademicCatalog,
  staffByKey: Map<TeacherKey, string>
) {
  const staffIdToKey = new Map<string, TeacherKey>();
  for (const [key, staffId] of staffByKey) {
    staffIdToKey.set(staffId, key);
  }

  const teachers = await db
    .select({ id: staff.id, teacherProfile: staff.teacherProfile })
    .from(staff)
    .where(and(eq(staff.tenantId, tenantId), eq(staff.employmentRole, "teacher")));

  if (!teachers.length) {
    return;
  }

  const teacherIds = teachers.map((row) => row.id);

  const subjectRows = await db
    .select({
      teacherStaffId: classroomSubjectTeachers.teacherStaffId,
      subjectId: classroomSubjectTeachers.subjectId,
      gradeId: classrooms.gradeId
    })
    .from(classroomSubjectTeachers)
    .innerJoin(classrooms, eq(classroomSubjectTeachers.classroomId, classrooms.id))
    .where(
      and(
        eq(classroomSubjectTeachers.tenantId, tenantId),
        eq(classrooms.academicYearId, academicYearId),
        eq(classrooms.status, "active"),
        inArray(classroomSubjectTeachers.teacherStaffId, teacherIds)
      )
    );

  const homeroomRows = await db
    .select({
      teacherStaffId: classrooms.classTeacherStaffId,
      gradeId: classrooms.gradeId
    })
    .from(classrooms)
    .where(
      and(
        eq(classrooms.tenantId, tenantId),
        eq(classrooms.academicYearId, academicYearId),
        eq(classrooms.status, "active"),
        inArray(classrooms.classTeacherStaffId, teacherIds)
      )
    );

  const chiefRows = await db
    .select({
      teacherStaffId: gradeChiefAssignments.staffId,
      gradeId: gradeChiefAssignments.gradeId
    })
    .from(gradeChiefAssignments)
    .where(
      and(
        eq(gradeChiefAssignments.tenantId, tenantId),
        eq(gradeChiefAssignments.academicYearId, academicYearId),
        inArray(gradeChiefAssignments.staffId, teacherIds)
      )
    );

  for (const teacher of teachers) {
    const teacherKey = staffIdToKey.get(teacher.id);
    const explicit = teacherKey ? TEACHER_COMPETENCIES[teacherKey] : null;

    const subjectIds = new Set<string>();
    const gradeIds = new Set<string>();

    if (explicit) {
      for (const code of explicit.subjects) {
        const subjectId = catalog.subjectIds.get(code);
        if (subjectId) subjectIds.add(subjectId);
      }
      for (const gradeName of explicit.grades) {
        const gradeId = catalog.gradeIds.get(gradeName);
        if (gradeId) gradeIds.add(gradeId);
      }
    }

    for (const row of subjectRows) {
      if (row.teacherStaffId !== teacher.id) continue;
      subjectIds.add(row.subjectId);
      gradeIds.add(row.gradeId);
    }
    for (const row of homeroomRows) {
      if (row.teacherStaffId !== teacher.id) continue;
      gradeIds.add(row.gradeId);
    }
    for (const row of chiefRows) {
      if (row.teacherStaffId !== teacher.id) continue;
      gradeIds.add(row.gradeId);
    }

    const existing = teacher.teacherProfile ?? {};
    await db
      .update(staff)
      .set({
        teacherProfile: {
          sectorIds: existing.sectorIds ?? [],
          competentSubjectIds: [...subjectIds],
          eligibleGradeIds: [...gradeIds]
        }
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, teacher.id)));
  }
}

export { HOMEROOM_TEACHER_KEY, resolveTeacherKey, TEACHER_EMAIL_SUFFIX, TEACHER_COMPETENCIES };
