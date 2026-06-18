"use client";

import { useTranslations } from "next-intl";
import type { CurrentAcademicYear } from "../../lib/use-current-academic-year";

type Props = {
  year: CurrentAcademicYear | null | undefined;
  className?: string;
};

export function WorkingYearLabel({ year, className }: Props) {
  const t = useTranslations("academics");

  if (!year) {
    return <span className={className ?? "muted"}>{t("noWorkingYear")}</span>;
  }

  return (
    <span className={className ?? "form-inline"}>
      <span className="muted">{t("workingYear")}</span>
      <strong>{year.name}</strong>
    </span>
  );
}
