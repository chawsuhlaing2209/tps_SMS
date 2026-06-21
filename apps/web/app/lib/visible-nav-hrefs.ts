import {
  DASHBOARD_NAV_SUBMODULES,
  filterSubmoduleGroups
} from "./dashboard-nav-submodules";
import { visibleDashboardNavGroups } from "./permissions";

/** Every dashboard href the signed-in user can open from the sidebar. */
export function collectVisibleNavHrefs(permissions: readonly string[] | undefined): string[] {
  const hrefs = new Set<string>();

  for (const group of visibleDashboardNavGroups(permissions)) {
    for (const item of group.items) {
      const subGroups = filterSubmoduleGroups(DASHBOARD_NAV_SUBMODULES[item.key], permissions);
      if (subGroups.length) {
        for (const subGroup of subGroups) {
          for (const subitem of subGroup.items) {
            hrefs.add(subitem.href);
          }
        }
      } else {
        hrefs.add(item.href);
      }
    }
  }

  return [...hrefs];
}
