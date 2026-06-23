import { and, eq, inArray, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/node-postgres";
import {
  classroomStudents,
  classroomSubjectTeachers,
  classrooms,
  grades,
  subjects,
  timetablePeriods,
  timetableSlots
} from "./schema.js";
import { subjectCodesForGrade } from "./seed-academic-catalog.js";

type Db = ReturnType<typeof drizzle>;

/** Weekly lesson counts by curriculum band — mirrors a typical Myanmar international school load. */
const WEEKLY_LESSON_TARGETS: Record<string, Record<string, number>> = {
  kg: { MATH: 4, ENG: 4, MYA: 3, ART: 2, MUS: 2, PE: 2 },
  primary: { MATH: 5, ENG: 5, MYA: 4, SCI: 3, ART: 2, MUS: 1, PE: 2, ICT: 2 },
  middle: { MATH: 5, ENG: 5, MYA: 3, SCI: 4, SOC: 2, HIS: 2, ART: 1, MUS: 1, PE: 2, ICT: 2 },
  high: { MATH: 5, ENG: 5, MYA: 3, PHY: 3, CHEM: 3, BIO: 3, SOC: 2, HIS: 2, PE: 2, ICT: 2 }
};

const WORKING_DAYS = [1, 2, 3, 4, 5] as const;
const EFFECTIVE_FROM = "2026-06-01";

/** Classrooms with enrolled students first, then remaining homeroom sections. */
const CLASSROOM_PRIORITY = [
  "KG-A",
  "Room A",
  "G5-A",
  "G9-A",
  "G8-A",
  "G7-A",
  "G2-A",
  "G3-A",
  "G4-A",
  "G6-A",
  "Room B"
] as const;

function curriculumBand(gradeName: string): keyof typeof WEEKLY_LESSON_TARGETS {
  if (gradeName === "KG") return "kg";
  const level = /^Grade (\d+)$/.exec(gradeName);
  if (!level) return "primary";
  const n = Number(level[1]);
  if (n <= 5) return "primary";
  if (n <= 9) return "middle";
  return "high";
}

function buildSubjectQueue(gradeName: string): string[] {
  const band = curriculumBand(gradeName);
  const targets = WEEKLY_LESSON_TARGETS[band] ?? {};
  const allowed = new Set(subjectCodesForGrade(gradeName));
  const queue: string[] = [];

  const order =
    band === "kg"
      ? ["MATH", "ENG", "MYA", "ART", "MUS", "PE"]
      : band === "primary"
        ? ["MATH", "ENG", "MYA", "SCI", "ART", "MUS", "PE", "ICT"]
        : band === "middle"
          ? ["MATH", "ENG", "MYA", "SCI", "SOC", "HIS", "ICT", "PE", "ART", "MUS"]
          : ["MATH", "ENG", "MYA", "PHY", "CHEM", "BIO", "SOC", "HIS", "ICT", "PE"];

  for (const code of order) {
    if (!allowed.has(code)) continue;
    const count = targets[code] ?? 1;
    for (let i = 0; i < count; i += 1) {
      queue.push(code);
    }
  }

  return queue;
}

function busyKey(staffId: string, day: number, periodId: string) {
  return `${staffId}:${day}:${periodId}`;
}

function classroomKey(classroomId: string, day: number, periodId: string) {
  return `${classroomId}:${day}:${periodId}`;
}

/**
 * Builds conflict-free weekly timetables from classroom subject assignments.
 * Core subjects fill earlier periods; specialists are staggered across sections.
 */
export async function seedDemoTimetable(
  db: Db,
  tenantId: string,
  academicYearId: string,
  actorUserId: string
) {
  const lessonPeriods = await db
    .select({
      id: timetablePeriods.id,
      sortOrder: timetablePeriods.sortOrder
    })
    .from(timetablePeriods)
    .where(
      and(
        eq(timetablePeriods.tenantId, tenantId),
        eq(timetablePeriods.academicYearId, academicYearId),
        eq(timetablePeriods.isBreak, false)
      )
    )
    .orderBy(timetablePeriods.sortOrder);

  if (!lessonPeriods.length) {
    return { slotsCreated: 0 };
  }

  const classroomRows = await db
    .select({
      id: classrooms.id,
      name: classrooms.name,
      gradeName: grades.name,
      room: classrooms.room,
      enrolledCount: sql<number>`count(distinct ${classroomStudents.studentId})::int`
    })
    .from(classrooms)
    .innerJoin(grades, eq(classrooms.gradeId, grades.id))
    .leftJoin(
      classroomStudents,
      and(
        eq(classroomStudents.classroomId, classrooms.id),
        eq(classroomStudents.tenantId, tenantId),
        sql`${classroomStudents.effectiveTo} IS NULL`
      )
    )
    .where(
      and(
        eq(classrooms.tenantId, tenantId),
        eq(classrooms.academicYearId, academicYearId),
        eq(classrooms.status, "active")
      )
    )
    .groupBy(classrooms.id, classrooms.name, grades.name, classrooms.room);

  const assignmentRows = await db
    .select({
      classroomId: classroomSubjectTeachers.classroomId,
      subjectCode: subjects.code,
      teacherStaffId: classroomSubjectTeachers.teacherStaffId,
      subjectId: classroomSubjectTeachers.subjectId
    })
    .from(classroomSubjectTeachers)
    .innerJoin(subjects, eq(classroomSubjectTeachers.subjectId, subjects.id))
    .innerJoin(classrooms, eq(classroomSubjectTeachers.classroomId, classrooms.id))
    .where(
      and(
        eq(classroomSubjectTeachers.tenantId, tenantId),
        eq(classrooms.academicYearId, academicYearId),
        eq(classrooms.status, "active")
      )
    );

  const assignmentByClassroom = new Map<
    string,
    Map<string, { subjectId: string; teacherStaffId: string }>
  >();
  for (const row of assignmentRows) {
    if (!row.subjectCode) continue;
    const bucket = assignmentByClassroom.get(row.classroomId) ?? new Map();
    bucket.set(row.subjectCode, {
      subjectId: row.subjectId,
      teacherStaffId: row.teacherStaffId
    });
    assignmentByClassroom.set(row.classroomId, bucket);
  }

  const classroomByName = new Map(classroomRows.map((row) => [row.name, row]));

  const orderedClassrooms = [
    ...CLASSROOM_PRIORITY.flatMap((name) => {
      const row = classroomByName.get(name);
      return row ? [row] : [];
    }),
    ...classroomRows.filter((row) => !CLASSROOM_PRIORITY.includes(row.name as (typeof CLASSROOM_PRIORITY)[number]))
  ];

  const periodIds = lessonPeriods.map((period) => period.id);

  await db
    .delete(timetableSlots)
    .where(
      and(eq(timetableSlots.tenantId, tenantId), inArray(timetableSlots.periodId, periodIds))
    );

  const teacherBusy = new Set<string>();
  const classroomBusy = new Set<string>();
  const slotsToInsert: Array<{
    tenantId: string;
    classroomId: string;
    subjectId: string;
    teacherStaffId: string;
    periodId: string;
    dayOfWeek: number;
    room: string | null;
    effectiveFrom: string;
    publishedAt: Date;
    createdBy: string;
    updatedBy: string;
  }> = [];

  for (const classroom of orderedClassrooms) {
    const assignments = assignmentByClassroom.get(classroom.id);
    if (!assignments?.size) continue;

    const queue = buildSubjectQueue(classroom.gradeName);
    let placed = 0;

    for (const subjectCode of queue) {
      const assignment = assignments.get(subjectCode);
      if (!assignment) continue;

      let slotPlaced = false;

      for (const day of WORKING_DAYS) {
        if (slotPlaced) break;
        for (const periodId of periodIds) {
          const cKey = classroomKey(classroom.id, day, periodId);
          if (classroomBusy.has(cKey)) continue;

          const tKey = busyKey(assignment.teacherStaffId, day, periodId);
          if (teacherBusy.has(tKey)) continue;

          classroomBusy.add(cKey);
          teacherBusy.add(tKey);
          slotsToInsert.push({
            tenantId,
            classroomId: classroom.id,
            subjectId: assignment.subjectId,
            teacherStaffId: assignment.teacherStaffId,
            periodId,
            dayOfWeek: day,
            room: classroom.room,
            effectiveFrom: EFFECTIVE_FROM,
            publishedAt: new Date("2026-06-01T00:00:00Z"),
            createdBy: actorUserId,
            updatedBy: actorUserId
          });
          placed += 1;
          slotPlaced = true;
          break;
        }
      }
    }

    if (classroom.enrolledCount > 0 && placed < Math.min(queue.length, WORKING_DAYS.length * periodIds.length)) {
      // Enrolled sections should have a near-complete grid; log is unnecessary in seed.
    }
  }

  if (slotsToInsert.length) {
    await db.insert(timetableSlots).values(slotsToInsert);
  }

  return { slotsCreated: slotsToInsert.length };
}
