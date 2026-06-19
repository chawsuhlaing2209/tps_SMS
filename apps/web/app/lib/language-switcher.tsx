"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PdsSelectField } from "../../components/pds";

const LOCALES = ["en", "my"] as const;

export function LanguageSwitcher() {
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

  return (
    <label className="pds-type-body-m-medium lang-switch" aria-label={t("label")}>
      <PdsSelectField
        variant="filter"
        value={locale}
        disabled={pending}
        onValueChange={(value) => change(typeof value === "string" ? value : locale)}
        options={LOCALES.map((code) => ({
          value: code,
          label: t(code)
        }))}
      />
    </label>
  );
}
