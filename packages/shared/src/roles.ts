export const roles = [
  "platform_super_admin",
  "school_owner",
  "principal",
  "school_admin",
  "academic_coordinator",
  "teacher",
  "accountant",
  "hr_staff",
  "parent_guardian",
  "student"
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "tenant.manage",
  "tenant.configure",
  "support_access.manage",
  "identity.manage",
  "academic_setup.manage",
  "admissions.manage",
  "student.manage",
  "student.view",
  "hr.manage",
  "leave.manage",
  "salary.manage",
  "classroom.manage",
  "facility.manage",
  "calendar.manage",
  "timetable.manage",
  "attendance.mark",
  "attendance.correct",
  "attendance.audit.view",
  "lms.manage",
  "exam.manage",
  "grade.submit",
  "grade.approve",
  "report_card.generate",
  "report_card.approve",
  "finance.manage",
  "discount.request",
  "discount.approve",
  "communication.manage",
  "audit.view",
  "report.view"
] as const;

export type Permission = (typeof permissions)[number];

export const rolePermissions: Record<Role, Permission[]> = {
  platform_super_admin: [
    "tenant.manage",
    "support_access.manage",
    "audit.view",
    "report.view"
  ],
  school_owner: [
    "tenant.configure",
    "identity.manage",
    "academic_setup.manage",
    "admissions.manage",
    "student.manage",
    "student.view",
    "hr.manage",
    "leave.manage",
    "salary.manage",
    "classroom.manage",
    "facility.manage",
    "calendar.manage",
    "timetable.manage",
    "attendance.audit.view",
    "lms.manage",
    "exam.manage",
    "grade.approve",
    "report_card.approve",
    "finance.manage",
    "discount.approve",
    "communication.manage",
    "audit.view",
    "report.view"
  ],
  principal: [
    "tenant.configure",
    "identity.manage",
    "academic_setup.manage",
    "student.view",
    "hr.manage",
    "leave.manage",
    "classroom.manage",
    "facility.manage",
    "calendar.manage",
    "timetable.manage",
    "attendance.audit.view",
    "exam.manage",
    "grade.approve",
    "report_card.approve",
    "discount.approve",
    "audit.view",
    "report.view"
  ],
  school_admin: [
    "tenant.configure",
    "admissions.manage",
    "student.manage",
    "student.view",
    "classroom.manage",
    "facility.manage",
    "calendar.manage",
    "timetable.manage",
    "attendance.audit.view",
    "communication.manage",
    "report.view"
  ],
  academic_coordinator: [
    "academic_setup.manage",
    "student.view",
    "classroom.manage",
    "facility.manage",
    "calendar.manage",
    "timetable.manage",
    "attendance.audit.view",
    "lms.manage",
    "exam.manage",
    "grade.approve",
    "report_card.generate",
    "report_card.approve",
    "report.view"
  ],
  teacher: [
    "student.view",
    "attendance.mark",
    "attendance.correct",
    "lms.manage",
    "grade.submit",
    "report_card.generate"
  ],
  accountant: [
    "student.view",
    "salary.manage",
    "finance.manage",
    "discount.request",
    "communication.manage",
    "report.view"
  ],
  hr_staff: ["hr.manage", "leave.manage", "salary.manage", "report.view"],
  parent_guardian: ["student.view"],
  student: ["student.view"]
};
