"use client";

import { myanmarPhoneSchema, type StaffQualification } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation, useApiQuery } from "../../lib/api";
import { Field } from "../../lib/form";
import { Icon } from "../../lib/icon";
import { RecordFormSheet } from "../../lib/record-sheet";
import { zodResolver } from "../../lib/zod-resolver";

type Department = { id: string; name: string };

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  joinDate: string;
  promotionTitle: string;
  qualifications: Array<{ title?: string; institution?: string; year?: string }>;
};

const DEPARTMENTS_PATH = (tenant: string) => `/tenants/${tenant}/departments/active`;

export function TeacherCreateSheet({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("teachers");
  const c = useTranslations("common");
  const router = useRouter();

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
        title: z.string().optional(),
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

  const provision = useApiMutation<
    {
      fullName: string;
      email: string;
      phone: string;
      roleKey: string;
      createLogin: boolean;
      departmentId?: string;
      joinDate?: string;
      promotionTitle?: string;
      qualifications: StaffQualification[];
    },
    { staff?: { id: string } }
  >(
    (body, tenant) => ({
      path: `/tenants/${tenant}/hr/staff/provision`,
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_b, tenant) => [
        `/tenants/${tenant}/hr/staff/overview?employmentRole=teacher`
      ]
    }
  );

  async function onSubmit(values: FormValues) {
    const result = await provision.mutateAsync({
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      roleKey: "teacher",
      createLogin: true,
      departmentId: values.departmentId || undefined,
      joinDate: values.joinDate || undefined,
      promotionTitle: values.promotionTitle.trim() || undefined,
      qualifications: values.qualifications.filter(
        (item): item is StaffQualification => Boolean(item.title?.trim())
      ) as StaffQualification[]
    });

    form.reset();
    onOpenChange(false);
    onCreated();

    const staffId = result.staff?.id;
    if (staffId) {
      router.push(`/dashboard/teachers/${staffId}`);
    }
  }

  return (
    <RecordFormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset();
        }
        onOpenChange(next);
      }}
      title={t("addTeacher")}
      help={t("createHelp")}
      onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={() => onOpenChange(false)}>
            {c("cancel")}
          </button>
          <button type="submit" className="btn-primary" disabled={provision.isPending}>
            <Icon name="add" />
            {provision.isPending ? c("loading") : t("createTeacher")}
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
