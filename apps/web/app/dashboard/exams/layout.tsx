"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { hasAnyPermission } from "../../lib/permissions";
import { getSession } from "../../lib/session";

const SUBMODULES = [
  { href: "/dashboard/exams", key: "cycles", anyOf: ["exam.manage"] as const },
  { href: "/dashboard/exams/schedules", key: "schedules", anyOf: ["exam.manage"] as const },
  {
    href: "/dashboard/exams/report-cards",
    key: "reportCards",
    anyOf: ["report_card.generate", "report_card.approve"] as const
  },
  { href: "/dashboard/exams/grade-rules", key: "gradeRules", anyOf: ["grade.approve"] as const }
] as const;

export default function ExamsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("exams");
  const permissions = getSession()?.permissions;

  const visible = SUBMODULES.filter((item) => hasAnyPermission(permissions, [...item.anyOf]));

  return (
    <div className="page-stack">
      <nav className="subnav">
        {visible.map((item) => {
          const active =
            item.href === "/dashboard/exams"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "subnav-link subnav-link--active" : "subnav-link"}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
