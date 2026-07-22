import type { Permission } from "./roles.js";

export const permissionCategories = ["students", "academic", "finance", "system"] as const;

export type PermissionCategory = (typeof permissionCategories)[number];

export type PermissionCatalogItem = {
  permission: Permission;
  labelKey: string;
};

export type PermissionCatalogGroup = {
  category: PermissionCategory;
  items: PermissionCatalogItem[];
};

/** UI-facing permission groups for tenant role configuration. */
export const tenantPermissionCatalog: PermissionCatalogGroup[] = [
  {
    category: "students",
    items: [
      { permission: "student.view", labelKey: "studentView" },
      { permission: "student.manage", labelKey: "studentManage" },
      { permission: "admissions.manage", labelKey: "admissionsManage" }
    ]
  },
  {
    category: "academic",
    items: [
      { permission: "classroom.manage", labelKey: "classroomManage" },
      { permission: "facility.manage", labelKey: "facilityManage" },
      { permission: "academic_setup.manage", labelKey: "academicSetupManage" },
      { permission: "timetable.manage", labelKey: "timetableManage" }
    ]
  },
  {
    category: "finance",
    items: [
      { permission: "finance.manage", labelKey: "financeManage" },
      { permission: "discount.request", labelKey: "discountRequest" },
      { permission: "discount.approve", labelKey: "discountApprove" },
      { permission: "salary.manage", labelKey: "salaryManage" },
      { permission: "report.view", labelKey: "reportView" }
    ]
  },
  {
    category: "system",
    items: [
      { permission: "identity.manage", labelKey: "identityManage" },
      { permission: "tenant.configure", labelKey: "tenantConfigure" },
      { permission: "hr.manage", labelKey: "hrManage" },
      { permission: "communication.manage", labelKey: "communicationManage" },
      { permission: "audit.view", labelKey: "auditView" }
    ]
  }
];

export const tenantConfigurablePermissions: Permission[] = tenantPermissionCatalog.flatMap(
  (group) => group.items.map((item) => item.permission)
);

export function isTenantConfigurablePermission(value: string): value is Permission {
  return tenantConfigurablePermissions.includes(value as Permission);
}

export function categoryBadgeColor(category: PermissionCategory): string {
  if (category === "students") {
    return "roles-badge--students";
  }
  if (category === "academic") {
    return "roles-badge--academic";
  }
  if (category === "finance") {
    return "roles-badge--finance";
  }
  return "roles-badge--system";
}
