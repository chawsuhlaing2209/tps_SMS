"use client";
import { FormInput } from "../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { PdsSelectField } from "../../../components/pds";
import { zodResolver } from "../../lib/zod-resolver";

type StaffMember = { id: string; fullName: string };

export type ClassroomFormValues = {
  name: string;
  room: string;
  capacity: string;
  classTeacherStaffId: string;
};

type ClassroomFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  teachers: StaffMember[];
  initialValues?: Partial<ClassroomFormValues>;
  submitting?: boolean;
  onSubmit: (values: ClassroomFormValues) => Promise<void>;
};

export function ClassroomFormSheet({
  open,
  onOpenChange,
  mode,
  teachers,
  initialValues,
  submitting,
  onSubmit
}: ClassroomFormSheetProps) {
  const t = useTranslations("academics");
  const c = useTranslations("common");

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    room: z.string(),
    capacity: z.string(),
    classTeacherStaffId: z.string()
  });

  const form = useForm<ClassroomFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      room: "",
      capacity: "",
      classTeacherStaffId: ""
    }
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: initialValues?.name ?? "",
      room: initialValues?.room ?? "",
      capacity: initialValues?.capacity ?? "",
      classTeacherStaffId: initialValues?.classTeacherStaffId ?? ""
    });
  }, [form, initialValues, open]);

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? t("addClassroomTitle") : t("editClassroomTitle")}
      onSubmit={form.handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      footer={
        <>
          <button type="button" className="pds-type-body-m-bold btn-ghost" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </button>
          <button type="submit" className="pds-type-body-m-bold btn-primary" disabled={submitting || form.formState.isSubmitting}>
            <Icon name="check" />
            {form.formState.isSubmitting || submitting
              ? c("loading")
              : mode === "create"
                ? t("addClassroom")
                : c("save")}
          </button>
        </>
      }
    >
      <Field label={t("classroomName")} error={form.formState.errors.name?.message}>
        <FormInput placeholder={t("classroomNamePlaceholder")} {...form.register("name")} />
      </Field>
      <Field label={t("room")}>
        <FormInput placeholder={t("roomPlaceholder")} {...form.register("room")} />
      </Field>
      <Field label={t("capacity")}>
        <FormInput type="number" min={1} {...form.register("capacity")} />
      </Field>
      <Field label={t("homeroomTeacher")}>
        <PdsSelectField
          variant="form"
          value={form.watch("classTeacherStaffId")}
          onValueChange={(value) =>
            form.setValue("classTeacherStaffId", typeof value === "string" ? value : "", {
              shouldValidate: true
            })
          }
          placeholder={t("selectHomeroomTeacher")}
          options={teachers.map((member) => ({
            value: member.id,
            label: member.fullName
          }))}
        />
      </Field>
    </RecordFormSheet>
  );
}
