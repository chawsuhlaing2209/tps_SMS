import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import { gradeSubjects, grades, subjects } from "./schema.js";

type Db = ReturnType<typeof drizzle>;

export const STANDARD_GRADES = [
  { name: "KG", sortOrder: 0, minAge: 4, maxAge: 5 },
  { name: "Grade 1", sortOrder: 1, minAge: 6, maxAge: 7 },
  { name: "Grade 2", sortOrder: 2, minAge: 7, maxAge: 8 },
  { name: "Grade 3", sortOrder: 3, minAge: 8, maxAge: 9 },
  { name: "Grade 4", sortOrder: 4, minAge: 9, maxAge: 10 },
  { name: "Grade 5", sortOrder: 5, minAge: 10, maxAge: 11 },
  { name: "Grade 6", sortOrder: 6, minAge: 11, maxAge: 12 },
  { name: "Grade 7", sortOrder: 7, minAge: 12, maxAge: 13 },
  { name: "Grade 8", sortOrder: 8, minAge: 13, maxAge: 14 },
  { name: "Grade 9", sortOrder: 9, minAge: 14, maxAge: 15 },
  { name: "Grade 10", sortOrder: 10, minAge: 15, maxAge: 16 },
  { name: "Grade 11", sortOrder: 11, minAge: 16, maxAge: 17 },
  { name: "Grade 12", sortOrder: 12, minAge: 17, maxAge: 18 }
] as const;

/** Grades that receive classrooms, teachers, and enrollments in the demo-alpha tenant. */
export const DEMO_OPERATIONAL_GRADES = STANDARD_GRADES.filter((grade) => {
  if (grade.name === "KG") return true;
  const match = /^Grade (\d+)$/.exec(grade.name);
  return match ? Number(match[1]) <= 9 : false;
});

export const STANDARD_SUBJECTS = [
  { name: "Mathematics", code: "MATH", colorKey: "azure", iconKey: "maths" },
  { name: "English", code: "ENG", colorKey: "pomegranate", iconKey: "english" },
  { name: "Myanmar", code: "MYA", colorKey: "yellow", iconKey: "myanmar" },
  { name: "Science", code: "SCI", colorKey: "green", iconKey: "biology" },
  { name: "Physics", code: "PHY", colorKey: "purple", iconKey: "physics" },
  { name: "Chemistry", code: "CHEM", colorKey: "cyan", iconKey: "chem" },
  { name: "Biology", code: "BIO", colorKey: "pink", iconKey: "biology" },
  { name: "Social Studies", code: "SOC", colorKey: "blue", iconKey: "social_sci" },
  { name: "History", code: "HIS", colorKey: "yellow", iconKey: "history" },
  { name: "ICT", code: "ICT", colorKey: "azure", iconKey: "ict" },
  { name: "Art", code: "ART", colorKey: "pink", iconKey: "art" },
  { name: "Music", code: "MUS", colorKey: "purple", iconKey: "music" },
  { name: "Physical Education", code: "PE", colorKey: "green", iconKey: "sport" }
] as const;

const PRIMARY_CODES = ["MATH", "ENG", "MYA", "SCI", "ART", "MUS", "PE", "ICT"] as const;
const MIDDLE_CODES = [...PRIMARY_CODES, "SOC", "HIS"] as const;
const HIGH_CODES = ["MATH", "ENG", "MYA", "PHY", "CHEM", "BIO", "SOC", "HIS", "ICT", "PE"] as const;
const KG_CODES = ["MATH", "ENG", "MYA", "ART", "MUS", "PE"] as const;

export function subjectCodesForGrade(gradeName: string): readonly string[] {
  if (gradeName === "KG") return KG_CODES;
  const match = /^Grade (\d+)$/.exec(gradeName);
  if (!match) return PRIMARY_CODES;
  const level = Number(match[1]);
  if (level <= 5) return PRIMARY_CODES;
  if (level <= 9) return MIDDLE_CODES;
  return HIGH_CODES;
}

export type AcademicCatalog = {
  gradeIds: Map<string, string>;
  subjectIds: Map<string, string>;
};

async function ensureGradeRow(
  db: Db,
  tenantId: string,
  input: (typeof STANDARD_GRADES)[number]
) {
  const [existing] = await db
    .select({ id: grades.id })
    .from(grades)
    .where(and(eq(grades.tenantId, tenantId), eq(grades.name, input.name)));

  if (existing) {
    await db
      .update(grades)
      .set({
        sortOrder: input.sortOrder,
        minAge: input.minAge,
        maxAge: input.maxAge,
        status: "active"
      })
      .where(eq(grades.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(grades)
    .values({
      tenantId,
      name: input.name,
      sortOrder: input.sortOrder,
      minAge: input.minAge,
      maxAge: input.maxAge,
      status: "active"
    })
    .returning({ id: grades.id });

  return created!.id;
}

async function ensureSubjectRow(
  db: Db,
  tenantId: string,
  input: (typeof STANDARD_SUBJECTS)[number]
) {
  const [existing] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.tenantId, tenantId), eq(subjects.code, input.code)));

  if (existing) {
    await db
      .update(subjects)
      .set({
        name: input.name,
        colorKey: input.colorKey,
        iconKey: input.iconKey,
        status: "active"
      })
      .where(eq(subjects.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(subjects)
    .values({
      tenantId,
      name: input.name,
      code: input.code,
      colorKey: input.colorKey,
      iconKey: input.iconKey,
      status: "active"
    })
    .returning({ id: subjects.id });

  return created!.id;
}

/** Ensures KG + Grade 1–12 and the full subject catalog with year-scoped grade mappings. */
export async function seedAcademicCatalog(
  db: Db,
  tenantId: string,
  academicYearId: string
): Promise<AcademicCatalog> {
  const gradeIds = new Map<string, string>();
  for (const grade of STANDARD_GRADES) {
    gradeIds.set(grade.name, await ensureGradeRow(db, tenantId, grade));
  }

  const subjectIds = new Map<string, string>();
  for (const subject of STANDARD_SUBJECTS) {
    subjectIds.set(subject.code, await ensureSubjectRow(db, tenantId, subject));
  }

  for (const grade of STANDARD_GRADES) {
    const gradeId = gradeIds.get(grade.name)!;
    for (const code of subjectCodesForGrade(grade.name)) {
      const subjectId = subjectIds.get(code);
      if (!subjectId) continue;

      const [existing] = await db
        .select({ id: gradeSubjects.id })
        .from(gradeSubjects)
        .where(
          and(
            eq(gradeSubjects.tenantId, tenantId),
            eq(gradeSubjects.academicYearId, academicYearId),
            eq(gradeSubjects.gradeId, gradeId),
            eq(gradeSubjects.subjectId, subjectId)
          )
        );

      if (!existing) {
        await db.insert(gradeSubjects).values({
          tenantId,
          academicYearId,
          gradeId,
          subjectId
        });
      }
    }
  }

  return { gradeIds, subjectIds };
}
