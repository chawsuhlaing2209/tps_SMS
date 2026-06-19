"use client";

import { useTranslations } from "next-intl";
import { Icon } from "../lib/material-icon";
import { PdsBreadcrumb } from "../../components/pds/composites/breadcrumb";
import { WorkingYearBadge } from "./working-year-badge";
import { useResolvedPageHeader } from "./page-header-context";

/** Utility header row — breadcrumb left, academic year + notifications right (Figma body header). */
export function DashboardPageChrome() {
  const t = useTranslations("nav");
  const { breadcrumbs } = useResolvedPageHeader();

  return (
    <div className="dash-page-chrome">
      <div className="dash-page-chrome__inner">
        <PdsBreadcrumb items={breadcrumbs} />
        <div className="dash-page-chrome__actions">
          <WorkingYearBadge />
          <button type="button" className="dash-bell" aria-label={t("notifications")}>
            <Icon name="notifications" size={20} />
            <span className="dash-bell__dot" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
