"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/dashboard/academic-setup/subjects", key: "subjects" as const },
  { href: "/dashboard/academic-setup/grades-classrooms", key: "gradesClassrooms" as const },
  { href: "/dashboard/academic-setup/years", key: "years" as const },
  { href: "/dashboard/academic-setup/terms", key: "terms" as const },
  { href: "/dashboard/academic-setup/tools", key: "tools" as const }
];

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AcademicSetupLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("academicSetup");

  return (
    <div className="page-stack">
      <nav className="subnav subnav--secondary">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              isNavActive(pathname, item.href) ? "subnav-link subnav-link--active" : "subnav-link"
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
