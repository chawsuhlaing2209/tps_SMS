"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Icon } from "../lib/material-icon";
import { LanguageSwitcher } from "../lib/language-switcher";
import { TopNavBar } from "../../components/pds/composites/top-nav-bar";
import { NotificationsBell } from "./notifications-bell";
import { WorkingYearBadge } from "./working-year-badge";
import { useResolvedPageHeader } from "./page-header-context";

/** Dashboard top navigation — breadcrumb, locale, academic year, notifications (Figma 119:9730). */
export function DashboardPageChrome({ onMenuClick }: { onMenuClick?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { breadcrumbs, actions } = useResolvedPageHeader();
  const isHome = pathname === "/dashboard" || pathname === "/dashboard/";

  return (
    <TopNavBar
      className="dash-page-chrome"
      leading={
        onMenuClick ? (
          <button
            type="button"
            className="pds-top-nav-bar__menu-btn"
            onClick={onMenuClick}
            aria-label={t("openNavigation")}
          >
            <Icon name="menu" size={22} />
          </button>
        ) : null
      }
      breadcrumbItems={breadcrumbs}
      utilities={
        <>
          {isHome && actions ? (
            <div className="pds-top-nav-bar__page-actions">{actions}</div>
          ) : null}
          <LanguageSwitcher variant="segmented" />
          <WorkingYearBadge variant="topNav" />
          <NotificationsBell />
        </>
      }
    />
  );
}
