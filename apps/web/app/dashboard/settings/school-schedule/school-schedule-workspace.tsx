"use client";

import { FormInput } from "../../../../components/shared/form-input";
import { Toggle } from "../../../../components/shared/toggle";
import { schoolScheduleSettingsSchema, type SchoolScheduleSettings } from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { toastSuccess } from "../../../lib/toast";
import { zodResolver } from "../../../lib/zod-resolver";
import { PageHeader } from "../../page-header-context";

const SETTINGS_PATH = (tenant: string) => `/tenants/${tenant}/settings/school-schedule`;
const GENERATE_PATH = (tenant: string) => `/tenants/${tenant}/timetable/periods/generate`;

const defaultValues: SchoolScheduleSettings = {
  shortBreakStartsAt: "10:15",
  shortBreakEndsAt: "10:30",
  lunchBreakStartsAt: "12:00",
  lunchBreakEndsAt: "13:00",
  periodDurationMinutes: 45,
  workingDays: [1, 2, 3, 4, 5],
  operatingHourBlocks: [
    {
      startsAt: "08:00",
      endsAt: "15:00",
      isPrimary: true,
      sortOrder: 0,
      label: "Regular school day"
    }
  ]
};

export function SchoolScheduleWorkspace() {
  const t = useTranslations("settings.schoolSchedule");
  const c = useTranslations("common");
  const nav = useTranslations("nav");

  const settings = useApiQuery<SchoolScheduleSettings>(SETTINGS_PATH);
  const save = useApiMutation<SchoolScheduleSettings, SchoolScheduleSettings>(
    (body, tenant) => ({
      path: SETTINGS_PATH(tenant),
      init: { method: "PUT", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_, tenant) => [SETTINGS_PATH(tenant)] }
  );

  const generate = useApiMutation<{ academicYearId: string; replaceExisting?: boolean }, unknown>(
    (body, tenant) => ({
      path: GENERATE_PATH(tenant),
      init: { method: "POST", body: JSON.stringify(body) }
    }),
    {
      invalidatePaths: (_, tenant) => [
        `/tenants/${tenant}/timetable/periods`,
        `/tenants/${tenant}/timetable/slots`
      ]
    }
  );

  const currentYear = useApiQuery<{ id: string; name: string } | null>(
    (tenant) => `/tenants/${tenant}/dashboard/academic-year`
  );

  const form = useForm<SchoolScheduleSettings>({
    resolver: zodResolver(schoolScheduleSettingsSchema),
    defaultValues
  });

  const blocks = useFieldArray({
    control: form.control,
    name: "operatingHourBlocks"
  });

  useEffect(() => {
    if (settings.data) {
      form.reset({
        ...defaultValues,
        ...settings.data,
        operatingHourBlocks: settings.data.operatingHourBlocks.length
          ? settings.data.operatingHourBlocks
          : defaultValues.operatingHourBlocks
      });
    }
  }, [settings.data, form]);

  const setPrimaryBlock = (index: number) => {
    const current = form.getValues("operatingHourBlocks");
    form.setValue(
      "operatingHourBlocks",
      current.map((block, blockIndex) => ({
        ...block,
        isPrimary: blockIndex === index
      })),
      { shouldDirty: true }
    );
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        breadcrumbs={[
          { label: nav("settings"), href: "/dashboard/settings/user-roles" },
          { label: t("title") }
        ]}
      />

      <form
        className="page-stack"
        onSubmit={form.handleSubmit(async (values) => {
          await save.mutateAsync(values);
          toastSuccess(t("saved"));
        })}
      >
        <section className="panel">
          <div className="panel-head">
            <h2 className="pds-type-title-xs-bold">{t("operatingHoursTitle")}</h2>
            <p className="pds-type-body-s-regular muted">{t("operatingHoursHelp")}</p>
          </div>

          <div className="school-schedule-blocks">
            {blocks.fields.map((field, index) => (
              <article key={field.id} className="school-schedule-block">
                <div className="school-schedule-block__head">
                  <Field label={t("blockLabel")}>
                    <FormInput
                      type="text"
                      placeholder={t("blockLabelPlaceholder")}
                      {...form.register(`operatingHourBlocks.${index}.label`)}
                    />
                  </Field>
                  <label className="school-schedule-primary-toggle">
                    <Toggle
                      checked={form.watch(`operatingHourBlocks.${index}.isPrimary`)}
                      onCheckedChange={() => setPrimaryBlock(index)}
                      aria-label={t("primaryHours")}
                    />
                    <span className="pds-type-body-s-semibold">{t("primaryHours")}</span>
                  </label>
                </div>
                <div className="school-schedule-block__times">
                  <Field label={t("startTime")}>
                    <FormInput type="time" {...form.register(`operatingHourBlocks.${index}.startsAt`)} />
                  </Field>
                  <Field label={t("endTime")}>
                    <FormInput type="time" {...form.register(`operatingHourBlocks.${index}.endsAt`)} />
                  </Field>
                </div>
                {blocks.fields.length > 1 ? (
                  <button
                    type="button"
                    className="pds-type-body-s-regular row-action"
                    onClick={() => blocks.remove(index)}
                  >
                    <Icon name="delete" size={16} />
                    {c("remove")}
                  </button>
                ) : null}
              </article>
            ))}
          </div>

          <button
            type="button"
            className="pds-type-body-m-bold btn-ghost"
            onClick={() =>
              blocks.append({
                startsAt: "16:00",
                endsAt: "18:00",
                isPrimary: false,
                sortOrder: blocks.fields.length,
                label: t("secondaryBlockLabel")
              })
            }
          >
            <Icon name="add" />
            {t("addOperatingBlock")}
          </button>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="pds-type-title-xs-bold">{t("breaksTitle")}</h2>
            <p className="pds-type-body-s-regular muted">{t("breaksHelp")}</p>
          </div>
          <div className="school-schedule-breaks">
            <div className="school-schedule-break-card">
              <h3 className="pds-type-title-xxs-extrabold">{t("shortBreak")}</h3>
              <div className="school-schedule-block__times">
                <Field label={t("startTime")}>
                  <FormInput type="time" {...form.register("shortBreakStartsAt")} />
                </Field>
                <Field label={t("endTime")}>
                  <FormInput type="time" {...form.register("shortBreakEndsAt")} />
                </Field>
              </div>
            </div>
            <div className="school-schedule-break-card">
              <h3 className="pds-type-title-xxs-extrabold">{t("lunchBreak")}</h3>
              <div className="school-schedule-block__times">
                <Field label={t("startTime")}>
                  <FormInput type="time" {...form.register("lunchBreakStartsAt")} />
                </Field>
                <Field label={t("endTime")}>
                  <FormInput type="time" {...form.register("lunchBreakEndsAt")} />
                </Field>
              </div>
            </div>
            <Field label={t("periodDuration")}>
              <FormInput
                type="number"
                min={15}
                max={120}
                step={5}
                {...form.register("periodDurationMinutes", { valueAsNumber: true })}
              />
            </Field>
          </div>
        </section>

        <div className="school-schedule-actions">
          <button
            type="submit"
            className="pds-type-body-m-bold btn-primary"
            disabled={save.isPending || !form.formState.isDirty}
          >
            <Icon name="check" />
            {save.isPending ? c("loading") : c("save")}
          </button>
          <button
            type="button"
            className="pds-type-body-m-bold btn-ghost"
            disabled={!currentYear.data?.id || generate.isPending}
            onClick={() => {
              if (!currentYear.data?.id) return;
              void generate
                .mutateAsync({ academicYearId: currentYear.data.id, replaceExisting: true })
                .then(() => toastSuccess(t("periodsGenerated")));
            }}
          >
            <Icon name="bolt" />
            {generate.isPending ? c("loading") : t("generatePeriods")}
          </button>
        </div>
      </form>
    </>
  );
}
