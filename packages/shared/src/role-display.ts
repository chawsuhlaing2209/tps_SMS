/** Staff roles shown in the tenant User Roles settings screen (ordered). */
export const tenantStaffRoleKeys = [
  "principal",
  "academic_coordinator",
  "teacher",
  "accountant",
  "school_admin",
  "hr_staff",
  "school_owner"
] as const;

export type TenantStaffRoleKey = (typeof tenantStaffRoleKeys)[number];

export type RoleDisplayMeta = {
  label: string;
  /** Key under settings.roles.names for localized UI labels. */
  labelKey?: string;
  initials: string;
  accent: string;
  summaryKey: string;
};

export const roleDisplayMeta: Record<string, RoleDisplayMeta> = {
  principal: {
    label: "Principal",
    labelKey: "principal",
    initials: "P",
    accent: "#36B37E",
    summaryKey: "principalSummary"
  },
  academic_coordinator: {
    label: "Vice Principal",
    labelKey: "academic_coordinator",
    initials: "VP",
    accent: "#4C6EF5",
    summaryKey: "vicePrincipalSummary"
  },
  teacher: {
    label: "Teacher",
    labelKey: "teacher",
    initials: "T",
    accent: "#7950F2",
    summaryKey: "teacherSummary"
  },
  accountant: {
    label: "Finance Officer",
    labelKey: "accountant",
    initials: "FO",
    accent: "#2F9E44",
    summaryKey: "financeOfficerSummary"
  },
  school_admin: {
    label: "Admin Staff",
    labelKey: "school_admin",
    initials: "AS",
    accent: "#F76707",
    summaryKey: "adminStaffSummary"
  },
  hr_staff: {
    label: "HR Staff",
    labelKey: "hr_staff",
    initials: "HR",
    accent: "#495057",
    summaryKey: "hrStaffSummary"
  },
  school_owner: {
    label: "School Owner",
    labelKey: "school_owner",
    initials: "SO",
    accent: "#087F5B",
    summaryKey: "schoolOwnerSummary"
  },
  parent_guardian: {
    label: "Parent / Guardian",
    labelKey: "parent_guardian",
    initials: "PG",
    accent: "#868E96",
    summaryKey: "customRoleSummary"
  },
  student: {
    label: "Student",
    labelKey: "student",
    initials: "ST",
    accent: "#868E96",
    summaryKey: "customRoleSummary"
  }
};

const ADMIN_ROLE_KEYS = new Set([
  "school_admin",
  "principal",
  "school_owner",
  "academic_coordinator"
]);

/** Maps an RBAC role key to the staff employment role stored on the staff record. */
export function employmentRoleForRoleKey(roleKey: string): string {
  if (roleKey === "teacher") {
    return "teacher";
  }
  if (roleKey === "accountant") {
    return "accountant";
  }
  if (ADMIN_ROLE_KEYS.has(roleKey)) {
    return "admin";
  }
  return "staff";
}

export function isTeacherRoleKey(roleKey: string): boolean {
  return roleKey === "teacher";
}

export function roleDisplayFor(key: string, fallbackName?: string): RoleDisplayMeta {
  const known = roleDisplayMeta[key];
  if (known) {
    return known;
  }

  const label = fallbackName?.trim() || key;
  const parts = label.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
      : label.slice(0, 2).toUpperCase();

  return {
    label,
    initials,
    accent: "#868E96",
    summaryKey: "customRoleSummary"
  };
}
