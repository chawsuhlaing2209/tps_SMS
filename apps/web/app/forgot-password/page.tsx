"use client";
import { FormInput } from "../../components/shared/form-input";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "../lib/zod-resolver";

const API_BASE_URL = "/api";

type ForgotValues = { tenant: string; identifier: string };

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const schema = z.object({
    tenant: z.string().trim().min(1, t("tenantRequired")),
    identifier: z.string().trim().min(1, t("identifierRequired"))
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotValues>({
    resolver: zodResolver(schema),
    defaultValues: { tenant: "", identifier: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/tenants/${encodeURIComponent(values.tenant)}/auth/password-reset/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: values.identifier })
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? t("apiUnavailable"));
      }

      setSubmitted(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t("apiUnavailable"));
    }
  });

  return (
    <main className="auth">
      <div className="auth-card">
        <span className="pds-type-caption-m eyebrow">{t("platform")}</span>
        <h1 className="pds-type-display-m auth-title">{t("forgotPasswordTitle")}</h1>
        <p className="auth-subtitle">{t("forgotPasswordSubtitle")}</p>

        {submitted ? (
          <p className="auth-success" role="status">
            {t("resetEmailSent")}
          </p>
        ) : (
          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <label className="pds-type-body-m-medium auth-field">
              <span>{t("tenant")}</span>
              <FormInput
                placeholder={t("tenantPlaceholder")}
                autoComplete="organization"
                {...register("tenant")}
              />
              {errors.tenant ? <span className="pds-type-body-s-regular field-error">{errors.tenant.message}</span> : null}
            </label>

            <label className="pds-type-body-m-medium auth-field">
              <span>{t("identifier")}</span>
              <FormInput
                placeholder={t("identifierPlaceholder")}
                autoComplete="username"
                {...register("identifier")}
              />
              {errors.identifier ? (
                <span className="pds-type-body-s-regular field-error">{errors.identifier.message}</span>
              ) : null}
            </label>

            {serverError ? (
              <p className="pds-type-body-m-medium auth-error" role="alert">
                {serverError}
              </p>
            ) : null}

            <button type="submit" className="pds-type-body-m-bold auth-button" disabled={isSubmitting}>
              {isSubmitting ? t("sendingReset") : t("sendResetLink")}
            </button>
          </form>
        )}

        <p className="pds-type-body-m-medium auth-footer">
          <Link href="/">{t("backToSignIn")}</Link>
        </p>
      </div>
    </main>
  );
}
