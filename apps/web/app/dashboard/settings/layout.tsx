"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ModuleShell, SecondarySideNav } from "../../lib/secondary-side-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("settings");
  const setup = useTranslations("academicSetup");
  const finance = useTranslations("finance");
  const nav = useTranslations("nav");

  return (
    <ModuleShell
      nav={
        <SecondarySideNav
          groups={[
            {
              label: t("navSchool"),
              items: [
                {
                  href: "/dashboard/settings/school-schedule",
                  label: t("schoolSchedule.title"),
                  icon: "schedule"
                }
              ]
            },
            {
              label: t("navSystem"),
              items: [
                {
                  href: "/dashboard/settings/user-roles",
                  label: t("userRoles"),
                  icon: "admin_panel_settings"
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
