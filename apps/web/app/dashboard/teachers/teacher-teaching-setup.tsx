"use client";

import { useTranslations } from "next-intl";
import type { UpdateTeacherTeachingSetupInput } from "@sms/shared";
import { CheckBox, CheckboxList, PdsSelectField } from "../../../components/pds";
import { EmptyState } from "../../../components/shared/empty-state";
import { Toggle } from "../../../components/shared/toggle";
import { Icon } from "../../lib/material-icon";

export type TeachingSetupOptions = {
  academicYears: { id: string; name: string; status: string }[];
  grades: { id: string; name: string; sortOrder: number }[];
  subjects: { id: string; name: string; code: string | null }[];
  sectors: { id: string; name: string; sortOrder: number; gradeIds: string[] }[];
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

export type ClassroomAssignmentRow = {
  key: string;
  classroomId: string;
  homeroom: boolean;
  subjectId: string;
};

export type TeachingSetupDraft = {
  sectorIds: string[];
  competentSubjectIds: string[];
  eligibleGradeIds: string[];
  isGradeChief: boolean;
  chiefGradeIds: string[];
  classroomRows: ClassroomAssignmentRow[];
};

export const emptyTeachingSetupDraft: TeachingSetupDraft = {
  sectorIds: [],
  competentSubjectIds: [],
  eligibleGradeIds: [],
  isGradeChief: false,
  chiefGradeIds: [],
  classroomRows: []
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function newRowKey() {
  return `row-${Math.random().toString(36).slice(2, 9)}`;
}

function classroomGradeId(options: TeachingSetupOptions | undefined, classroomId: string) {
  return options?.classrooms.find((row) => row.id === classroomId)?.gradeId;
}

function gradesForSectors(options: TeachingSetupOptions | undefined, sectorIds: string[]) {
  const grades = options?.grades ?? [];
  if (!options?.sectors.length || !sectorIds.length) {
    return grades;
  }
  const allowed = new Set<string>();
  for (const sectorId of sectorIds) {
    const sector = options.sectors.find((row) => row.id === sectorId);
    for (const gradeId of sector?.gradeIds ?? []) {
      allowed.add(gradeId);
    }
  }
  return grades.filter((grade) => allowed.has(grade.id));
}

export function teachingSetupToDraft(
  existing: {
    capability: {
      sectorIds: string[];
      competentSubjectIds: string[];
      eligibleGradeIds: string[];
    };
    assignments: {
      gradeChief: { gradeId: string }[];
      homeroom: { classroomId: string }[];
      subjectTeaching: { classroomId: string; subjectId: string }[];
    };
  },
  options: TeachingSetupOptions | undefined
): TeachingSetupDraft {
  const homeroomIds = new Set(existing.assignments.homeroom.map((row) => row.classroomId));
  const rows: ClassroomAssignmentRow[] = [];

  for (const row of existing.assignments.subjectTeaching) {
    rows.push({
      key: `${row.classroomId}:${row.subjectId}`,
      classroomId: row.classroomId,
      homeroom: homeroomIds.has(row.classroomId),
      subjectId: row.subjectId
    });
    homeroomIds.delete(row.classroomId);
  }

  for (const classroomId of homeroomIds) {
    rows.push({
      key: classroomId,
      classroomId,
      homeroom: true,
      subjectId: ""
    });
  }

  const inferredGrades = unique(
    [
      ...existing.capability.eligibleGradeIds,
      ...existing.assignments.gradeChief.map((row) => row.gradeId),
      ...existing.assignments.homeroom
        .map((row) => classroomGradeId(options, row.classroomId))
        .filter((id): id is string => Boolean(id)),
      ...existing.assignments.subjectTeaching
        .map((row) => classroomGradeId(options, row.classroomId))
        .filter((id): id is string => Boolean(id))
    ].filter(Boolean)
  );

  return {
    sectorIds: existing.capability.sectorIds,
    competentSubjectIds: existing.capability.competentSubjectIds,
    eligibleGradeIds:
      existing.capability.eligibleGradeIds.length > 0
        ? existing.capability.eligibleGradeIds
        : inferredGrades,
    isGradeChief: existing.assignments.gradeChief.length > 0,
    chiefGradeIds: unique(existing.assignments.gradeChief.map((row) => row.gradeId)),
    classroomRows: rows.length ? rows : [{ key: newRowKey(), classroomId: "", homeroom: false, subjectId: "" }]
  };
}

export function draftToTeachingSetup(
  draft: TeachingSetupDraft,
  options: TeachingSetupOptions | undefined
): UpdateTeacherTeachingSetupInput {
  const activeYearId = options?.academicYears[0]?.id;
  const eligible = new Set(draft.eligibleGradeIds);

  const gradeChief =
    draft.isGradeChief && activeYearId
      ? draft.chiefGradeIds
          .filter((gradeId) => eligible.has(gradeId))
          .map((gradeId) => ({ academicYearId: activeYearId, gradeId }))
      : [];

  const homeroomIds = unique(
    draft.classroomRows.filter((row) => row.homeroom && row.classroomId).map((row) => row.classroomId)
  );
  const homeroom = homeroomIds.map((classroomId) => ({ classroomId }));

  const subjectTeaching = draft.classroomRows
    .filter((row) => row.classroomId && row.subjectId)
    .filter((row) => {
      const gradeId = classroomGradeId(options, row.classroomId);
      return gradeId ? eligible.has(gradeId) : false;
    })
    .map((row) => ({ classroomId: row.classroomId, subjectId: row.subjectId }));

  return {
    capability: {
      sectorIds: draft.sectorIds,
      competentSubjectIds: draft.competentSubjectIds,
      eligibleGradeIds: draft.eligibleGradeIds
    },
    assignments: { gradeChief, homeroom, subjectTeaching }
  };
}

export function homeroomConflicts(
  draft: TeachingSetupDraft,
  options: TeachingSetupOptions | undefined,
  currentStaffId: string | undefined
): { classroomId: string; classroomName: string }[] {
  const homeroomRow = draft.classroomRows.find((row) => row.homeroom && row.classroomId);
  if (!homeroomRow?.classroomId || !options) {
    return [];
  }

  const classroom = options.classrooms.find((row) => row.id === homeroomRow.classroomId);
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

export function chiefConflicts(
  draft: TeachingSetupDraft,
  options: TeachingSetupOptions | undefined,
  currentStaffId: string | undefined
): { gradeId: string; gradeName: string; staffName: string }[] {
  if (!draft.isGradeChief || !options) {
    return [];
  }
  return draft.chiefGradeIds
    .filter((gradeId) => draft.eligibleGradeIds.includes(gradeId))
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

type Props = {
  draft: TeachingSetupDraft;
  onChange: (next: TeachingSetupDraft) => void;
  options: TeachingSetupOptions | undefined;
  currentStaffId?: string;
  loading?: boolean;
};

export function TeacherTeachingSetupFields({
  draft,
  onChange,
  options,
  currentStaffId,
  loading
}: Props) {
  const t = useTranslations("teachers");

  if (loading) {
    return <p className="pds-type-body-s-regular muted">{t("loadingTeachingSetup")}</p>;
  }

  const sectorGrades = gradesForSectors(options, draft.sectorIds);
  const gradeName = (gradeId: string) =>
    options?.grades.find((grade) => grade.id === gradeId)?.name ?? gradeId;

  const eligibleGrades = sectorGrades.filter((grade) => draft.eligibleGradeIds.includes(grade.id));

  const classroomOptions = (options?.classrooms ?? [])
    .filter((room) => draft.eligibleGradeIds.includes(room.gradeId))
    .map((room) => ({
      id: room.id,
      label: `${gradeName(room.gradeId)} · ${room.name}${room.room ? ` (${room.room})` : ""}`
    }));

  const subjectOptionsForClassroom = (classroomId: string) => {
    const gradeId = classroomGradeId(options, classroomId);
    if (!gradeId) {
      return [];
    }
    const competent = new Set(draft.competentSubjectIds);
    const gradeSubjectRows = (options?.gradeSubjects ?? []).filter((row) => row.gradeId === gradeId);
    const competentRows = gradeSubjectRows.filter((row) => competent.has(row.subjectId));
    const source = competentRows.length > 0 ? competentRows : gradeSubjectRows;
    return source.map((row) => ({
      id: row.subjectId,
      label: `${row.subjectName}${row.subjectCode ? ` (${row.subjectCode})` : ""}`
    }));
  };

  const setEligibleGradeIds = (gradeIds: string[]) => {
    const allowedGrades = new Set(gradeIds);
    const allowedClassrooms = new Set(
      (options?.classrooms ?? [])
        .filter((room) => allowedGrades.has(room.gradeId))
        .map((room) => room.id)
    );
    onChange({
      ...draft,
      eligibleGradeIds: gradeIds,
      chiefGradeIds: draft.chiefGradeIds.filter((id) => allowedGrades.has(id)),
      classroomRows: draft.classroomRows.filter(
        (row) => !row.classroomId || allowedClassrooms.has(row.classroomId)
      )
    });
  };

  const setCompetentSubjectIds = (subjectIds: string[]) => {
    const allowed = new Set(subjectIds);
    onChange({
      ...draft,
      competentSubjectIds: subjectIds,
      classroomRows: draft.classroomRows.map((row) =>
        row.subjectId && !allowed.has(row.subjectId) ? { ...row, subjectId: "" } : row
      )
    });
  };

  const conflicts = chiefConflicts(draft, options, currentStaffId);
  const homeroomConflictRows = homeroomConflicts(draft, options, currentStaffId);

  const selectSingleId = (ids: string[]) => (ids.length <= 1 ? ids : [ids[ids.length - 1]!]);

  return (
    <div className="assign-step teaching-setup">
      <section className="assign-block">
        <CheckboxList
          title={t("subjectCompetencyLabel")}
          description={t("subjectCompetencyHelp")}
          options={(options?.subjects ?? []).map((subject) => ({
            id: subject.id,
            label: `${subject.name}${subject.code ? ` (${subject.code})` : ""}`
          }))}
          selectedIds={draft.competentSubjectIds}
          onChange={setCompetentSubjectIds}
          emptyTitle={t("noSubjectsCatalog")}
        />
      </section>

      <section className="assign-block">
        <CheckboxList
          title={t("gradeEligibilityLabel")}
          description={t("gradeEligibilityHelp")}
          options={sectorGrades.map((grade) => ({ id: grade.id, label: grade.name }))}
          selectedIds={draft.eligibleGradeIds}
          onChange={setEligibleGradeIds}
          emptyTitle={t("noGradesAvailable")}
        />
      </section>

      {draft.eligibleGradeIds.length === 0 ? (
        <EmptyState compact embedded icon="school" title={t("selectGradeEligibilityFirst")} />
      ) : (
        <>
          <section className="assign-block">
            <div className="teaching-setup__classroom-head">
              <div className="assign-block__intro">
                <p className="pds-type-title-xxs-extrabold assign-block__title">{t("classroomAssignmentsLabel")}</p>
                <p className="pds-type-body-s-regular muted assign-help">{t("classroomAssignmentsHelp")}</p>
              </div>
              <button
                type="button"
                className="pds-type-body-m-bold btn-ghost btn-ghost--compact"
                onClick={() =>
                  onChange({
                    ...draft,
                    classroomRows: [
                      ...draft.classroomRows,
                      { key: newRowKey(), classroomId: "", homeroom: false, subjectId: "" }
                    ]
                  })
                }
              >
                <Icon name="add" />
                {t("addClassroomRow")}
              </button>
            </div>

            {draft.classroomRows.length === 0 ? (
              <EmptyState compact embedded icon="meeting_room" title={t("noClassroomRows")} />
            ) : (
              <div className="teaching-setup__table">
                <div className="pds-type-caption-m teaching-setup__table-header">
                  <span>{t("classroomColumn")}</span>
                  <span className="teaching-setup__col-homeroom" title={t("homeroomColumn")}>
                    {t("homeroomColumnAbbr")}
                  </span>
                  <span>{t("subjectColumn")}</span>
                  <span className="sr-only">{t("removeClassroomRow")}</span>
                </div>
                {draft.classroomRows.map((row, index) => (
                  <div key={row.key} className="teaching-setup__row">
                    <PdsSelectField
                      variant="form"
                      value={row.classroomId}
                      onValueChange={(next) => {
                        const classroomId = typeof next === "string" ? next : "";
                        const nextRows = [...draft.classroomRows];
                        nextRows[index] = { ...row, classroomId, subjectId: "" };
                        onChange({ ...draft, classroomRows: nextRows });
                      }}
                      placeholder="—"
                      options={classroomOptions.map((option) => ({
                        value: option.id,
                        label: option.label
                      }))}
                    />
                    <CheckBox
                      checked={row.homeroom}
                      size="sm"
                      showLabel={false}
                      showDescription={false}
                      label={t("homeroomColumn")}
                      onCheckedChange={(checked) => {
                        const nextRows = draft.classroomRows.map((item, rowIndex) => ({
                          ...item,
                          homeroom: checked && rowIndex === index
                        }));
                        onChange({ ...draft, classroomRows: nextRows });
                      }}
                      className="pds-type-body-s-regular teaching-setup__homeroom"
                    />
                    <PdsSelectField
                      variant="form"
                      value={row.subjectId}
                      disabled={!row.classroomId}
                      panelPosition={
                        index === draft.classroomRows.length - 1 ? "top" : "bottom"
                      }
                      onValueChange={(next) => {
                        const subjectId = typeof next === "string" ? next : "";
                        const nextRows = [...draft.classroomRows];
                        nextRows[index] = { ...row, subjectId };
                        onChange({ ...draft, classroomRows: nextRows });
                      }}
                      placeholder="—"
                      options={subjectOptionsForClassroom(row.classroomId).map((option) => ({
                        value: option.id,
                        label: option.label
                      }))}
                    />
                    <button
                      type="button"
                      className="pds-type-body-m-bold btn-ghost btn-ghost--compact teaching-setup__remove"
                      onClick={() =>
                        onChange({
                          ...draft,
                          classroomRows: draft.classroomRows.filter((item) => item.key !== row.key)
                        })
                      }
                      aria-label={t("removeClassroomRow")}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {homeroomConflictRows.map((conflict) => (
              <p key={conflict.classroomId} className="pds-type-body-s-regular assign-warning" role="alert">
                <Icon name="warning" size={16} />
                {t("homeroomConflictWarning", { classroom: conflict.classroomName })}
              </p>
            ))}
          </section>

          <section className="assign-block">
            <div className="assign-toggle">
                <Toggle
                checked={draft.isGradeChief}
                onCheckedChange={(checked) =>
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
                  options={eligibleGrades.map((grade) => ({ id: grade.id, label: grade.name }))}
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
        </>
      )}
    </div>
  );
}
