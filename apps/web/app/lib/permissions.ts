import type { Permission } from "@sms/shared";

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  required: readonly Permission[]
): boolean {
  if (!permissions?.length || !required.length) {
    return false;
  }
  return required.some((permission) => permissions.includes(permission));
}

export type DashboardNavKey =
  | "overview"
  | "students"
  | "teachers"
  | "structure"
  | "academicSetup"
  | "admissions"
  | "enrollments"
  | "calendar"
  | "timetable"
  | "exams"
  | "finance"
  | "salary"
  | "communication"
  | "audit"
  | "settings"
  | "team"
  | "departments"
  | "facilities";

export type DashboardNavGroupKey = "school" | "academics" | "business" | "admin";

export type DashboardNavItem = {
  href: string;
  key: DashboardNavKey;
  anyOf?: Permission[];
};

export type DashboardNavGroup = {
  key: DashboardNavGroupKey;
  items: DashboardNavItem[];
};

export const DASHBOARD_NAV: DashboardNavItem[] = [
  { href: "/dashboard", key: "overview" },
  {
    href: "/dashboard/people",
    key: "students",
    anyOf: ["student.view", "student.manage"]
  },
  {
    href: "/dashboard/teachers",
    key: "teachers",
    anyOf: ["hr.manage", "classroom.manage"]
  },
  { href: "/dashboard/structure", key: "structure", anyOf: ["academic_setup.manage"] },
  { href: "/dashboard/facilities", key: "facilities", anyOf: ["facility.manage"] },
  { href: "/dashboard/academic-setup", key: "academicSetup", anyOf: ["academic_setup.manage"] },
  { href: "/dashboard/admissions", key: "admissions", anyOf: ["admissions.manage"] },
  { href: "/dashboard/enrollments", key: "enrollments", anyOf: ["student.manage"] },
  {
    href: "/dashboard/calendar",
    key: "calendar",
    anyOf: ["calendar.manage", "student.view"]
  },
  {
    href: "/dashboard/timetable",
    key: "timetable",
    anyOf: ["timetable.manage", "student.view"]
  },
  {
    href: "/dashboard/exams",
    key: "exams",
    anyOf: ["exam.manage", "grade.approve", "report_card.generate"]
  },
  { href: "/dashboard/finance", key: "finance", anyOf: ["finance.manage"] },
  { href: "/dashboard/salary", key: "salary", anyOf: ["salary.manage"] },
  {
    href: "/dashboard/communication",
    key: "communication",
    anyOf: ["communication.manage"]
  },
  { href: "/dashboard/audit", key: "audit", anyOf: ["audit.view"] },
  { href: "/dashboard/settings/user-roles", key: "settings", anyOf: ["identity.manage"] },
  {
    href: "/dashboard/team",
    key: "team",
    anyOf: ["hr.manage", "identity.manage"]
  },
  { href: "/dashboard/departments", key: "departments", anyOf: ["hr.manage"] }
];

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  {
    key: "school",
    items: DASHBOARD_NAV.filter((item) => ["overview", "students", "teachers"].includes(item.key))
  },
  {
    key: "academics",
    items: DASHBOARD_NAV.filter((item) =>
      ["structure", "academicSetup", "facilities", "calendar", "timetable", "exams"].includes(item.key)
    )
  },
  {
    key: "business",
    items: DASHBOARD_NAV.filter((item) =>
      ["admissions", "enrollments", "finance", "salary"].includes(item.key)
    )
  },
  {
    key: "admin",
    items: DASHBOARD_NAV.filter((item) =>
      ["communication", "audit", "settings", "team", "departments"].includes(item.key)
    )
  }
];

export function visibleDashboardNav(
  permissions: readonly string[] | undefined
): DashboardNavItem[] {
  return DASHBOARD_NAV.filter(
    (item) => !item.anyOf || hasAnyPermission(permissions, item.anyOf)
  );
}

export function visibleDashboardNavGroups(
  permissions: readonly string[] | undefined
): DashboardNavGroup[] {
  return DASHBOARD_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.anyOf || hasAnyPermission(permissions, item.anyOf))
  })).filter((group) => group.items.length > 0);
}
