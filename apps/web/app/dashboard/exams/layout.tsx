"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";
import { ModuleShell, SecondarySideNav } from "../../lib/secondary-side-nav";

const SUBMODULES = [
  { href: "/dashboard/exams", key: "cycles", icon: "grading", anyOf: ["exam.manage"] as const },
  {
    href: "/dashboard/exams/schedules",
    key: "schedules",
    icon: "event",
    anyOf: ["exam.manage"] as const
  },
  {
    href: "/dashboard/exams/report-cards",
    key: "reportCards",
    icon: "description",
    anyOf: ["report_card.generate", "report_card.approve"] as const
  },
  {
    href: "/dashboard/exams/grade-rules",
    key: "gradeRules",
    icon: "rule",
    anyOf: ["grade.approve"] as const
  }
] as const;

export default function ExamsLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("exams");
  const permissions = getSession()?.permissions;

  const visible = SUBMODULES.filter((item) => hasAnyPermission(permissions, [...item.anyOf]));

  return (
    <ModuleShell
      nav={
        <SecondarySideNav
          groups={[
            {
              label: t("navExams"),
              items: visible.map((item) => ({
                href: item.href,
                label: t(item.key),
                icon: item.icon,
                exact: item.href === "/dashboard/exams"
              }))
            }
          ]}
        />
      }
    >
      {children}
    </ModuleShell>
  );
}
