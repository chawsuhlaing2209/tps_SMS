"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalFooterActions,
  ModalFooterStart,
  ModalHeader,
  ModalTitle,
} from "../../../../../components/pds/composites/modal";
import { PdsSelectField } from "../../../../../components/pds";
import { TextAreaInput } from "../../../../../components/shared/form-input";
import { InputWrapper } from "../../../../../components/shared/input-wrapper";

const ACTIVITY_TYPES = ["call", "visit", "email", "note"] as const;

type ActivityType = (typeof ACTIVITY_TYPES)[number];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: { activityType: ActivityType; notes: string }) => Promise<void>;
  isSaving?: boolean;
};

export function AddActivityModal({ open, onOpenChange, onSave, isSaving }: Props) {
  const t = useTranslations("admissions");
  const c = useTranslations("common");
  const [activityType, setActivityType] = useState<ActivityType>("call");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setActivityType("call");
      setNotes("");
    }
  }, [open]);

  const activityOptions = ACTIVITY_TYPES.map((value) => ({
    value,
    label: t(`activity_${value}` as "activity_call"),
  }));

  async function handleSave() {
    if (!notes.trim()) return;
    await onSave({ activityType, notes: notes.trim() });
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="admission-add-activity-modal" aria-describedby={undefined}>
        <ModalHeader>
          <ModalTitle>{t("addActivityModalTitle")}</ModalTitle>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody>
          <InputWrapper label={t("activityType")} labelStyle="caps">
            <PdsSelectField
              variant="form"
              value={activityType}
              onValueChange={(value) =>
                setActivityType(
                  typeof value === "string" && ACTIVITY_TYPES.includes(value as ActivityType)
                    ? (value as ActivityType)
                    : "call",
                )
              }
              options={activityOptions}
            />
          </InputWrapper>
          <InputWrapper label={t("noteLabel")} labelStyle="caps">
            <TextAreaInput
              maxLength={300}
              placeholder={t("notePlaceholder")}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </InputWrapper>
        </ModalBody>
        <ModalFooter>
          <ModalFooterStart />
          <ModalFooterActions>
            <button
              type="button"
              className="pds-type-body-m-bold pds-btn pds-btn--outlined pds-btn--secondary"
              onClick={() => onOpenChange(false)}
            >
              {c("cancel")}
            </button>
            <button
              type="button"
              className="pds-type-body-m-bold pds-btn pds-btn--filled pds-btn--secondary"
              disabled={!notes.trim() || isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? c("loading") : c("save")}
            </button>
          </ModalFooterActions>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
