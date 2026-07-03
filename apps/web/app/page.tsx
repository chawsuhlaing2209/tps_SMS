"use client";
import { FormInput } from "../components/shared/form-input";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { setSession } from "./lib/session";
import { loginHttpFailure, resolveLoginError } from "./lib/login-error";
import { LanguageSwitcher } from "./lib/language-switcher";
import { zodResolver } from "./lib/zod-resolver";

const API_BASE_URL = "/api";

type LoginResponse = {
  sessionId?: string;
  userId: string;
  tenantId: string;
  displayName?: string;
  expiresAt?: string;
  roles?: string[];
  permissions?: string[];
};

type LoginValues = { tenant: string; identifier: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const schema = z.object({
    tenant: z.string().trim().min(1, t("tenantRequired")),
    identifier: z.string().trim().min(1, t("identifierRequired")),
    password: z.string().min(1, t("passwordRequired"))
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { tenant: "", identifier: "", password: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/tenants/${encodeURIComponent(values.tenant)}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ identifier: values.identifier, password: values.password })
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string; code?: string }
          | null;
        const failure = loginHttpFailure(response.status, body, {
          invalid: t("invalid"),
          apiUnavailable: t("apiUnavailable"),
          unknownTenant: t("unknownTenant"),
          unknownIdentifier: t("unknownIdentifier"),
          accountInactive: t("accountInactive"),
          wrongPassword: t("wrongPassword")
        });
        if (failure.field) {
          setError(failure.field, { type: "server", message: failure.message });
        } else {
          setServerError(failure.message);
        }
        return;
      }

      const data = (await response.json()) as LoginResponse;
      setSession({
        tenantId: data.tenantId,
        tenantSlug: values.tenant,
        userId: data.userId,
        displayName: data.displayName,
        expiresAt: data.expiresAt,
        roles: data.roles,
        permissions: data.permissions
      });
      router.push("/dashboard");
    } catch (error) {
      setServerError(
        resolveLoginError(error, { invalid: t("invalid"), apiUnavailable: t("apiUnavailable") })
      );
    }
  });

  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-card__top">
          <span className="pds-type-caption-m eyebrow">{t("platform")}</span>
          <LanguageSwitcher variant="segmented" />
        </div>
        <h1 className="pds-type-display-m auth-title">{t("signIn")}</h1>
        <p className="auth-subtitle">{t("subtitle")}</p>

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

          <label className="pds-type-body-m-medium auth-field">
            <span>{t("password")}</span>
            <FormInput
              type={showPassword ? "text" : "password"}
              placeholder={t("passwordPlaceholder")}
              autoComplete="current-password"
              suffix={
                <button
                  type="button"
                  className="pds-type-body-s-semibold auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? t("hidePassword") : t("showPassword")}
                </button>
              }
              {...register("password")}
            />
            {errors.password ? (
              <span className="pds-type-body-s-regular field-error">{errors.password.message}</span>
            ) : null}
          </label>

          {serverError ? (
            <p className="pds-type-body-m-medium auth-error" role="alert">
              {serverError}
            </p>
          ) : null}

          <p className="pds-type-body-m-medium auth-footer">
            <Link href="/forgot-password">{t("forgotPassword")}</Link>
          </p>

          <button type="submit" className="pds-type-body-m-bold auth-button" disabled={isSubmitting}>
            {isSubmitting ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <p className="pds-type-body-m-medium auth-footer">
          <Link href="/platform/login">{t("platformSignIn")}</Link>
        </p>
      </div>
    </main>
  );
}
