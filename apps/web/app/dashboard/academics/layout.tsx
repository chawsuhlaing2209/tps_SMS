"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SUBMODULES = [
  { href: "/dashboard/academics/years", key: "years" },
  { href: "/dashboard/academics/terms", key: "terms" },
  { href: "/dashboard/academics/grades", key: "grades" },
  { href: "/dashboard/classrooms", key: "classrooms" },
  { href: "/dashboard/academics/subjects", key: "subjects" },
  { href: "/dashboard/academics/tools", key: "tools" }
] as const;

export default function AcademicsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("academics");

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </div>

      <nav className="subnav">
        {SUBMODULES.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              pathname === item.href ? "subnav-link subnav-link--active" : "subnav-link"
            }
          >
            {t(item.key)}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
