"use client";

import { myanmarPhoneSchema, type StaffQualification } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/material-icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { zodResolver } from "../../lib/zod-resolver";

type Department = { id: string; name: string };

type TeacherInfo = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  joinDate: string | null;
  promotionTitle: string | null;
  qualifications: Array<{ title?: string; institution?: string; year?: string }>;
};

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  joinDate: string;
  promotionTitle: string;
  qualifications: StaffQualification[];
};

const DEPARTMENTS_PATH = (tenant: string) => `/tenants/${tenant}/departments/active`;

export function TeacherEditSheet({
  open,
  onOpenChange,
  teacher,
  onSaved
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: TeacherInfo | null;
  onSaved: () => void;
}) {
  const t = useTranslations("teachers");
  const c = useTranslations("common");

  const departments = useApiQuery<Department[]>((tenant) =>
    open ? DEPARTMENTS_PATH(tenant) : null
  );

  const schema = z.object({
    fullName: z.string().trim().min(1, c("required")),
    email: z.string().email(t("invalidEmail")),
    phone: myanmarPhoneSchema,
    departmentId: z.string(),
    joinDate: z.string(),
    promotionTitle: z.string().default(""),
    qualifications: z.array(
      z.object({
        title: z.string().trim().min(1, c("required")),
        institution: z.string().optional(),
        year: z.string().optional()
      })
    )
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      departmentId: "",
      joinDate: "",
      promotionTitle: "",
      qualifications: [{ title: "", institution: "", year: "" }]
    }
  });

  const qualifications = useFieldArray({ control: form.control, name: "qualifications" });

  useEffect(() => {
    if (!open || !teacher) {
      return;
    }
    const rows = teacher.qualifications.length
      ? teacher.qualifications.map((item) => ({
          title: item.title ?? "",
          institution: item.institution ?? "",
          year: item.year ?? ""
        }))
      : [{ title: "", institution: "", year: "" }];
    form.reset({
      fullName: teacher.fullName,
      email: teacher.email ?? "",
      phone: teacher.phone ?? "",
      departmentId: teacher.departmentId ?? "",
      joinDate: teacher.joinDate ?? "",
      promotionTitle: teacher.promotionTitle ?? "",
      qualifications: rows
    });
  }, [open, teacher, form]);

  const provisionUpdate = useApiMutation(
    ({ body }: { body: Record<string, unknown> }, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/${teacher!.id}/provision`,
      init: { method: "PATCH", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/hr/staff/${teacher!.id}/teacher-profile`,
        `/tenants/${tenant}/hr/staff/overview?employmentRole=teacher`
      ]
    }
  );

  async function onSubmit(values: FormValues) {
    if (!teacher) {
      return;
    }
    await provisionUpdate.mutateAsync({
      body: {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        roleKey: "teacher",
        departmentId: values.departmentId || undefined,
        joinDate: values.joinDate || undefined,
        promotionTitle: values.promotionTitle.trim() || undefined,
        qualifications: values.qualifications.filter((item) => item.title.trim())
      }
    });
    onOpenChange(false);
    onSaved();
  }

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("editTeacher")}
      help={t("editHelp")}
      onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </button>
          <button type="submit" className="btn-primary" disabled={provisionUpdate.isPending}>
            <Icon name="check" />
            {provisionUpdate.isPending ? c("loading") : c("save")}
          </button>
        </>
      }
    >
      <Field label={c("name")} error={form.formState.errors.fullName?.message}>
        <input {...form.register("fullName")} />
      </Field>
      <Field label={t("email")} error={form.formState.errors.email?.message}>
        <input type="email" {...form.register("email")} />
      </Field>
      <Field label={t("phone")} error={form.formState.errors.phone?.message}>
        <input {...form.register("phone")} placeholder="09XXXXXXXXX" />
      </Field>
      <Field label={t("department")}>
        <select {...form.register("departmentId")}>
          <option value="">{t("departmentPlaceholder")}</option>
          {departments.data?.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("joinDate")}>
        <input type="date" {...form.register("joinDate")} />
      </Field>
      <Field label={t("promotionTitle")}>
        <input
          {...form.register("promotionTitle")}
          placeholder={t("promotionTitlePlaceholder")}
        />
        <p className="muted">{t("promotionTitleHelp")}</p>
      </Field>

      <div className="form-section-head">
        <h3>{t("qualificationsTitle")}</h3>
        <p className="muted">{t("qualificationsHelp")}</p>
      </div>

      {qualifications.fields.map((field, index) => (
        <div key={field.id} className="qualification-row">
          <Field
            label={t("qualificationTitle")}
            error={form.formState.errors.qualifications?.[index]?.title?.message}
          >
            <input
              {...form.register(`qualifications.${index}.title`)}
              placeholder={t("qualificationTitlePlaceholder")}
            />
          </Field>
          <Field label={t("qualificationInstitution")}>
            <input
              {...form.register(`qualifications.${index}.institution`)}
              placeholder={t("qualificationInstitutionPlaceholder")}
            />
          </Field>
          <Field label={t("qualificationYear")}>
            <input {...form.register(`qualifications.${index}.year`)} placeholder="2020" />
          </Field>
          {qualifications.fields.length > 1 ? (
            <button
              type="button"
              className="btn-ghost btn-ghost--compact"
              onClick={() => qualifications.remove(index)}
            >
              {t("removeQualification")}
            </button>
          ) : null}
        </div>
      ))}

      <button
        type="button"
        className="btn-ghost"
        onClick={() => qualifications.append({ title: "", institution: "", year: "" })}
      >
        <Icon name="add" />
        {t("addQualification")}
      </button>
    </RecordFormSheet>
  );
}
