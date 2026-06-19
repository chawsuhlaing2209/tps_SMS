"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PdsSelectField } from "../../../../components/pds";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { RecordFormSheet } from "../../../lib/record-sheet";
import { zodResolver } from "../../../lib/zod-resolver";

type StaffMember = { id: string; fullName: string };

export type SubjectTeacherAssignmentValues = {
  teacherStaffId: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectName: string;
  teachers: StaffMember[];
  initialTeacherStaffId?: string | null;
  submitting?: boolean;
  onSubmit: (values: SubjectTeacherAssignmentValues) => Promise<void>;
};

export function SubjectTeacherAssignmentSheet({
  open,
  onOpenChange,
  subjectName,
  teachers,
  initialTeacherStaffId,
  submitting,
  onSubmit
}: Props) {
  const t = useTranslations("academics");
  const c = useTranslations("common");

  const schema = z.object({
    teacherStaffId: z.string()
  });

  const form = useForm<SubjectTeacherAssignmentValues>({
    resolver: zodResolver(schema),
    defaultValues: { teacherStaffId: "" }
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset({ teacherStaffId: initialTeacherStaffId ?? "" });
  }, [form, initialTeacherStaffId, open]);

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("assignSubjectTeacherTitle")}
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      footer={
        <>
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </button>
          <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={submitting}>
            <Icon name="check" />
            {submitting ? c("loading") : c("save")}
          </button>
        </>
      }
    >
      <p className="pds-type-body-s-regular muted">{t("assignSubjectTeacherHelp", { subject: subjectName })}</p>
      <Field label={t("subjectTeacherLabel")}>
        <PdsSelectField
          variant="form"
          value={form.watch("teacherStaffId")}
          onValueChange={(value) =>
            form.setValue("teacherStaffId", typeof value === "string" ? value : "", {
              shouldValidate: true
            })
          }
          placeholder={t("selectSubjectTeacher")}
          options={teachers.map((teacher) => ({
            value: teacher.id,
            label: teacher.fullName
          }))}
        />
      </Field>
    </RecordFormSheet>
  );
}
