"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ModuleShell, SecondarySideNav } from "../../lib/secondary-side-nav";

export default function SalaryLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("salary");

  return (
    <ModuleShell
      nav={
        <SecondarySideNav
          groups={[
            {
              label: t("navSalary"),
              items: [
                { href: "/dashboard/salary", label: t("components"), icon: "tune", exact: true },
                { href: "/dashboard/salary/records", label: t("records"), icon: "receipt_long" }
              ]
            }
          ]}
        />
      }
    >
      {children}
    </ModuleShell>
  );
}
