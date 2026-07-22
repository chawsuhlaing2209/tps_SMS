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
  | "team"
  | "admissions"
  | "enrollments"
  | "timetable"
  | "financeOverview"
  | "collection"
  | "invoices"
  | "payments"
  | "feeStructures"
  | "discounts"
  | "leaves"
  | "runPayroll"
  | "deductions"
  | "benefits"
  | "academicYears"
  | "terms"
  | "subjects"
  | "gradesClassrooms"
  | "structure"
  | "facilities"
  | "schoolProfile"
  | "schoolSchedule"
  | "preferences"
  | "departments"
  | "userRoles"
  | "audit";

export type DashboardNavGroupKey =
  | "home"
  | "people"
  | "enrollment"
  | "teaching"
  | "finance"
  | "hr"
  | "academics"
  | "masterSettings"
  | "admin";

export type DashboardNavItem = {
  href: string;
  key: DashboardNavKey;
  anyOf?: Permission[];
};

export type DashboardNavGroup = {
  key: DashboardNavGroupKey;
  items: DashboardNavItem[];
};

/**
 * IA (docs/ia-redesign-proposal.md, approved): ordered by frequency — daily
 * work at the top, yearly configuration at the bottom. Finance and payroll
 * items are top-level (no expandable wrapper); only Academic Setup keeps
 * submodules because it absorbs Structure + Facilities.
 */
export const DASHBOARD_NAV: DashboardNavItem[] = [
  { href: "/dashboard", key: "overview" },

  // PEOPLE — one home for every person type.
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
  {
    href: "/dashboard/team",
    key: "team",
    anyOf: ["hr.manage", "identity.manage"]
  },

  // ENROLLMENT — the seasonal pipeline, in process order.
  { href: "/dashboard/admissions", key: "admissions", anyOf: ["admissions.manage"] },
  { href: "/dashboard/enrollments", key: "enrollments", anyOf: ["student.manage"] },

  // TEACHING — weekly rhythm (attendance/exams/report cards land here later).
  { href: "/dashboard/structure", key: "structure", anyOf: ["academic_setup.manage"] },
  {
    href: "/dashboard/timetable",
    key: "timetable",
    anyOf: ["timetable.manage", "student.view"]
  },

  // FINANCE — the accountant's day, frequency-ordered.
  { href: "/dashboard/finance/overview", key: "financeOverview", anyOf: ["finance.manage"] },
  { href: "/dashboard/finance/billing", key: "collection", anyOf: ["finance.manage"] },
  { href: "/dashboard/finance/invoices", key: "invoices", anyOf: ["finance.manage"] },
  { href: "/dashboard/finance/payments", key: "payments", anyOf: ["finance.manage"] },
  { href: "/dashboard/finance/fee-structures", key: "feeStructures", anyOf: ["finance.manage"] },
  { href: "/dashboard/finance/discounts", key: "discounts", anyOf: ["finance.manage"] },

  // HR & PAYROLL — leaves daily, payroll monthly.
  { href: "/dashboard/salary/leaves", key: "leaves", anyOf: ["leave.manage"] },
  { href: "/dashboard/salary/run", key: "runPayroll", anyOf: ["salary.manage"] },
  { href: "/dashboard/salary/pay-components", key: "deductions", anyOf: ["salary.manage"] },
  { href: "/dashboard/salary/benefits", key: "benefits", anyOf: ["salary.manage"] },

  // ACADEMICS — school structure as flat modules (years/terms/subjects/grades/campus).
  {
    href: "/dashboard/academic-setup/years",
    key: "academicYears",
    anyOf: ["academic_setup.manage"]
  },
  {
    href: "/dashboard/academic-setup/terms",
    key: "terms",
    anyOf: ["academic_setup.manage"]
  },
  {
    href: "/dashboard/academic-setup/subjects",
    key: "subjects",
    anyOf: ["academic_setup.manage"]
  },
  {
    href: "/dashboard/academic-setup/grades-classrooms",
    key: "gradesClassrooms",
    anyOf: ["academic_setup.manage"]
  },
  { href: "/dashboard/facilities", key: "facilities", anyOf: ["facility.manage"] },

  // MASTER SETTINGS — 1–2×/year configuration.
  {
    href: "/dashboard/settings/school-profile",
    key: "schoolProfile",
    anyOf: ["tenant.configure"]
  },
  {
    href: "/dashboard/settings/school-schedule",
    key: "schoolSchedule",
    anyOf: ["academic_setup.manage"]
  },
  {
    href: "/dashboard/settings/preferences",
    key: "preferences",
    anyOf: ["tenant.configure"]
  },
  { href: "/dashboard/departments", key: "departments", anyOf: ["hr.manage"] },

  // ADMIN — access control + traceability.
  {
    href: "/dashboard/settings/user-roles",
    key: "userRoles",
    anyOf: ["identity.manage"]
  },
  { href: "/dashboard/audit", key: "audit", anyOf: ["audit.view"] }
];

const groupItems = (keys: DashboardNavKey[]): DashboardNavItem[] =>
  DASHBOARD_NAV.filter((item) => keys.includes(item.key));

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  { key: "home", items: groupItems(["overview"]) },
  { key: "people", items: groupItems(["students", "teachers", "team"]) },
  { key: "enrollment", items: groupItems(["admissions", "enrollments"]) },
  { key: "teaching", items: groupItems(["structure", "timetable"]) },
  {
    key: "finance",
    items: groupItems([
      "financeOverview",
      "collection",
      "invoices",
      "payments",
      "feeStructures",
      "discounts"
    ])
  },
  { key: "hr", items: groupItems(["leaves", "runPayroll", "deductions", "benefits"]) },
  {
    key: "academics",
    items: groupItems([
      "academicYears",
      "terms",
      "subjects",
      "gradesClassrooms",
      "facilities"
    ])
  },
  {
    key: "masterSettings",
    items: groupItems([
      "schoolProfile",
      "schoolSchedule",
      "preferences",
      "departments"
    ])
  },
  { key: "admin", items: groupItems(["userRoles", "audit"]) }
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
