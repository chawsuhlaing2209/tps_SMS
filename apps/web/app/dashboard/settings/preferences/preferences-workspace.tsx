"use client";

import {
  COMMON_CURRENCIES,
  COMMON_TIMEZONES,
  DATE_FORMATS,
  SUPPORTED_LANGUAGES,
  TIME_FORMATS,
  tenantPreferencesSchema,
  type TenantPreferences
} from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormSelect } from "../../../../components/shared/form-input";
import { useApiMutation, useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { toastSuccess } from "../../../lib/toast";
import { zodResolver } from "../../../lib/zod-resolver";
import { PageHeader } from "../../page-header-context";

const PREFERENCES_PATH = (tenant: string) => `/tenants/${tenant}/settings/preferences`;

const defaultValues: TenantPreferences = {
  defaultLanguage: "en",
  currency: "MMK",
  timezone: "Asia/Yangon",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h"
};

export function PreferencesWorkspace() {
  const t = useTranslations("settings.preferences");
  const c = useTranslations("common");
  const nav = useTranslations("nav");

  const preferences = useApiQuery<TenantPreferences>(PREFERENCES_PATH);

  const save = useApiMutation<TenantPreferences, TenantPreferences>(
    (body, tenant) => ({
      path: PREFERENCES_PATH(tenant),
      init: { method: "PUT", body: JSON.stringify(body) }
    }),
    {
      // auth/me carries the same preferences to every signed-in user, so the
      // bound formatters (useTenantFormats) pick the change up immediately.
      invalidatePaths: (_, tenant) => [PREFERENCES_PATH(tenant), `/tenants/${tenant}/auth/me`]
    }
  );

  const form = useForm<TenantPreferences>({
    resolver: zodResolver(tenantPreferencesSchema),
    defaultValues
  });

  useEffect(() => {
    if (preferences.data) {
      form.reset({ ...defaultValues, ...preferences.data });
    }
  }, [preferences.data, form]);

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
            <h2 className="pds-type-title-xs-bold">{t("localizationTitle")}</h2>
            <p className="pds-type-body-s-regular muted">{t("localizationHelp")}</p>
          </div>
          <div className="form-grid-2">
            <Field label={t("defaultLanguage")} error={form.formState.errors.defaultLanguage?.message}>
              <Controller
                control={form.control}
                name="defaultLanguage"
                render={({ field }) => (
                  <FormSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={SUPPORTED_LANGUAGES.map((language) => ({
                      value: language,
                      label: t(`languages.${language}`)
                    }))}
                  />
                )}
              />
            </Field>
            <Field label={t("timezone")} error={form.formState.errors.timezone?.message}>
              <Controller
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={COMMON_TIMEZONES.map((zone) => ({ value: zone, label: zone }))}
                  />
                )}
              />
            </Field>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="pds-type-title-xs-bold">{t("formatsTitle")}</h2>
            <p className="pds-type-body-s-regular muted">{t("formatsHelp")}</p>
          </div>
          <div className="form-grid-2">
            <Field label={t("currency")} error={form.formState.errors.currency?.message}>
              <Controller
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={COMMON_CURRENCIES.map((currency) => ({
                      value: currency,
                      label: t(`currencies.${currency}`)
                    }))}
                  />
                )}
              />
            </Field>
            <Field label={t("dateFormat")} error={form.formState.errors.dateFormat?.message}>
              <Controller
                control={form.control}
                name="dateFormat"
                render={({ field }) => (
                  <FormSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={DATE_FORMATS.map((format) => ({ value: format, label: format }))}
                  />
                )}
              />
            </Field>
            <Field label={t("timeFormat")} error={form.formState.errors.timeFormat?.message}>
              <Controller
                control={form.control}
                name="timeFormat"
                render={({ field }) => (
                  <FormSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={TIME_FORMATS.map((format) => ({
                      value: format,
                      label: t(`timeFormats.${format}`)
                    }))}
                  />
                )}
              />
            </Field>
          </div>
        </section>

        <div className="panel-actions">
          <button
            type="submit"
            className="pds-type-body-m-bold btn-primary"
            disabled={save.isPending || preferences.isLoading || !form.formState.isDirty}
          >
            <Icon name="check" />
            {save.isPending ? c("loading") : c("save")}
          </button>
        </div>
      </form>
    </>
  );
}
