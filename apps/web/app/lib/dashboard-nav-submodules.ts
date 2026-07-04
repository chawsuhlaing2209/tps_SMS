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

export const DASHBOARD_NAV_SUBMODULES: Partial<
  Record<DashboardNavKey, NavSubmoduleGroupDef[]>
> = {
  finance: [
    {
      labelNs: "finance",
      labelKey: "navIntelligence",
      items: [
        {
          href: "/dashboard/finance/overview",
          icon: "insights",
          labelNs: "finance",
          labelKey: "overview.nav"
        }
      ]
    },
    {
      labelNs: "finance",
      labelKey: "navReceivables",
      items: [
        {
          href: "/dashboard/finance/invoices",
          icon: "description",
          labelNs: "finance",
          labelKey: "invoices"
        },
        {
          href: "/dashboard/finance/billing",
          icon: "account_balance_wallet",
          labelNs: "finance",
          labelKey: "collection"
        },
        {
          href: "/dashboard/finance/payments",
          icon: "account_balance",
          labelNs: "finance",
          labelKey: "payments"
        }
      ]
    },
    {
      labelNs: "finance",
      labelKey: "navFinance",
      items: [
        {
          href: "/dashboard/finance/fee-structures",
          icon: "sell",
          labelNs: "finance",
          labelKey: "feeStructures"
        },
        {
          href: "/dashboard/finance/discounts",
          icon: "percent",
          labelNs: "finance",
          labelKey: "discounts"
        }
      ]
    }
  ],
  academicSetup: [
    {
      labelNs: "academicSetup",
      labelKey: "navSchool",
      items: [
        {
          href: "/dashboard/academic-setup/years",
          icon: "calendar_today",
          labelNs: "academicSetup",
          labelKey: "years"
        }
      ]
    },
    {
      labelNs: "academicSetup",
      labelKey: "navAcademic",
      items: [
        {
          href: "/dashboard/academic-setup/subjects",
          icon: "menu_book",
          labelNs: "academicSetup",
          labelKey: "subjects"
        },
        {
          href: "/dashboard/academic-setup/grades-classrooms",
          icon: "meeting_room",
          labelNs: "academicSetup",
          labelKey: "gradesClassrooms"
        },
        {
          href: "/dashboard/academic-setup/terms",
          icon: "date_range",
          labelNs: "academicSetup",
          labelKey: "terms"
        }
      ]
    }
  ],
  settings: [
    {
      labelNs: "settings",
      labelKey: "navSchool",
      items: [
        {
          href: "/dashboard/settings/school-profile",
          icon: "school",
          labelNs: "settings",
          labelKey: "schoolProfile.title",
          anyOf: ["tenant.configure"]
        },
        {
          href: "/dashboard/settings/school-schedule",
          icon: "schedule",
          labelNs: "settings",
          labelKey: "schoolSchedule.title"
        }
      ]
    },
    {
      labelNs: "settings",
      labelKey: "navSystem",
      items: [
        {
          href: "/dashboard/settings/preferences",
          icon: "tune",
          labelNs: "settings",
          labelKey: "preferences.title",
          anyOf: ["tenant.configure"]
        },
        {
          href: "/dashboard/settings/user-roles",
          icon: "admin_panel_settings",
          labelNs: "settings",
          labelKey: "userRoles"
        }
      ]
    }
  ],
  salary: [
    {
      labelNs: "salary",
      labelKey: "navHrPayroll",
      items: [
        {
          href: "/dashboard/salary/run",
          icon: "payments",
          labelNs: "salary",
          labelKey: "runPayroll",
          exact: true
        },
        {
          href: "/dashboard/salary/pay-components",
          icon: "account_balance_wallet",
          labelNs: "salary",
          labelKey: "payComponentsNav"
        },
        {
          href: "/dashboard/salary/benefits",
          icon: "card_giftcard",
          labelNs: "salary",
          labelKey: "bonusesBenefits"
        },
        {
          href: "/dashboard/salary/leaves",
          icon: "event_busy",
          labelNs: "leaves",
          labelKey: "nav",
          anyOf: ["leave.manage"]
        }
      ]
    }
  ]
};

/** Module path prefixes used for parent active-state matching. */
export const MODULE_PATH_PREFIX: Partial<Record<DashboardNavKey, string>> = {
  finance: "/dashboard/finance",
  academicSetup: "/dashboard/academic-setup",
  settings: "/dashboard/settings",
  salary: "/dashboard/salary"
};

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
