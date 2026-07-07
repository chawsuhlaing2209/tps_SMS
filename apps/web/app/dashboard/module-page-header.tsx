"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { DashboardNavKey } from "../lib/permissions";
import { moduleBreadcrumbs } from "../lib/page-header-utils";
import { PageHeader, type PageBreadcrumb } from "./page-header-context";

export type ModulePageHeaderProps = {
  /** Nav item for default group › module breadcrumbs. Omit for custom trails only. */
  navKey?: DashboardNavKey;
  title: string;
  breadcrumbs?: PageBreadcrumb[];
  actions?: ReactNode;
  description?: string;
};

/** Publishes standard module breadcrumbs + title to the in-body page chrome. */
export function ModulePageHeader({
  navKey,
  title,
  breadcrumbs,
  actions,
  description,
}: ModulePageHeaderProps) {
  const nav = useTranslations("nav");
  const crumbs = breadcrumbs ?? (navKey ? moduleBreadcrumbs(navKey, nav) : []);

  return (
    <PageHeader title={title} breadcrumbs={crumbs} actions={actions} description={description} />
  );
}
