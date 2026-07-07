"use client";

import { useTranslations } from "next-intl";
import type { UpdateTeacherAssignmentsInput } from "@sms/shared";
import { CheckboxList } from "../../../components/pds";
import { EmptyState } from "../../../components/shared/empty-state";
import { Toggle } from "../../../components/shared/toggle";
import { Icon } from "../../lib/material-icon";

export type AssignmentOptions = {
  academicYears: { id: string; name: string; status: string }[];
  grades: { id: string; name: string; sortOrder: number }[];
  classrooms: {
    id: string;
    name: string;
    academicYearId: string;
    gradeId: string;
    sectionId: string | null;
    room: string | null;
    classTeacherStaffId: string | null;
  }[];
  gradeSubjects: {
    academicYearId: string;
    gradeId: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
  }[];
  gradeChiefs: {
    academicYearId: string;
    gradeId: string;
    staffId: string;
    staffName: string;
  }[];
};

/** Grade-first wizard state. Persisted shape is derived from this at save time. */
export type AssignmentDraft = {
  gradeIds: string[];
  isGradeChief: boolean;
  chiefGradeIds: string[];
  isHomeroom: boolean;
  homeroomClassroomIds: string[];
  /** `${gradeId}:${subjectId}` keys. */
  subjectKeys: string[];
};

