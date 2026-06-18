"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "../lib/zod-resolver";

const API_BASE_URL = "/api";

type ResetValues = { tenant: string; token: string; password: string; confirmPassword: string };

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z
    .object({
      tenant: z.string().trim().min(1, t("tenantRequired")),
      token: z.string().trim().min(1, t("resetTokenRequired")),
      password: z.string().min(10, t("passwordMinLength")),
      confirmPassword: z.string().min(1, t("passwordRequired"))
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t("passwordMismatch"),
      path: ["confirmPassword"]
    });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenant: searchParams.get("tenant") ?? "",
      token: searchParams.get("token") ?? "",
      password: "",
      confirmPassword: ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/tenants/${encodeURIComponent(values.tenant)}/auth/password-reset/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: values.token, password: values.password })
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? t("resetFailed"));
      }

      router.push("/");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t("resetFailed"));
    }
  });

  return (
    <main className="auth">
      <div className="auth-card">
        <span className="eyebrow">{t("platform")}</span>
        <h1 className="auth-title">{t("resetPasswordTitle")}</h1>
        <p className="auth-subtitle">{t("resetPasswordSubtitle")}</p>

        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <label className="auth-field">
            <span>{t("tenant")}</span>
            <input
              placeholder={t("tenantPlaceholder")}
              autoComplete="organization"
              {...register("tenant")}
            />
            {errors.tenant ? <span className="field-error">{errors.tenant.message}</span> : null}
          </label>

          <label className="auth-field">
            <span>{t("resetToken")}</span>
            <input placeholder={t("resetTokenPlaceholder")} {...register("token")} />
            {errors.token ? <span className="field-error">{errors.token.message}</span> : null}
          </label>

          <label className="auth-field">
            <span>{t("newPassword")}</span>
            <input
              type="password"
              placeholder={t("newPasswordPlaceholder")}
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password ? <span className="field-error">{errors.password.message}</span> : null}
          </label>

          <label className="auth-field">
            <span>{t("confirmPassword")}</span>
            <input
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <span className="field-error">{errors.confirmPassword.message}</span>
            ) : null}
          </label>

          {serverError ? (
            <p className="auth-error" role="alert">
              {serverError}
            </p>
          ) : null}

          <button type="submit" className="auth-button" disabled={isSubmitting}>
            {isSubmitting ? t("resettingPassword") : t("resetPasswordButton")}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/">{t("backToSignIn")}</Link>
        </p>
      </div>
    </main>
  );
}
