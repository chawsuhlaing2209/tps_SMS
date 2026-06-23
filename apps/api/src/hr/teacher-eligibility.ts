import type { TeacherProfileCapability } from "../db/schema.js";

export type TeacherAssignmentSnapshot = {
  subjectIds: string[];
  gradeIds: string[];
};

export type ResolvedTeacherCapability = {
  competentSubjectIds: string[];
  eligibleGradeIds: string[];
};

export function buildTeacherAssignmentSnapshot(input: {
  subjectTeaching: Array<{ subjectId: string; gradeId: string }>;
  homeroom: Array<{ gradeId: string }>;
  gradeChief: Array<{ gradeId: string }>;
}): TeacherAssignmentSnapshot {
  const subjectIds = new Set<string>();
  const gradeIds = new Set<string>();

  for (const row of input.subjectTeaching) {
    subjectIds.add(row.subjectId);
    gradeIds.add(row.gradeId);
  }
  for (const row of input.homeroom) {
    gradeIds.add(row.gradeId);
  }
  for (const row of input.gradeChief) {
    gradeIds.add(row.gradeId);
  }

  return {
    subjectIds: [...subjectIds],
    gradeIds: [...gradeIds]
  };
}

/** Merges stored profile with assignment history when capability fields were never configured. */
export function resolveTeacherCapability(
  profile: TeacherProfileCapability | null | undefined,
  snapshot: TeacherAssignmentSnapshot
): ResolvedTeacherCapability {
  let competentSubjectIds = profile?.competentSubjectIds ?? [];
  let eligibleGradeIds = profile?.eligibleGradeIds ?? [];

  if (competentSubjectIds.length === 0 && snapshot.subjectIds.length > 0) {
    competentSubjectIds = snapshot.subjectIds;
  }
  if (eligibleGradeIds.length === 0 && snapshot.gradeIds.length > 0) {
    eligibleGradeIds = snapshot.gradeIds;
  }

  return { competentSubjectIds, eligibleGradeIds };
}

export function isTeacherEligibleForClassroomSubject(
  capability: ResolvedTeacherCapability,
  gradeId: string,
  subjectId: string
) {
  return (
    capability.competentSubjectIds.includes(subjectId) &&
    capability.eligibleGradeIds.includes(gradeId)
  );
}

export function isTeacherEligibleForHomeroom(
  capability: ResolvedTeacherCapability,
  gradeId: string
) {
  return capability.eligibleGradeIds.includes(gradeId);
}
