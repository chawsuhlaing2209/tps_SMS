"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PdsSelectField } from "../../components/pds";
import { SegmentedControl } from "../../components/pds/composites/segmented-control";

const LOCALES = ["en", "my"] as const;

export type LanguageSwitcherProps = {
  /** `segmented` — EN / MY pill toggle for top nav (Figma 119:9730). */
  variant?: "select" | "segmented";
  className?: string;
};

export function LanguageSwitcher({ variant = "select", className }: LanguageSwitcherProps) {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    if (next === locale) {
      return;
    }
    // Persist for one year; the server request config reads this cookie.
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  if (variant === "segmented") {
    return (
      <SegmentedControl
        className={className ?? "pds-top-nav-bar__locale"}
        ariaLabel={t("label")}
        value={locale}
        preserveScroll={false}
        onChange={change}
        options={LOCALES.map((code) => ({
          id: code,
          label: code === "en" ? t("enShort") : t(code),
        }))}
      />
    );
  }

  return (
    <label className="pds-type-body-m-medium lang-switch" aria-label={t("label")}>
      <PdsSelectField
        variant="filter"
        value={locale}
        disabled={pending}
        onValueChange={(value) => change(typeof value === "string" ? value : locale)}
        options={LOCALES.map((code) => ({
          value: code,
          label: t(code),
        }))}
      />
    </label>
  );
}
