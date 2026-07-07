import {
  DASHBOARD_NAV,
  DASHBOARD_NAV_GROUPS,
  type DashboardNavGroupKey,
  type DashboardNavKey,
} from "./permissions";
import type { PageBreadcrumb } from "../dashboard/page-header-context";

export function navGroupForKey(navKey: DashboardNavKey): DashboardNavGroupKey {
  for (const group of DASHBOARD_NAV_GROUPS) {
    if (group.items.some((item) => item.key === navKey)) {
      return group.key;
    }
  }
  return "home";
}

export function navHrefForKey(navKey: DashboardNavKey): string {
  return DASHBOARD_NAV.find((item) => item.key === navKey)?.href ?? "/dashboard";
}

/** Standard module breadcrumbs: group › module [› …tail]. */
export function moduleBreadcrumbs(
  navKey: DashboardNavKey,
  navT: (key: string) => string,
  tail?: PageBreadcrumb[]
): PageBreadcrumb[] {
  const groupKey = navGroupForKey(navKey);
  const href = navHrefForKey(navKey);
  const crumbs: PageBreadcrumb[] = [
    { label: navT(`group_${groupKey}`) },
    { label: navT(navKey), href: tail?.length ? href : undefined },
  ];
  if (tail?.length) {
    crumbs.push(...tail);
  }
  return crumbs;
}
