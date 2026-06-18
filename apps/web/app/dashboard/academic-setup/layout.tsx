"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ModuleShell, SecondarySideNav } from "../../lib/secondary-side-nav";

export default function AcademicSetupLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("academicSetup");

  return (
    <ModuleShell
      nav={
        <SecondarySideNav
          groups={[
            {
              label: t("navSchool"),
              items: [
                {
                  href: "/dashboard/academic-setup/years",
                  label: t("years"),
                  icon: "calendar_today"
                }
              ]
            },
            {
              label: t("navAcademic"),
              items: [
                {
                  href: "/dashboard/academic-setup/subjects",
                  label: t("subjects"),
                  icon: "menu_book"
                },
                {
                  href: "/dashboard/academic-setup/grades-classrooms",
                  label: t("gradesClassrooms"),
                  icon: "meeting_room"
                },
                {
                  href: "/dashboard/academic-setup/terms",
                  label: t("terms"),
                  icon: "date_range"
                }
              ]
            },
            {
              label: t("navOperations"),
              items: [
                {
                  href: "/dashboard/academic-setup/tools",
                  label: t("tools"),
                  icon: "build"
                }
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
