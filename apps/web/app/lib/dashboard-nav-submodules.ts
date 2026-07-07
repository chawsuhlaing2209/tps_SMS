import type { Permission } from "@sms/shared";
import { hasAnyPermission, type DashboardNavKey } from "./permissions";

export type NavSubmoduleDef = {
  href: string;
  icon: string;
  labelNs: string;
  labelKey: string;
  exact?: boolean;
  anyOf?: Permission[];
};

export type NavSubmoduleGroupDef = {
  labelNs?: string;
  labelKey?: string;
  items: NavSubmoduleDef[];
};

/**
 * No module currently has an expandable submodule tree — the IA keeps every
 * page as a flat top-level item. The machinery stays for future hubs
 * (e.g. Exams & Grading).
 */
export const DASHBOARD_NAV_SUBMODULES: Partial<
  Record<DashboardNavKey, NavSubmoduleGroupDef[]>
> = {};

/** Module path prefixes used for parent active-state matching. */
export const MODULE_PATH_PREFIX: Partial<Record<DashboardNavKey, string>> = {};

export function filterSubmoduleGroups(
  groups: NavSubmoduleGroupDef[] | undefined,
  permissions: readonly string[] | undefined
): NavSubmoduleGroupDef[] {
  if (!groups?.length) {
    return [];
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.anyOf || hasAnyPermission(permissions, item.anyOf)
      )
    }))
    .filter((group) => group.items.length > 0);
}

export function isSubmoduleActive(pathname: string, item: NavSubmoduleDef): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function isModuleWithSubmodulesActive(
  pathname: string,
  navKey: DashboardNavKey,
  groups: NavSubmoduleGroupDef[]
): boolean {
  const prefix = MODULE_PATH_PREFIX[navKey];
  if (prefix) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }

  const items = groups.flatMap((group) => group.items);
  return items.some((item) => isSubmoduleActive(pathname, item));
}

export function firstSubmoduleHref(groups: NavSubmoduleGroupDef[]): string | undefined {
  return groups.flatMap((group) => group.items)[0]?.href;
}