export const emptyAssignmentDraft: AssignmentDraft = {
  gradeIds: [],
  isGradeChief: false,
  chiefGradeIds: [],
  isHomeroom: false,
  homeroomClassroomIds: [],
  subjectKeys: []
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

/** Build the active-year subject-teaching grade key for a classroom row. */
function classroomGradeId(options: AssignmentOptions | undefined, classroomId: string) {
  return options?.classrooms.find((row) => row.id === classroomId)?.gradeId;
}

/** Reverse-map persisted teacher assignments into the grade-first wizard draft. */
export function assignmentsToDraft(
  existing: {
    gradeChief: { academicYearId: string; gradeId: string }[];
    homeroom: { classroomId: string }[];
    subjectTeaching: { classroomId: string; subjectId: string }[];
  },
  options: AssignmentOptions | undefined
): AssignmentDraft {
  const chiefGradeIds = unique(existing.gradeChief.map((row) => row.gradeId));
  const homeroomClassroomIds = unique(existing.homeroom.map((row) => row.classroomId));

  const subjectKeys = unique(
    existing.subjectTeaching
      .map((row) => {
        const gradeId = classroomGradeId(options, row.classroomId);
        return gradeId ? `${gradeId}:${row.subjectId}` : null;
      })
      .filter((key): key is string => key !== null)
  );

  const homeroomGradeIds = homeroomClassroomIds
    .map((id) => classroomGradeId(options, id))
    .filter((id): id is string => Boolean(id));
  const subjectGradeIds = subjectKeys.map((key) => key.split(":")[0]!);

  const gradeIds = unique([...chiefGradeIds, ...homeroomGradeIds, ...subjectGradeIds]);

  return {
    gradeIds,
    isGradeChief: chiefGradeIds.length > 0,
    chiefGradeIds,
    isHomeroom: homeroomClassroomIds.length > 0,
    homeroomClassroomIds,
    subjectKeys
  };
}

/**
 * Expand the grade-first draft into the persisted (classroom-centric) shape.
 * Subject teaching for a grade fans out to every active-year classroom of that grade,
 * keeping the data valid for room-detail and gradebook readers.
 */
export function draftToAssignments(
  draft: AssignmentDraft,
  options: AssignmentOptions | undefined
): UpdateTeacherAssignmentsInput {
  const activeYearId = options?.academicYears[0]?.id;

  const gradeChief =
    draft.isGradeChief && activeYearId
      ? draft.chiefGradeIds
          .filter((gradeId) => draft.gradeIds.includes(gradeId))
          .map((gradeId) => ({ academicYearId: activeYearId, gradeId }))
      : [];

  const homeroom = draft.isHomeroom
    ? draft.homeroomClassroomIds
        .filter((classroomId) => {
          const gradeId = classroomGradeId(options, classroomId);
          return gradeId ? draft.gradeIds.includes(gradeId) : false;
        })
        .map((classroomId) => ({ classroomId }))
    : [];

  const subjectTeaching: { classroomId: string; subjectId: string }[] = [];
  for (const key of draft.subjectKeys) {
    const [gradeId, subjectId] = key.split(":");
    if (!gradeId || !subjectId || !draft.gradeIds.includes(gradeId)) {
      continue;
    }
    const rooms = options?.classrooms.filter((room) => room.gradeId === gradeId) ?? [];
    for (const room of rooms) {
      subjectTeaching.push({ classroomId: room.id, subjectId });
    }
  }

  return { gradeChief, homeroom, subjectTeaching };
}

/** Grade chiefs already owned by someone other than the staff being edited. */
export function chiefConflicts(
  draft: AssignmentDraft,
  options: AssignmentOptions | undefined,
  currentStaffId: string | undefined
): { gradeId: string; gradeName: string; staffName: string }[] {
  if (!draft.isGradeChief || !options) {
    return [];
  }
  return draft.chiefGradeIds
    .filter((gradeId) => draft.gradeIds.includes(gradeId))
    .map((gradeId) => {
      const existing = options.gradeChiefs.find(
        (row) => row.gradeId === gradeId && row.staffId !== currentStaffId
      );
      if (!existing) {
        return null;
      }
      const gradeName = options.grades.find((grade) => grade.id === gradeId)?.name ?? gradeId;
      return { gradeId, gradeName, staffName: existing.staffName };
    })
    .filter((row): row is { gradeId: string; gradeName: string; staffName: string } => row !== null);
}

export function homeroomConflicts(
  draft: AssignmentDraft,
  options: AssignmentOptions | undefined,
  currentStaffId: string | undefined
): { classroomId: string; classroomName: string }[] {
  const homeroomId = draft.homeroomClassroomIds[0];
  if (!homeroomId || !options) {
    return [];
  }

  const classroom = options.classrooms.find((row) => row.id === homeroomId);
  if (
    !classroom?.classTeacherStaffId ||
    classroom.classTeacherStaffId === currentStaffId
  ) {
    return [];
  }

  return [
    {
      classroomId: classroom.id,
      classroomName: classroom.name
    }
  ];
}

type Props = {
  draft: AssignmentDraft;
  onChange: (next: AssignmentDraft) => void;
  options: AssignmentOptions | undefined;
  currentStaffId?: string;
  loading?: boolean;
  /** When set, only render the matching assignment block(s). */
  section?: "grade" | "homeroom" | "subject" | "all";
};

export function TeacherAssignmentFields({
  draft,
  onChange,
  options,
  currentStaffId,
  loading,
  section = "all"
}: Props) {
  const t = useTranslations("people");

  if (loading) {
    return <p className="pds-type-body-s-regular muted">{t("loadingAssignments")}</p>;
  }

  const grades = options?.grades ?? [];
  const gradeName = (gradeId: string) =>
    grades.find((grade) => grade.id === gradeId)?.name ?? gradeId;

  const selectedGrades = grades.filter((grade) => draft.gradeIds.includes(grade.id));

  const classroomOptions = (options?.classrooms ?? [])
    .filter((room) => draft.gradeIds.includes(room.gradeId))
    .map((room) => ({
      id: room.id,
      label: `${gradeName(room.gradeId)} · ${room.name}`
    }));

  const subjectOptions = (options?.gradeSubjects ?? [])
    .filter((row) => draft.gradeIds.includes(row.gradeId))
    .map((row) => ({
      id: `${row.gradeId}:${row.subjectId}`,
      label: `${gradeName(row.gradeId)} · ${row.subjectName}${
        row.subjectCode ? ` (${row.subjectCode})` : ""
      }`
    }));

  // Prune downstream selections so they never outlive the chosen grades.
  const setGradeIds = (gradeIds: string[]) => {
    const allowed = new Set(gradeIds);
    const allowedClassroomIds = new Set(
      (options?.classrooms ?? [])
        .filter((room) => allowed.has(room.gradeId))
        .map((room) => room.id)
    );
    const allowedSubjectKeys = new Set(
      (options?.gradeSubjects ?? [])
        .filter((row) => allowed.has(row.gradeId))
        .map((row) => `${row.gradeId}:${row.subjectId}`)
    );
    onChange({
      ...draft,
      gradeIds,
      chiefGradeIds: draft.chiefGradeIds.filter((id) => allowed.has(id)),
      homeroomClassroomIds: draft.homeroomClassroomIds.filter((id) =>
        allowedClassroomIds.has(id)
      ),
      subjectKeys: draft.subjectKeys.filter((key) => allowedSubjectKeys.has(key))
    });
  };

  const conflicts = chiefConflicts(draft, options, currentStaffId);
  const homeroomConflictRows = homeroomConflicts(draft, options, currentStaffId);
  const selectSingleId = (ids: string[]) => (ids.length <= 1 ? ids : [ids[ids.length - 1]!]);

  const showGrades = section === "all" || section === "grade";
  const showHomeroom = section === "all" || section === "homeroom";
  const showSubjects = section === "all" || section === "subject";
  const needsGradePicker =
    section === "all" || section === "grade" || section === "homeroom" || section === "subject";

  return (
    <div className="assign-step">
      {needsGradePicker ? (
        <section className="assign-block">
          <CheckboxList
            title={t("gradeMembershipLabel")}
            description={t("gradeMembershipHelp")}
            options={grades.map((grade) => ({ id: grade.id, label: grade.name }))}
            selectedIds={draft.gradeIds}
            onChange={setGradeIds}
            emptyTitle={t("noGradesAvailable")}
          />
        </section>
      ) : null}

      {draft.gradeIds.length === 0 && needsGradePicker ? (
        <EmptyState compact embedded icon="school" title={t("selectGradeFirst")} />
      ) : null}

      {draft.gradeIds.length > 0 || !needsGradePicker ? (
        <>
          {showGrades ? (
            <section className="assign-block">
              <div className="assign-toggle">
                <Toggle
                  checked={draft.isGradeChief}
                  onCheckedChange={(checked: boolean) =>
                    onChange({
                      ...draft,
                      isGradeChief: checked,
                      chiefGradeIds: checked ? draft.chiefGradeIds : []
                    })
                  }
                  aria-label={t("gradeChiefToggle")}
                />
                <div>
                  <strong>{t("gradeChiefToggle")}</strong>
                  <p className="pds-type-body-s-regular muted assign-help">{t("gradeChiefHelp")}</p>
                </div>
              </div>
              {draft.isGradeChief ? (
                <>
                  <CheckboxList
                    options={selectedGrades.map((grade) => ({ id: grade.id, label: grade.name }))}
                    selectedIds={draft.chiefGradeIds}
                    onChange={(ids) => onChange({ ...draft, chiefGradeIds: selectSingleId(ids) })}
                  />
                  {conflicts.map((conflict) => (
                    <p key={conflict.gradeId} className="pds-type-body-s-regular assign-warning" role="alert">
                      <Icon name="warning" size={16} />
                      {t("chiefConflictWarning", {
                        grade: conflict.gradeName,
                        teacher: conflict.staffName
                      })}
                    </p>
                  ))}
                </>
              ) : null}
            </section>
          ) : null}

          {showHomeroom ? (
            <section className="assign-block">
              <div className="assign-toggle">
                <Toggle
                  checked={draft.isHomeroom}
                  onCheckedChange={(checked: boolean) =>
                    onChange({
                      ...draft,
                      isHomeroom: checked,
                      homeroomClassroomIds: checked ? draft.homeroomClassroomIds : []
                    })
                  }
                  aria-label={t("homeroomToggle")}
                />
                <div>
                  <strong>{t("homeroomToggle")}</strong>
                  <p className="pds-type-body-s-regular muted assign-help">{t("homeroomHelp")}</p>
                </div>
              </div>
              {draft.isHomeroom ? (
                <>
                  <CheckboxList
                    options={classroomOptions}
                    selectedIds={draft.homeroomClassroomIds}
                    onChange={(ids) =>
                      onChange({ ...draft, homeroomClassroomIds: selectSingleId(ids) })
                    }
                    emptyTitle={t("noClassroomsForGrades")}
                  />
                  {homeroomConflictRows.map((conflict) => (
                    <p key={conflict.classroomId} className="pds-type-body-s-regular assign-warning" role="alert">
                      <Icon name="warning" size={16} />
                      {t("homeroomConflictWarning", { classroom: conflict.classroomName })}
                    </p>
                  ))}
                </>
              ) : null}
            </section>
          ) : null}

          {showSubjects ? (
            <section className="assign-block">
              <CheckboxList
                title={t("subjectsTaughtLabel")}
                description={t("subjectsTaughtHelp")}
                options={subjectOptions}
                selectedIds={draft.subjectKeys}
                onChange={(ids) => onChange({ ...draft, subjectKeys: ids })}
                emptyTitle={t("noSubjectsForGrades")}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
