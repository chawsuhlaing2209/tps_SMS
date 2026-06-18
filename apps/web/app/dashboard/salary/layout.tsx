"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SUBMODULES = [
  { href: "/dashboard/salary", key: "components" },
  { href: "/dashboard/salary/records", key: "records" }
] as const;

export default function SalaryLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("salary");

  return (
    <div className="page-stack">
      <nav className="subnav">
        {SUBMODULES.map((item) => {
          const active =
            item.href === "/dashboard/salary"
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
