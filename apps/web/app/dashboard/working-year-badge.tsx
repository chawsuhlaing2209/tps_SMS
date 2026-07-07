"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Icon } from "../lib/material-icon";
import { cn } from "../../lib/utils";
import { useCurrentAcademicYear } from "../lib/use-current-academic-year";

export function WorkingYearBadge({ variant = "default" }: { variant?: "default" | "topNav" }) {
  const t = useTranslations("academics");
  const c = useTranslations("common");
  const year = useCurrentAcademicYear();
  const topNav = variant === "topNav";

  if (year.isLoading) {
    return (
      <span
        className={cn(
          "working-year-badge working-year-badge--muted",
          topNav && "working-year-badge--top-nav pds-type-body-m-bold",
          !topNav && "pds-type-body-m-medium",
        )}
      >
        {c("loading")}
      </span>
    );
  }

  if (!year.data) {
    return (
      <Link
        href="/dashboard/academic-setup/years"
        className={cn(
          "working-year-badge working-year-badge--warning",
          topNav && "working-year-badge--top-nav pds-type-body-m-bold",
          !topNav && "pds-type-body-m-medium",
        )}
      >
        {t("noWorkingYear")}
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/academic-setup/years"
      className={cn(
        "working-year-badge",
        topNav ? "working-year-badge--top-nav pds-type-body-m-bold" : "pds-type-body-m-medium",
      )}
      title={t("manageYears")}
    >
      <span>
        {topNav ? t("academicYearNavLabel", { name: year.data.name }) : t("ayLabel", { name: year.data.name })}
      </span>
      {!topNav ? <Icon name="expand_more" size={18} className="working-year-badge__caret" /> : null}
    </Link>
  );
}
