"use client";

import { useTranslations } from "next-intl";
import type { PdsSubjectColorKey } from "../../../../components/pds/palettes";
import { Button } from "../../../../components/ui/button";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalFooterActions,
  ModalFooterStart,
  ModalHeader,
  ModalTitle
} from "../../../../components/pds/composites/modal";
import { Icon } from "../../../lib/material-icon";
import { subjectIcon } from "../../structure/subject-colors";

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
  const dayTimeLabel =
    slot.periodStartsAt && slot.periodEndsAt
      ? `${dayLabel} · ${slot.periodStartsAt}–${slot.periodEndsAt}`
      : dayLabel;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ModalContent className="timetable-slot-modal">
        <ModalHeader>
          <div className="timetable-slot-modal__head">
            <span className={`timetable-slot-modal__icon timetable-slot-modal__icon--${colorKey}`}>
              <Icon name={iconName} size={22} />
            </span>
            <div className="timetable-slot-modal__titles">
              <ModalTitle>{slot.subjectName ?? t("subject")}</ModalTitle>
              <ModalDescription>{timeLabel}</ModalDescription>
            </div>
          </div>
          <ModalCloseButton />
        </ModalHeader>

        <ModalBody>
          <dl className="timetable-slot-modal__meta">
            <div className="timetable-slot-modal__meta-row">
              <dt className="pds-type-label-s-medium">{t("teacher")}</dt>
              <dd className="pds-type-body-m-medium timetable-slot-modal__meta-value">
                <Icon name="person" size={18} />
                <span>{slot.teacherFullName ?? "—"}</span>
              </dd>
            </div>
            <div className="timetable-slot-modal__meta-row">
              <dt className="pds-type-label-s-medium">{t("dayAndTime")}</dt>
              <dd className="pds-type-body-m-medium timetable-slot-modal__meta-value">
                <Icon name="calendar_month" size={18} />
                <span>{dayTimeLabel}</span>
              </dd>
            </div>
          </dl>
        </ModalBody>

        <ModalFooter>
          <ModalFooterStart>
            {canManage && onDelete ? (
              <Button
                type="button"
                buttonType="ghost"
                buttonColor="secondary"
                prefixIcon="delete"
                onClick={onDelete}
              >
                {t("delete")}
              </Button>
            ) : null}
          </ModalFooterStart>
          <ModalFooterActions>
            <Button type="button" buttonType="outlined" buttonColor="secondary" onClick={onClose}>
              {c("close")}
            </Button>
            {canManage && onEdit ? (
              <Button type="button" buttonType="filled" buttonColor="primary" prefixIcon="edit" onClick={onEdit}>
                {t("editSlot")}
              </Button>
            ) : null}
          </ModalFooterActions>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
