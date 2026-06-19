"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Icon } from "../lib/material-icon";
import { useCurrentAcademicYear } from "../lib/use-current-academic-year";

export function WorkingYearBadge() {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const year = useCurrentAcademicYear();

  if (year.isLoading) {
    return <span className="pds-type-body-m-medium working-year-badge working-year-badge--muted">{c("loading")}</span>;
  }

  if (!year.data) {
    return (
      <Link href="/dashboard/academic-setup/years" className="pds-type-body-m-medium working-year-badge working-year-badge--warning">
        {t("noWorkingYear")}
      </Link>
    );
  }

  return (
    <Link href="/dashboard/academic-setup/years" className="pds-type-body-m-medium working-year-badge" title={t("manageYears")}>
      <span>{t("ayLabel", { name: year.data.name })}</span>
      <Icon name="expand_more" size={18} className="working-year-badge__caret" />
    </Link>
  );
}
