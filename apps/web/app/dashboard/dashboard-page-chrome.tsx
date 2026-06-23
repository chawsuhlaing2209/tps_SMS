"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Icon } from "../lib/material-icon";
import { LanguageSwitcher } from "../lib/language-switcher";
import { TopNavBar } from "../../components/pds/composites/top-nav-bar";
import { WorkingYearBadge } from "./working-year-badge";
import { useResolvedPageHeader } from "./page-header-context";

/** Dashboard top navigation — breadcrumb, locale, academic year, notifications (Figma 119:9730). */
export function DashboardPageChrome() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { breadcrumbs, actions } = useResolvedPageHeader();
  const isHome = pathname === "/dashboard" || pathname === "/dashboard/";

  return (
    <TopNavBar
      className="dash-page-chrome"
      breadcrumbItems={breadcrumbs}
      utilities={
        <>
          {isHome && actions ? (
            <div className="pds-top-nav-bar__page-actions">{actions}</div>
          ) : null}
          <LanguageSwitcher variant="segmented" />
          <WorkingYearBadge variant="topNav" />
          <button
            type="button"
            className="pds-top-nav-bar__notifications"
            aria-label={t("notifications")}
          >
            <Icon name="notifications" size={20} />
            <span className="pds-top-nav-bar__notifications-dot" aria-hidden />
          </button>
        </>
      }
    />
  );
}
