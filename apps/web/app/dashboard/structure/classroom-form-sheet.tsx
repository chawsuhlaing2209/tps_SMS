"use client";
import { FormInput } from "../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { PdsSelectField } from "../../../components/pds";
import { zodResolver } from "../../lib/zod-resolver";

type StaffMember = { id: string; fullName: string };

export type FacilityRoomOption = {
  id: string;
  name: string;
  capacity: number | null;
  note: string | null;
};

export type ClassroomFormValues = {
  name: string;
  facilityRoomId: string;
  classTeacherStaffId: string;
};

type ClassroomFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  teachers: StaffMember[];
  facilityRooms: FacilityRoomOption[];
  initialValues?: Partial<ClassroomFormValues>;
  submitting?: boolean;
  onSubmit: (values: ClassroomFormValues) => Promise<void>;
};

export function ClassroomFormSheet({
  open,
  onOpenChange,
  mode,
  teachers,
  facilityRooms,
  initialValues,
  submitting,
  onSubmit
}: ClassroomFormSheetProps) {
  const t = useTranslations("academics");
  const c = useTranslations("common");

  const schema = z.object({
    name: z.string().trim().min(1, c("required")),
    facilityRoomId: z.string(),
    classTeacherStaffId: z.string()
  });

  const form = useForm<ClassroomFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      facilityRoomId: "",
      classTeacherStaffId: ""
    }
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: initialValues?.name ?? "",
      facilityRoomId: initialValues?.facilityRoomId ?? "",
      classTeacherStaffId: initialValues?.classTeacherStaffId ?? ""
    });
  }, [form, initialValues, open]);

  const selectedFacilityRoomId = form.watch("facilityRoomId");
  const selectedFacilityRoom = useMemo(
    () => facilityRooms.find((room) => room.id === selectedFacilityRoomId) ?? null,
    [facilityRooms, selectedFacilityRoomId]
  );

  const facilityOptions = facilityRooms.map((room) => ({
    value: room.id,
    label:
      room.capacity != null
        ? t("facilityRoomOption", { name: room.name, capacity: room.capacity })
        : room.name
  }));

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
      <Field label={t("facilityRoom")}>
        <p className="pds-type-body-s-regular form-field-block__hint muted">{t("facilityRoomHint")}</p>
        {facilityRooms.length ? (
          <PdsSelectField
            variant="form"
            value={form.watch("facilityRoomId")}
            onValueChange={(value) =>
              form.setValue("facilityRoomId", typeof value === "string" ? value : "", {
                shouldValidate: true
              })
            }
            placeholder={t("selectFacilityRoom")}
            options={facilityOptions}
          />
        ) : (
          <p className="pds-type-body-s-regular muted">
            {t("noFacilityRooms")}{" "}
            <Link href="/dashboard/facilities" className="pds-type-body-s-semibold">
              {t("manageFacilities")}
            </Link>
          </p>
        )}
      </Field>
      {selectedFacilityRoom ? (
        <div className="classroom-facility-summary">
          <p className="pds-type-body-s-regular classroom-facility-summary__row">
            <span className="pds-type-label-s-medium muted">{t("capacity")}</span>
            <span className="pds-type-body-m-medium">
              {selectedFacilityRoom.capacity != null
                ? t("facilityRoomCapacityValue", { capacity: selectedFacilityRoom.capacity })
                : c("empty")}
            </span>
          </p>
          {selectedFacilityRoom.note ? (
            <p className="pds-type-body-s-regular classroom-facility-summary__note muted">
              {selectedFacilityRoom.note}
            </p>
          ) : null}
        </div>
      ) : null}
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
