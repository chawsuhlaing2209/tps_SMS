"use client";

import { useTranslations } from "next-intl";
import type { PdsSubjectColorKey } from "../../../../components/pds/palettes";
import { Icon } from "../../../lib/material-icon";
import { subjectIcon } from "../../structure/subject-colors";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../../../../components/ui/dialog";

type SlotPreview = {
  subjectName: string | null;
  subjectColorKey: string | null;
  subjectIconKey?: string | null;
  teacherFullName: string | null;
  periodName: string | null;
  periodStartsAt: string | null;
  periodEndsAt: string | null;
  dayOfWeek: number;
};

const DEFAULT_COLOR: PdsSubjectColorKey = "blue";

function normalizeColorKey(value: string | null | undefined): PdsSubjectColorKey {
  const allowed: PdsSubjectColorKey[] = [
    "azure",
    "pomegranate",
    "purple",
    "yellow",
    "green",
    "pink",
    "cyan",
    "blue"
  ];
  if (value && allowed.includes(value as PdsSubjectColorKey)) {
    return value as PdsSubjectColorKey;
  }
  return DEFAULT_COLOR;
}

export function TimetablePeriodModal({
  open,
  slot,
  onClose,
  canManage,
  onDelete,
  onEdit
}: {
  open: boolean;
  slot: SlotPreview | null;
  onClose: () => void;
  canManage: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const t = useTranslations("timetable");
  const c = useTranslations("common");

  if (!slot) return null;

  const colorKey = normalizeColorKey(slot.subjectColorKey);
  const dayLabel = t(`day${slot.dayOfWeek}` as "day1");
  const iconName = subjectIcon(slot.subjectName ?? "", slot.subjectIconKey);
  const timeLabel =
    slot.periodStartsAt && slot.periodEndsAt
      ? `${slot.periodName} · ${slot.periodStartsAt}–${slot.periodEndsAt}`
      : slot.periodName ?? "";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="timetable-period-modal">
        <DialogHeader>
          <div className="timetable-period-modal__hero">
            <span className={`timetable-period-modal__icon timetable-period-modal__icon--${colorKey}`}>
              <Icon name={iconName} size={22} />
            </span>
            <div>
              <DialogTitle className="pds-type-title-xs-bold">{slot.subjectName}</DialogTitle>
              <p className="pds-type-body-s-regular muted">{timeLabel}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="timetable-period-modal__cards">
          <article className="timetable-period-modal__card">
            <span className="timetable-period-modal__card-label">{t("teacher")}</span>
            <div className="timetable-period-modal__card-row">
              <Icon name="person" size={18} />
              <span className="pds-type-body-m-bold">{slot.teacherFullName}</span>
            </div>
          </article>
          <article className="timetable-period-modal__card">
            <span className="timetable-period-modal__card-label">{t("dayAndTime")}</span>
            <div className="timetable-period-modal__card-row">
              <Icon name="calendar_month" size={18} />
              <span className="pds-type-body-m-bold">
                {dayLabel} · {slot.periodStartsAt}–{slot.periodEndsAt}
              </span>
            </div>
          </article>
        </div>

        <DialogFooter className="timetable-period-modal__footer">
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={onClose}>
            {c("close")}
          </button>
          {canManage && onDelete ? (
            <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={onDelete}>
              <Icon name="delete" />
              {t("delete")}
            </button>
          ) : null}
          {canManage && onEdit ? (
            <button type="button" className="pds-type-body-m-bold btn-primary" onClick={onEdit}>
              <Icon name="edit" />
              {t("editPeriod")}
            </button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
