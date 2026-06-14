export type MvpPhaseId = "mvp_1" | "mvp_2" | "mvp_3" | "mvp_4" | "mvp_5";

export interface MvpBacklogItem {
  id: string;
  phase: MvpPhaseId;
  title: string;
  outcome: string;
}

export const mvpBacklog: MvpBacklogItem[] = [
  {
    id: "mvp1-platform-tenant-foundation",
    phase: "mvp_1",
    title: "Platform tenant foundation",
    outcome: "Create, configure, suspend, archive, and isolate tenant schools."
  },
  {
    id: "mvp1-auth-rbac-audit",
    phase: "mvp_1",
    title: "Auth, RBAC, and audit logs",
    outcome: "Protect tenant data, assign scoped roles, and record sensitive changes."
  },
  {
    id: "mvp1-academic-master-data",
    phase: "mvp_1",
    title: "Academic master data",
    outcome: "Configure academic years, grades, sections, subjects, and import staff/students."
  },
  {
    id: "mvp2-admissions-student-lifecycle",
    phase: "mvp_2",
    title: "Admissions to student lifecycle",
    outcome: "Convert enquiries into enrolled students with guardians and fee profiles."
  },
  {
    id: "mvp2-hr-classroom",
    phase: "mvp_2",
    title: "HR and classroom setup",
    outcome: "Manage staff records and assign active teachers to classroom subjects."
  },
  {
    id: "mvp3-daily-academic-operations",
    phase: "mvp_3",
    title: "Calendar, timetable, attendance, LMS",
    outcome: "Run daily teaching workflows with audited attendance corrections."
  },
  {
    id: "mvp4-assessment-reporting",
    phase: "mvp_4",
    title: "Exams, grading, and report cards",
    outcome: "Approve marks, calculate grades, and publish immutable report cards."
  },
  {
    id: "mvp5-finance-communication",
    phase: "mvp_5",
    title: "Fees, discounts, salary, finance, email",
    outcome: "Generate invoices, verify payments, approve discounts, track salaries, and notify families."
  }
];
