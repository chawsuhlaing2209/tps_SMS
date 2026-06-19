"use client";

import { useTranslations } from "next-intl";
import { Icon } from "../../../lib/material-icon";
import { cn } from "../../../../lib/utils";
import {
  SUBJECT_COLOR_OPTIONS,
  SUBJECT_ICON_OPTIONS,
  type SubjectColorKey,
  type SubjectIconKey
} from "../../structure/subject-colors";
import { gradeBadgeLabel } from "../grade-label";

type GradeOption = { id: string; name: string };

export function SubjectAppearanceFields({
  colorKey,
  iconKey,
  gradeIds,
  grades,
  onColorKeyChange,
  onIconKeyChange,
  onGradeIdsChange,
}: {
  colorKey: SubjectColorKey;
  iconKey: SubjectIconKey;
  gradeIds: string[];
  grades: GradeOption[];
  onColorKeyChange: (key: SubjectColorKey) => void;
  onIconKeyChange: (key: SubjectIconKey) => void;
  onGradeIdsChange: (ids: string[]) => void;
}) {
  const t = useTranslations("academics");

  const toggleGrade = (gradeId: string) => {
    const next = gradeIds.includes(gradeId)
      ? gradeIds.filter((id) => id !== gradeId)
      : [...gradeIds, gradeId];
    onGradeIdsChange(next);
  };

  return (
    <>
      <div className="subject-form-field">
        <span className="pds-type-caption-s subject-form-field__label">{t("subjectColour")}</span>
        <div className="subject-color-picker" role="radiogroup" aria-label={t("subjectColour")}>
          {SUBJECT_COLOR_OPTIONS.map((option) => {
            const selected = colorKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cn("subject-color-picker__swatch", selected && "subject-color-picker__swatch--selected")}
                style={{ background: option.bg }}
                onClick={() => onColorKeyChange(option.key)}
              >
                {selected ? <Icon name="check" size={16} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="subject-form-field">
        <span className="pds-type-caption-s subject-form-field__label">{t("subjectIcon")}</span>
        <div className="subject-icon-picker" role="radiogroup" aria-label={t("subjectIcon")}>
          {SUBJECT_ICON_OPTIONS.map((option) => {
            const selected = iconKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cn("subject-icon-picker__item", selected && "subject-icon-picker__item--selected")}
                onClick={() => onIconKeyChange(option.key)}
              >
                <Icon name={option.icon} size={20} />
                <span className="pds-type-body-s-regular subject-icon-picker__label">{t(option.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="subject-form-field">
        <span className="pds-type-caption-s subject-form-field__label">{t("applicableGrades")}</span>
        <div className="subject-grade-picker">
          {grades.map((grade) => {
            const selected = gradeIds.includes(grade.id);
            return (
              <button
                key={grade.id}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "pds-type-body-s-semibold subject-grade-picker__pill",
                  selected && "subject-grade-picker__pill--selected"
                )}
                onClick={() => toggleGrade(grade.id)}
              >
                {gradeBadgeLabel(grade.name)}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
