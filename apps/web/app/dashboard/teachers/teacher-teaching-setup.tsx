"use client";

import { useTranslations } from "next-intl";
import type { UpdateTeacherTeachingSetupInput } from "@sms/shared";
import { CheckBox, CheckboxList, PdsSelectField } from "../../../components/pds";
import { Badge } from "../../../components/shared/badge";
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
  gradeId: string;
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

function sortedGrades(options: TeachingSetupOptions | undefined) {
  return [...(options?.grades ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);
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
      gradeId: classroomGradeId(options, row.classroomId) ?? "",
      classroomId: row.classroomId,
      homeroom: homeroomIds.has(row.classroomId),
      subjectId: row.subjectId
    });
    homeroomIds.delete(row.classroomId);
  }

  for (const classroomId of homeroomIds) {
    rows.push({
      key: classroomId,
      gradeId: classroomGradeId(options, classroomId) ?? "",
      classroomId,
      homeroom: true,
      subjectId: ""
    });
  }

  const inferredGrades = unique(
    [
      ...existing.capability.eligibleGradeIds,
      ...existing.assignments.gradeChief.map((row) => row.gradeId),
      ...rows.map((row) => row.gradeId).filter(Boolean)
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
    classroomRows: rows.filter((row) => row.gradeId)
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
    draft.classroomRows
      .filter((row) => row.homeroom && row.classroomId && eligible.has(row.gradeId))
      .map((row) => row.classroomId)
  );
  const homeroom = homeroomIds.map((classroomId) => ({ classroomId }));

  const subjectTeaching = draft.classroomRows
    .filter((row) => row.classroomId && row.subjectId && eligible.has(row.gradeId))
    .filter((row) => {
      const classroomGrade = classroomGradeId(options, row.classroomId);
      return classroomGrade ? row.gradeId === classroomGrade : false;
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
  if (!options) {
    return [];
  }

  const conflicts: { classroomId: string; classroomName: string }[] = [];
  for (const row of draft.classroomRows.filter((item) => item.homeroom && item.classroomId)) {
    const classroom = options.classrooms.find((item) => item.id === row.classroomId);
    if (
      classroom?.classTeacherStaffId &&
      classroom.classTeacherStaffId !== currentStaffId
    ) {
      conflicts.push({
        classroomId: classroom.id,
        classroomName: classroom.name
      });
    }
  }
  return conflicts;
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

type TeachingSetupFieldsProps = {
  draft: TeachingSetupDraft;
  onChange: (next: TeachingSetupDraft) => void;
  options: TeachingSetupOptions | undefined;
  currentStaffId?: string;
  loading?: boolean;
};

function TeachingSetupLoading({ loading }: { loading?: boolean }) {
  const t = useTranslations("teachers");
  if (!loading) {
    return null;
  }
  return <p className="pds-type-body-s-regular muted">{t("loadingTeachingSetup")}</p>;
}

export function TeacherSubjectsSetupFields({
  draft,
  onChange,
  options,
  loading
}: TeachingSetupFieldsProps) {
  const t = useTranslations("teachers");

  if (loading) {
    return <TeachingSetupLoading loading />;
  }

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

  return (
    <div className="assign-step teaching-setup teaching-setup--subjects">
      <CheckboxList
        options={(options?.subjects ?? []).map((subject) => ({
          id: subject.id,
          label: `${subject.name}${subject.code ? ` (${subject.code})` : ""}`
        }))}
        selectedIds={draft.competentSubjectIds}
        onChange={setCompetentSubjectIds}
        emptyTitle={t("noSubjectsCatalog")}
      />
    </div>
  );
}

export function TeacherGradesSetupFields({
  draft,
  onChange,
  options,
  currentStaffId,
  loading
}: TeachingSetupFieldsProps) {
  const t = useTranslations("teachers");

  if (loading) {
    return <TeachingSetupLoading loading />;
  }

  const grades = sortedGrades(options);
  const selectedGrades = grades.filter((grade) => draft.eligibleGradeIds.includes(grade.id));
  const conflicts = chiefConflicts(draft, options, currentStaffId);
  const selectSingleId = (ids: string[]) => (ids.length <= 1 ? ids : [ids[ids.length - 1]!]);

  const setEligibleGradeIds = (gradeIds: string[]) => {
    const allowedGrades = new Set(gradeIds);
    onChange({
      ...draft,
      eligibleGradeIds: gradeIds,
      chiefGradeIds: draft.chiefGradeIds.filter((id) => allowedGrades.has(id)),
      classroomRows: draft.classroomRows.filter((row) => allowedGrades.has(row.gradeId))
    });
  };

  return (
    <div className="assign-step teaching-setup teaching-setup--grades">
      <CheckboxList
        options={grades.map((grade) => ({ id: grade.id, label: grade.name }))}
        selectedIds={draft.eligibleGradeIds}
        onChange={setEligibleGradeIds}
        emptyTitle={t("noGradesAvailable")}
      />

      {draft.eligibleGradeIds.length > 0 ? (
        <>
          <div className="assign-toggle teaching-setup__grade-chief">
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
              <strong className="pds-type-body-m-medium">{t("gradeChiefToggle")}</strong>
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
        </>
      ) : null}
    </div>
  );
}

export function TeacherClassroomsSetupFields({
  draft,
  onChange,
  options,
  currentStaffId,
  loading
}: TeachingSetupFieldsProps) {
  const t = useTranslations("teachers");

  if (loading) {
    return <TeachingSetupLoading loading />;
  }

  const grades = sortedGrades(options);
  const selectedGrades = grades.filter((grade) => draft.eligibleGradeIds.includes(grade.id));
  const homeroomConflictRows = homeroomConflicts(draft, options, currentStaffId);

  const subjectOptionsForGrade = (gradeId: string) => {
    const competent = new Set(draft.competentSubjectIds);
    const gradeSubjectRows = (options?.gradeSubjects ?? []).filter((row) => row.gradeId === gradeId);
    const competentRows = gradeSubjectRows.filter((row) => competent.has(row.subjectId));
    const source = competentRows.length > 0 ? competentRows : gradeSubjectRows;
    return source.map((row) => ({
      id: row.subjectId,
      label: `${row.subjectName}${row.subjectCode ? ` (${row.subjectCode})` : ""}`
    }));
  };

  const classroomOptionsForGrade = (gradeId: string) =>
    (options?.classrooms ?? [])
      .filter((room) => room.gradeId === gradeId)
      .map((room) => ({
        id: room.id,
        label: `${room.name}${room.room ? ` (${room.room})` : ""}`
      }));

  const addClassroomRow = (gradeId: string) => {
    onChange({
      ...draft,
      classroomRows: [
        ...draft.classroomRows,
        { key: newRowKey(), gradeId, classroomId: "", homeroom: false, subjectId: "" }
      ]
    });
  };

  if (draft.eligibleGradeIds.length === 0) {
    return (
      <EmptyState compact embedded icon="school" title={t("selectGradesBeforeClassrooms")} />
    );
  }

  return (
    <div className="assign-step teaching-setup teaching-setup--classrooms">
      <div className="teaching-setup__grade-groups">
        {selectedGrades.map((grade) => {
          const gradeRows = draft.classroomRows.filter((row) => row.gradeId === grade.id);
          const isChief = draft.isGradeChief && draft.chiefGradeIds.includes(grade.id);
          const classroomCatalog = classroomOptionsForGrade(grade.id);
          const assignedClassroomIds = new Set(
            gradeRows.map((row) => row.classroomId).filter(Boolean)
          );
          const canAddClassroomRow = classroomCatalog.some(
            (option) => !assignedClassroomIds.has(option.id)
          );

          return (
            <div key={grade.id} className="teaching-setup__grade-group">
              <div className="teaching-setup__grade-group-head">
                <div className="teaching-setup__grade-group-title">
                  <span className="pds-type-body-m-bold">{grade.name}</span>
                  {isChief ? <Badge tone="brand">{t("gradeChiefBadge")}</Badge> : null}
                </div>
                <button
                  type="button"
                  className="pds-type-body-m-bold btn-ghost btn-ghost--compact"
                  disabled={!canAddClassroomRow}
                  onClick={() => addClassroomRow(grade.id)}
                >
                  <Icon name="add" />
                  {t("addClassroomRow")}
                </button>
              </div>

              {classroomCatalog.length === 0 ? (
                <p className="pds-type-body-s-regular muted teaching-setup__grade-empty" role="status">
                  {t("noClassroomsForGradeInYear", { grade: grade.name })}
                </p>
              ) : gradeRows.length === 0 ? (
                <p className="pds-type-body-s-regular muted teaching-setup__grade-empty">
                  {t("noClassroomRowsForGrade")}
                </p>
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
                  {gradeRows.map((row, index) => {
                    const rowIndex = draft.classroomRows.findIndex((item) => item.key === row.key);
                    const classroomOptions = classroomCatalog.filter(
                      (option) =>
                        option.id === row.classroomId ||
                        !gradeRows.some(
                          (other) => other.key !== row.key && other.classroomId === option.id
                        )
                    );
                    return (
                      <div key={row.key} className="teaching-setup__row">
                        <PdsSelectField
                          variant="form"
                          value={row.classroomId}
                          disabled={classroomCatalog.length === 0}
                          emptyLabel={t("noClassroomsAvailable")}
                          onValueChange={(next) => {
                            const classroomId = typeof next === "string" ? next : "";
                            const nextRows = [...draft.classroomRows];
                            nextRows[rowIndex] = { ...row, classroomId, subjectId: "" };
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
                            const nextRows = draft.classroomRows.map((item) => ({
                              ...item,
                              homeroom: checked && item.key === row.key
                            }));
                            onChange({ ...draft, classroomRows: nextRows });
                          }}
                          className="pds-type-body-s-regular teaching-setup__homeroom"
                        />
                        <PdsSelectField
                          variant="form"
                          value={row.subjectId}
                          disabled={!row.classroomId}
                          panelPosition={index === gradeRows.length - 1 ? "top" : "bottom"}
                          onValueChange={(next) => {
                            const subjectId = typeof next === "string" ? next : "";
                            const nextRows = [...draft.classroomRows];
                            nextRows[rowIndex] = { ...row, subjectId };
                            onChange({ ...draft, classroomRows: nextRows });
                          }}
                          placeholder="—"
                          options={subjectOptionsForGrade(grade.id).map((option) => ({
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
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {homeroomConflictRows.map((conflict) => (
        <p key={conflict.classroomId} className="pds-type-body-s-regular assign-warning" role="alert">
          <Icon name="warning" size={16} />
          {t("homeroomConflictWarning", { classroom: conflict.classroomName })}
        </p>
      ))}
    </div>
  );
}
