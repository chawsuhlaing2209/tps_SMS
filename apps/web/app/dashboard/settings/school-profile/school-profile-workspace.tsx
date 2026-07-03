"use client";

import {
  SCHOOL_TYPES,
  normalizeSchoolProfileInput,
  schoolProfileSchema,
  type SchoolProfileInput
} from "@sms/shared";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormInput, FormSelect } from "../../../../components/shared/form-input";
import { apiUpload, useApiMutation, useApiQuery } from "../../../lib/api";
import { Field } from "../../../lib/form";
import { Icon } from "../../../lib/material-icon";
import { toastError, toastSuccess } from "../../../lib/toast";
import { zodResolver } from "../../../lib/zod-resolver";
import { PageHeader } from "../../page-header-context";

const PROFILE_PATH = (tenant: string) => `/tenants/${tenant}/settings/school-profile`;
const LOGO_PATH = (tenant: string) => `${PROFILE_PATH(tenant)}/logo`;

type SchoolProfile = SchoolProfileInput & { logoFileId: string | null };

const emptyValues: SchoolProfileInput = {
  schoolName: "",
  schoolType: null,
  motto: null,
  address: null,
  contactEmail: null,
  contactPhone: null,
  principalName: null,
  registrationNumber: null,
  establishedYear: null
};

export function SchoolProfileWorkspace() {
  const t = useTranslations("settings.schoolProfile");
  const c = useTranslations("common");
  const nav = useTranslations("nav");

  const profile = useApiQuery<SchoolProfile>(PROFILE_PATH);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const save = useApiMutation<SchoolProfileInput, SchoolProfile>(
    (body, tenant) => ({
      path: PROFILE_PATH(tenant),
      init: { method: "PUT", body: JSON.stringify(body) }
    }),
    { invalidatePaths: (_, tenant) => [PROFILE_PATH(tenant), `/tenants/${tenant}/dashboard`] }
  );

  const removeLogo = useApiMutation<Record<string, never>>(
    (_body, tenant) => ({
      path: LOGO_PATH(tenant),
      init: { method: "DELETE" }
    }),
    { invalidatePaths: (_, tenant) => [PROFILE_PATH(tenant)] }
  );

  const form = useForm<SchoolProfileInput>({
    resolver: zodResolver(schoolProfileSchema),
    defaultValues: emptyValues
  });

  useEffect(() => {
    if (profile.data) {
      const { logoFileId: _logoFileId, ...values } = profile.data;
      form.reset({ ...emptyValues, ...values });
    }
  }, [profile.data, form]);

  const schoolType = form.watch("schoolType");

  const handleLogoSelected = async (file: File | null) => {
    if (!file || !profile.tenantId) {
      return;
    }
    setUploading(true);
    try {
      await apiUpload(LOGO_PATH(profile.tenantId), file);
      await profile.refetch();
      toastSuccess(t("logoUploaded"));
    } catch (error) {
      toastError(error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const logoUrl =
    profile.tenantId && profile.data?.logoFileId
      ? `/api${LOGO_PATH(profile.tenantId)}?v=${profile.data.logoFileId}`
      : null;

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
          await save.mutateAsync(normalizeSchoolProfileInput(values));
          toastSuccess(t("saved"));
        })}
      >
        <section className="panel">
          <div className="panel-head">
            <h2 className="pds-type-title-xs-bold">{t("identityTitle")}</h2>
            <p className="pds-type-body-s-regular muted">{t("identityHelp")}</p>
          </div>

          <div className="school-profile-logo">
            <div className="school-profile-logo__preview" aria-hidden={!logoUrl}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={t("logoAlt")} />
              ) : (
                <Icon name="school" size={32} className="muted" />
              )}
            </div>
            <div className="school-profile-logo__actions">
              <span className="pds-type-body-s-semibold">{t("logoLabel")}</span>
              <p className="pds-type-body-s-regular muted">{t("logoHelp")}</p>
              <div className="school-profile-logo__buttons">
                <button
                  type="button"
                  className="pds-type-body-s-semibold btn-ghost"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon name="upload" size={16} />
                  {uploading ? c("loading") : t("uploadLogo")}
                </button>
                {logoUrl ? (
                  <button
                    type="button"
                    className="pds-type-body-s-semibold btn-ghost"
                    disabled={removeLogo.isPending}
                    onClick={() => void removeLogo.mutateAsync({})}
                  >
                    <Icon name="delete" size={16} />
                    {t("removeLogo")}
                  </button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => void handleLogoSelected(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <Field label={t("schoolName")} error={form.formState.errors.schoolName?.message}>
              <FormInput {...form.register("schoolName")} />
            </Field>
            <Field label={t("schoolType")}>
              <FormSelect
                value={schoolType ?? ""}
                onValueChange={(value) =>
                  form.setValue(
                    "schoolType",
                    (value || null) as SchoolProfileInput["schoolType"],
                    { shouldDirty: true }
                  )
                }
                placeholder={t("schoolTypePlaceholder")}
                options={SCHOOL_TYPES.map((type) => ({
                  value: type,
                  label: t(`schoolTypes.${type}`)
                }))}
              />
            </Field>
          </div>
          <Field label={t("motto")} error={form.formState.errors.motto?.message}>
            <FormInput placeholder={t("mottoPlaceholder")} {...form.register("motto")} />
          </Field>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="pds-type-title-xs-bold">{t("contactTitle")}</h2>
            <p className="pds-type-body-s-regular muted">{t("contactHelp")}</p>
          </div>
          <div className="form-grid-2">
            <Field label={t("contactEmail")} error={form.formState.errors.contactEmail?.message}>
              <FormInput type="email" {...form.register("contactEmail")} />
            </Field>
            <Field label={t("contactPhone")} error={form.formState.errors.contactPhone?.message}>
              <FormInput {...form.register("contactPhone")} />
            </Field>
          </div>
          <Field label={t("address")} error={form.formState.errors.address?.message}>
            <FormInput {...form.register("address")} />
          </Field>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="pds-type-title-xs-bold">{t("registrationTitle")}</h2>
            <p className="pds-type-body-s-regular muted">{t("registrationHelp")}</p>
          </div>
          <div className="form-grid-2">
            <Field label={t("principalName")} error={form.formState.errors.principalName?.message}>
              <FormInput {...form.register("principalName")} />
            </Field>
            <Field
              label={t("registrationNumber")}
              error={form.formState.errors.registrationNumber?.message}
            >
              <FormInput {...form.register("registrationNumber")} />
            </Field>
            <Field
              label={t("establishedYear")}
              error={form.formState.errors.establishedYear?.message}
            >
              <FormInput
                type="number"
                min={1800}
                max={2200}
                {...form.register("establishedYear", {
                  setValueAs: (value) =>
                    value === "" || value === null || value === undefined
                      ? null
                      : Number(value)
                })}
              />
            </Field>
          </div>
        </section>

        <div className="panel-actions">
          <button
            type="submit"
            className="pds-type-body-m-bold btn-primary"
            disabled={save.isPending || profile.isLoading || !form.formState.isDirty}
          >
            <Icon name="check" />
            {save.isPending ? c("loading") : c("save")}
          </button>
        </div>
      </form>
    </>
  );
}
