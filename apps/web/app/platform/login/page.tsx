"use client";
import { FormInput } from "../../../components/shared/form-input";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { setSession } from "../../lib/session";
import { loginHttpError, resolveLoginError } from "../../lib/login-error";
import { zodResolver } from "../../lib/zod-resolver";

const API_BASE_URL = "/api";

type PlatformLoginResponse = {
  sessionId?: string;
  userId: string;
  tenantId: null;
  displayName?: string;
  expiresAt?: string;
};

type LoginValues = { identifier: string; password: string };

export default function PlatformLoginPage() {
  const router = useRouter();
  const t = useTranslations("platformAuth");
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    identifier: z.string().trim().min(1, t("identifierRequired")),
    password: z.string().min(1, t("passwordRequired"))
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/platform/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(
          loginHttpError(response.status, body, {
            invalid: t("invalid"),
            apiUnavailable: t("apiUnavailable")
          })
        );
      }

      const data = (await response.json()) as PlatformLoginResponse;
      setSession({
        tenantId: null,
        tenantSlug: "platform",
        userId: data.userId,
        displayName: data.displayName,
        expiresAt: data.expiresAt,
        isPlatform: true
      });
      router.push("/platform/tenants");
    } catch (error) {
      setServerError(
        resolveLoginError(error, { invalid: t("invalid"), apiUnavailable: t("apiUnavailable") })
      );
    }
  });

  return (
    <main className="auth">
      <div className="auth-card">
        <span className="pds-type-caption-m eyebrow">{t("eyebrow")}</span>
        <h1 className="pds-type-display-m auth-title">{t("signIn")}</h1>
        <p className="auth-subtitle">{t("subtitle")}</p>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
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
              type="password"
              placeholder={t("passwordPlaceholder")}
              autoComplete="current-password"
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

          <button type="submit" className="pds-type-body-m-bold auth-button" disabled={isSubmitting}>
            {isSubmitting ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <p className="pds-type-body-m-medium auth-footer">
          <Link href="/">{t("schoolSignIn")}</Link>
        </p>
      </div>
    </main>
  );
}
