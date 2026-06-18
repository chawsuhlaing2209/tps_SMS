"use client";

import { useTranslations } from "next-intl";
import { Fragment } from "react";
import Link from "next/link";
import { Icon } from "../lib/material-icon";
import { WorkingYearBadge } from "./working-year-badge";
import { useResolvedPageHeader } from "./page-header-context";

export function DashboardTopbar() {
  const t = useTranslations("nav");
  const { title, breadcrumbs, description } = useResolvedPageHeader();

  return (
    <header className="dash-topbar">
      <div className="dash-topbar-left">
        {breadcrumbs.length ? (
          <nav className="dash-topbar-crumb" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? <span className="dash-topbar-crumb__sep">/</span> : null}
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="dash-topbar-crumb__link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={isLast ? "dash-topbar-crumb__current" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </nav>
        ) : null}
        <h1 className="dash-topbar-title">{title}</h1>
        {description ? <p className="dash-topbar-desc">{description}</p> : null}
      </div>

      <div className="dash-topbar-actions">
        <div className="dash-search">
          <Icon name="search" size={19} className="dash-search__icon" />
          <input
            type="search"
            className="dash-search__input"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <WorkingYearBadge />
        <button type="button" className="dash-bell" aria-label={t("notifications")}>
          <Icon name="notifications" size={20} />
          <span className="dash-bell__dot" aria-hidden />
        </button>
      </div>
    </header>
  );
}
