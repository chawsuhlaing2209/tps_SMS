import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn
} from "drizzle-orm/pg-core";

export const languageEnum = pgEnum("language", ["my", "en"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended", "archived"]);
export const recordStatusEnum = pgEnum("record_status", ["draft", "active", "inactive", "archived"]);
export const userStatusEnum = pgEnum("user_status", ["invited", "active", "suspended", "archived"]);
export const studentStatusEnum = pgEnum("student_status", [
  "draft",
  "enrolled",
  "transferred",
  "withdrawn",
  "graduated",
  "archived"
]);
export const staffStatusEnum = pgEnum("staff_status", [
  "active",
  "probation",
  "resigned",
  "terminated",
  "archived"
]);
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "visit_scheduled",
  "assessment_scheduled",
  "offered",
  "enrolled",
  "lost"
]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
  "sick",
  "leave",
  "half_day"
]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "draft",
  "submitted",
  "reviewed",
  "approved",
  "published",
  "archived",
  "rejected"
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "partial",
  "paid",
  "overdue",
  "waived",
  "refunded",
  "cancelled"
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "bank_transfer",
  "kbzpay",
  "wavepay",
  "aya_pay",
  "cb_pay",
  "other"
]);
export const paymentKindEnum = pgEnum("payment_kind", ["payment", "refund"]);
export const invoiceSourceEnum = pgEnum("invoice_source", [
  "enrollment",
  "recurring",
  "ad_hoc"
]);
export const payComponentKindEnum = pgEnum("pay_component_kind", ["earning", "deduction"]);
export const payComponentCalculationEnum = pgEnum("pay_component_calculation", [
  "fixed",
  "percent_of_basic"
]);
export const benefitEligibilityScopeEnum = pgEnum("benefit_eligibility_scope", [
  "all_staff",
  "teachers",
  "non_teaching"
]);
export const incentiveCadenceEnum = pgEnum("incentive_cadence", [
  "per_payroll",
  "term",
  "annual",
  "one_time"
]);
export const incentiveAwardTypeEnum = pgEnum("incentive_award_type", [
  "fixed",
  "percent_of_basic",
  "manual"
]);
export const payrollRunStatusEnum = pgEnum("payroll_run_status", [
  "draft",
  "processing",
  "approved",
  "closed"
]);
export const payrollRecordStatusEnum = pgEnum("payroll_record_status", [
  "draft",
  "pending",
  "paid"
]);
export const payrollLineSourceTypeEnum = pgEnum("payroll_line_source_type", [
  "component",
  "package",
  "incentive",
  "deduction",
  "adjustment"
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

const actorFields = {
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by")
};

const tenantFields = {
  tenantId: uuid("tenant_id").notNull(),
  ...actorFields,
  ...timestamps
};

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: tenantStatusEnum("status").default("active").notNull(),
    timezone: text("timezone").default("Asia/Yangon").notNull(),
    defaultLanguage: languageEnum("default_language").default("en").notNull(),
    currency: text("currency").default("MMK").notNull(),
    subscriptionStatus: text("subscription_status").default("trial").notNull(),
    ...timestamps
  },
  (table) => ({
    slugUnique: uniqueIndex("tenants_slug_unique").on(table.slug)
  })
);

export const tenantSettings = pgTable(
  "tenant_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
    schoolName: text("school_name").notNull(),
    logoFileId: uuid("logo_file_id"),
    address: text("address"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    registrationDetails: jsonb("registration_details").$type<Record<string, unknown>>().default({}).notNull(),
    branding: jsonb("branding").$type<Record<string, unknown>>().default({}).notNull(),
    receiptPrefix: text("receipt_prefix").default("RCPT").notNull(),
    invoicePrefix: text("invoice_prefix").default("INV").notNull(),
    // Archive retention: auto-purge archived records older than N days.
    // NULL or 0 disables auto-purge (records stay archived until manually deleted).
    archiveRetentionDays: integer("archive_retention_days"),
    ...actorFields,
    ...timestamps
  },
  (table) => ({
    tenantUnique: uniqueIndex("tenant_settings_tenant_unique").on(table.tenantId)
  })
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
    name: text("name").notNull(),
    status: recordStatusEnum("status").default("inactive").notNull(),
    isPrimary: boolean("is_primary").default(true).notNull(),
    ...actorFields,
    ...timestamps
  },
  (table) => ({
    tenantIdx: index("branches_tenant_idx").on(table.tenantId)
  })
);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
    key: text("key").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    ...actorFields,
    ...timestamps
  },
  (table) => ({
    tenantKeyUnique: uniqueIndex("feature_flags_tenant_key_unique").on(table.tenantId, table.key)
  })
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    email: text("email"),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    displayName: text("display_name").notNull(),
    status: userStatusEnum("status").default("invited").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    tenantEmailUnique: uniqueIndex("users_tenant_email_unique").on(table.tenantId, table.email),
    tenantPhoneUnique: uniqueIndex("users_tenant_phone_unique").on(table.tenantId, table.phone)
  })
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
    status: text("status").$type<"active" | "inactive">().default("active").notNull(),
    ...timestamps
  },
  (table) => ({
    tenantKeyUnique: uniqueIndex("roles_tenant_key_unique").on(table.tenantId, table.key)
  })
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    roleId: uuid("role_id").references(() => roles.id).notNull(),
    ...timestamps
  },
  (table) => ({
    tenantUserRoleUnique: uniqueIndex("user_roles_tenant_user_role_unique").on(
      table.tenantId,
      table.userId,
      table.roleId
    )
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    userId: uuid("user_id").references(() => users.id).notNull(),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    tokenHashActiveIdx: index("sessions_token_hash_active_idx")
      .on(table.tokenHash)
      .where(sql`${table.revokedAt} IS NULL`)
  })
);

export const accountActivationTokens = pgTable(
  "account_activation_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    lookupIdx: index("account_activation_tokens_lookup_idx")
      .on(table.tenantId, table.tokenHash)
      .where(sql`${table.usedAt} IS NULL`)
  })
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    tenantRecordIdx: index("audit_logs_tenant_record_idx").on(table.tenantId, table.recordType, table.recordId)
  })
);

export const supportAccessGrants = pgTable("support_access_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  platformUserId: uuid("platform_user_id").references(() => users.id).notNull(),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps
});

export const academicYears = pgTable(
  "academic_years",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    name: text("name").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: recordStatusEnum("status").default("draft").notNull(),
    promotionRules: jsonb("promotion_rules").$type<Record<string, unknown>>().default({}).notNull()
  },
  (table) => ({
    oneActivePerTenant: uniqueIndex("academic_years_one_active_per_tenant")
      .on(table.tenantId)
      .where(sql`${table.status} = 'active'`)
  })
);

export const terms = pgTable("terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  name: text("name").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull()
});

export const grades = pgTable("grades", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  minAge: integer("min_age"),
  maxAge: integer("max_age"),
  status: recordStatusEnum("status").default("active").notNull()
});

export const teachingSectorGrades = pgTable(
  "teaching_sector_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    sectorId: uuid("sector_id")
      .references(() => teachingSectors.id, { onDelete: "cascade" })
      .notNull(),
    gradeId: uuid("grade_id")
      .references(() => grades.id)
      .notNull()
  },
  (table) => ({
    sectorGradeUnique: uniqueIndex("teaching_sector_grades_sector_grade_unique").on(
      table.tenantId,
      table.sectorId,
      table.gradeId
    )
  })
);

export const sections = pgTable("sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  code: text("code"),
  colorKey: text("color_key"),
  iconKey: text("icon_key"),
  subjectType: text("subject_type").default("required").notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const gradeSubjects = pgTable(
  "grade_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
    gradeId: uuid("grade_id").references(() => grades.id).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id).notNull(),
    weight: numeric("weight", { precision: 8, scale: 2 }).default("1").notNull(),
    isRequired: boolean("is_required").default(true).notNull()
  },
  (table) => ({
    yearGradeSubjectUnique: uniqueIndex("grade_subjects_year_grade_subject_unique").on(
      table.tenantId,
      table.academicYearId,
      table.gradeId,
      table.subjectId
    )
  })
);

export const guardians = pgTable("guardians", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  fullName: text("full_name").notNull(),
  relationshipLabel: text("relationship_label"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  preferredChannel: text("preferred_channel").default("email").notNull()
});

export const familyGroups = pgTable("family_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  primaryGuardianId: uuid("primary_guardian_id").references(() => guardians.id)
});

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  familyGroupId: uuid("family_group_id").references(() => familyGroups.id),
  admissionNumber: text("admission_number").notNull(),
  fullName: text("full_name").notNull(),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  photoFileId: uuid("photo_file_id"),
  address: text("address"),
  township: text("township"),
  identityNumber: text("identity_number"),
  medicalNotes: text("medical_notes"),
  status: studentStatusEnum("status").default("draft").notNull(),
  // Archive lifecycle: orthogonal to `status` so the lifecycle state
  // (enrolled/graduated/…) is preserved and restore returns to it.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by")
});

export const studentGuardians = pgTable("student_guardians", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  studentId: uuid("student_id").references(() => students.id).notNull(),
  guardianId: uuid("guardian_id").references(() => guardians.id).notNull(),
  relationship: text("relationship").notNull(),
  pickupAuthorized: boolean("pickup_authorized").default(false).notNull(),
  emergencyContact: boolean("emergency_contact").default(false).notNull()
});

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").$type<"active" | "inactive">().default("active").notNull()
  },
  (table) => ({
    tenantNameUnique: uniqueIndex("departments_tenant_name_unique").on(table.tenantId, table.name)
  })
);

/** Physical rooms and spaces (buildings, labs, halls) — separate from academic classrooms. */
export const facilityRooms = pgTable(
  "facility_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    name: text("name").notNull(),
    capacity: integer("capacity"),
    note: text("note"),
    status: text("status").$type<"active" | "inactive">().default("active").notNull()
  },
  (table) => ({
    tenantNameUnique: uniqueIndex("facility_rooms_tenant_name_unique").on(table.tenantId, table.name)
  })
);

/** School division for teacher placement (Primary / Middle / High, etc.). */
export const teachingSectors = pgTable(
  "teaching_sectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    status: recordStatusEnum("status").default("active").notNull()
  },
  (table) => ({
    tenantNameUnique: uniqueIndex("teaching_sectors_tenant_name_unique").on(table.tenantId, table.name),
    tenantIdx: index("teaching_sectors_tenant_idx").on(table.tenantId)
  })
);

export type TeacherProfileCapability = {
  sectorIds?: string[];
  competentSubjectIds?: string[];
  eligibleGradeIds?: string[];
};

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  userId: uuid("user_id").references(() => users.id),
  employeeNumber: text("employee_number"),
  fullName: text("full_name").notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  department: text("department"),
  employmentRole: text("employment_role").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  joinDate: date("join_date"),
  salaryBasis: text("salary_basis"),
  promotionTitle: text("promotion_title"),
  qualifications: jsonb("qualifications").$type<Record<string, unknown>[]>().default([]).notNull(),
  teacherProfile: jsonb("teacher_profile")
    .$type<TeacherProfileCapability>()
    .default({})
    .notNull(),
  status: staffStatusEnum("status").default("active").notNull(),
  // Archive lifecycle: orthogonal to `status` so employment state
  // (active/probation/resigned/…) is preserved and restore returns to it.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: uuid("archived_by")
});

export const classrooms = pgTable("classrooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  gradeId: uuid("grade_id").references(() => grades.id).notNull(),
  sectionId: uuid("section_id").references(() => sections.id),
  branchId: uuid("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  capacity: integer("capacity"),
  room: text("room"),
  facilityRoomId: uuid("facility_room_id").references(() => facilityRooms.id),
  classTeacherStaffId: uuid("class_teacher_staff_id").references(() => staff.id),
  status: recordStatusEnum("status").default("active").notNull()
});

export const classroomStudents = pgTable("classroom_students", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  classroomId: uuid("classroom_id").references(() => classrooms.id).notNull(),
  studentId: uuid("student_id").references(() => students.id).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  movementReason: text("movement_reason")
});

export const classroomSubjectTeachers = pgTable(
  "classroom_subject_teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    classroomId: uuid("classroom_id").references(() => classrooms.id).notNull(),
    subjectId: uuid("subject_id").references(() => subjects.id).notNull(),
    teacherStaffId: uuid("teacher_staff_id").references(() => staff.id).notNull()
  },
  (table) => ({
    classroomSubjectUnique: uniqueIndex("classroom_subject_teachers_classroom_subject_unique").on(
      table.tenantId,
      table.classroomId,
      table.subjectId
    )
  })
);

/** Grade-level lead teacher (one per grade per academic year). */
export const gradeChiefAssignments = pgTable(
  "grade_chief_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
    gradeId: uuid("grade_id").references(() => grades.id).notNull(),
    staffId: uuid("staff_id").references(() => staff.id).notNull()
  },
  (table) => ({
    gradeChiefUnique: uniqueIndex("grade_chief_assignments_year_grade_unique").on(
      table.tenantId,
      table.academicYearId,
      table.gradeId
    )
  })
);

export const enquiries = pgTable("enquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  prospectiveStudentName: text("prospective_student_name").notNull(),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  targetGrade: text("target_grade"),
  source: text("source").notNull(),
  status: leadStatusEnum("status").default("new").notNull(),
  followUpDate: date("follow_up_date"),
  assignedStaffId: uuid("assigned_staff_id").references(() => staff.id),
  lostReason: text("lost_reason"),
  notes: text("notes")
});

export const leadActivities = pgTable("lead_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  enquiryId: uuid("enquiry_id").references(() => enquiries.id).notNull(),
  activityType: text("activity_type").notNull(),
  notes: text("notes"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true })
});

/** Draft enrollment billing choices and cached preview metadata. */
export type EnrollmentBillingSnapshot = {
  optionalFeeItemIds?: string[];
  lastPreviewAt?: string;
  preview?: Record<string, unknown>;
};

export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  enquiryId: uuid("enquiry_id").references(() => enquiries.id),
  studentId: uuid("student_id").references(() => students.id).notNull(),
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  gradeId: uuid("grade_id").references(() => grades.id).notNull(),
  classroomId: uuid("classroom_id").references(() => classrooms.id),
  invoiceId: uuid("invoice_id"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"),
  refundMode: text("refund_mode"),
  billingSnapshot: jsonb("billing_snapshot").$type<EnrollmentBillingSnapshot>(),
  status: approvalStatusEnum("status").default("draft").notNull()
});

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  academicYearId: uuid("academic_year_id").references(() => academicYears.id),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  isHoliday: boolean("is_holiday").default(false).notNull(),
  isMakeUpDay: boolean("is_make_up_day").default(false).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull()
});

export const schoolOperatingHourBlocks = pgTable(
  "school_operating_hour_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    label: text("label"),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull()
  },
  (table) => ({
    tenantIdx: index("school_operating_hour_blocks_tenant_idx").on(table.tenantId)
  })
);

export const schoolScheduleSettings = pgTable(
  "school_schedule_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    shortBreakStartsAt: text("short_break_starts_at"),
    shortBreakEndsAt: text("short_break_ends_at"),
    lunchBreakStartsAt: text("lunch_break_starts_at"),
    lunchBreakEndsAt: text("lunch_break_ends_at"),
    periodDurationMinutes: integer("period_duration_minutes").default(45).notNull(),
    workingDays: jsonb("working_days").$type<number[]>().default([1, 2, 3, 4, 5]).notNull()
  },
  (table) => ({
    tenantUnique: uniqueIndex("school_schedule_settings_tenant_unique").on(table.tenantId)
  })
);

export const timetablePeriods = pgTable("timetable_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  operatingHourBlockId: uuid("operating_hour_block_id").references(() => schoolOperatingHourBlocks.id),
  name: text("name").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  periodType: text("period_type").default("lesson").notNull(),
  isBreak: boolean("is_break").default(false).notNull()
});

export const timetableSlots = pgTable("timetable_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  classroomId: uuid("classroom_id").references(() => classrooms.id).notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id).notNull(),
  teacherStaffId: uuid("teacher_staff_id").references(() => staff.id),
  periodId: uuid("period_id").references(() => timetablePeriods.id).notNull(),
  room: text("room"),
  dayOfWeek: integer("day_of_week").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  publishedAt: timestamp("published_at", { withTimezone: true })
});

export const attendanceSessions = pgTable("attendance_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  classroomId: uuid("classroom_id").references(() => classrooms.id).notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id),
  sessionDate: date("session_date").notNull(),
  submittedByStaffId: uuid("submitted_by_staff_id").references(() => staff.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
});

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  attendanceSessionId: uuid("attendance_session_id").references(() => attendanceSessions.id).notNull(),
  studentId: uuid("student_id").references(() => students.id).notNull(),
  status: attendanceStatusEnum("status").notNull(),
  correctionReason: text("correction_reason")
});

export const learningMaterials = pgTable("learning_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  classroomId: uuid("classroom_id").references(() => classrooms.id).notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id).notNull(),
  teacherStaffId: uuid("teacher_staff_id").references(() => staff.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  fileId: uuid("file_id"),
  externalUrl: text("external_url"),
  lessonDate: date("lesson_date")
});

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  classroomId: uuid("classroom_id").references(() => classrooms.id).notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id).notNull(),
  teacherStaffId: uuid("teacher_staff_id").references(() => staff.id).notNull(),
  title: text("title").notNull(),
  instructions: text("instructions"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  scoreEnabled: boolean("score_enabled").default(false).notNull(),
  submissionMode: text("submission_mode").default("teacher_completion").notNull()
});

export const assignmentSubmissions = pgTable("assignment_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  assignmentId: uuid("assignment_id").references(() => assignments.id).notNull(),
  studentId: uuid("student_id").references(() => students.id).notNull(),
  completed: boolean("completed").default(false).notNull(),
  score: numeric("score", { precision: 8, scale: 2 }),
  remarks: text("remarks")
});

export const examCycles = pgTable("exam_cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  name: text("name").notNull(),
  examType: text("exam_type").notNull(),
  status: approvalStatusEnum("status").default("draft").notNull()
});

export const examSchedules = pgTable("exam_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  examCycleId: uuid("exam_cycle_id").references(() => examCycles.id).notNull(),
  classroomId: uuid("classroom_id").references(() => classrooms.id).notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id).notNull(),
  examDate: date("exam_date").notNull(),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  room: text("room"),
  fullMarks: numeric("full_marks", { precision: 8, scale: 2 }).notNull(),
  passMarks: numeric("pass_marks", { precision: 8, scale: 2 }),
  weight: numeric("weight", { precision: 8, scale: 2 }).default("1").notNull()
});

export const assessmentResults = pgTable("assessment_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  examScheduleId: uuid("exam_schedule_id").references(() => examSchedules.id).notNull(),
  studentId: uuid("student_id").references(() => students.id).notNull(),
  marks: numeric("marks", { precision: 8, scale: 2 }),
  resultStatus: text("result_status").default("pending").notNull(),
  teacherRemarks: text("teacher_remarks"),
  status: approvalStatusEnum("status").default("draft").notNull()
});

export const gradeRules = pgTable("grade_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  gradeId: uuid("grade_id").references(() => grades.id),
  subjectId: uuid("subject_id").references(() => subjects.id),
  name: text("name").notNull(),
  rules: jsonb("rules").$type<Record<string, unknown>>().default({}).notNull(),
  rankingEnabled: boolean("ranking_enabled").default(false).notNull()
});

export const reportCards = pgTable("report_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  studentId: uuid("student_id").references(() => students.id).notNull(),
  classroomId: uuid("classroom_id").references(() => classrooms.id).notNull(),
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  termId: uuid("term_id").references(() => terms.id),
  data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
  status: approvalStatusEnum("status").default("draft").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true })
});

export const feeItems = pgTable("fee_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  feeType: text("fee_type").notNull(),
  billingType: text("billing_type").notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const enrollmentFeePlans = pgTable("enrollment_fee_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  academicYearId: uuid("academic_year_id").references(() => academicYears.id).notNull(),
  feeItemId: uuid("fee_item_id").references(() => feeItems.id).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull()
});

export const enrollmentFeePlanGrades = pgTable(
  "enrollment_fee_plan_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    planId: uuid("plan_id")
      .references(() => enrollmentFeePlans.id, { onDelete: "cascade" })
      .notNull(),
    gradeId: uuid("grade_id").references(() => grades.id).notNull()
  },
  (table) => ({
    planGradeUnique: uniqueIndex("enrollment_fee_plan_grades_plan_grade_unique").on(
      table.planId,
      table.gradeId
    )
  })
);

export const studentServices = pgTable("student_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  studentId: uuid("student_id").references(() => students.id).notNull(),
  feeItemId: uuid("fee_item_id").references(() => feeItems.id).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to")
});

export const paymentPlans = pgTable("payment_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  description: text("description"),
  frequency: text("frequency").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const paymentPlanInstallments = pgTable(
  "payment_plan_installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    planId: uuid("plan_id")
      .references(() => paymentPlans.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    dueDate: text("due_date").notNull(),
    installmentCount: integer("installment_count"),
    sortOrder: integer("sort_order").default(0).notNull()
  },
  (table) => ({
    planSortUnique: uniqueIndex("payment_plan_installments_plan_sort_unique").on(
      table.planId,
      table.sortOrder
    )
  })
);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  studentId: uuid("student_id").references(() => students.id).notNull(),
  enrollmentId: uuid("enrollment_id").references(() => enrollments.id),
  familyGroupId: uuid("family_group_id").references(() => familyGroups.id),
  invoiceNumber: text("invoice_number").notNull(),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discountTotal: numeric("discount_total", { precision: 14, scale: 2 }).default("0").notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  status: paymentStatusEnum("status").default("unpaid").notNull(),
  source: invoiceSourceEnum("source").default("ad_hoc").notNull()
});

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  feeItemId: uuid("fee_item_id").references(() => feeItems.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 8, scale: 2 }).default("1").notNull(),
  unitAmount: numeric("unit_amount", { precision: 14, scale: 2 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull()
});

export const discountRules = pgTable("discount_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  discountType: text("discount_type").notNull(),
  valueType: text("value_type").notNull(),
  value: numeric("value", { precision: 14, scale: 2 }).notNull(),
  approvalThreshold: numeric("approval_threshold", { precision: 14, scale: 2 }),
  triggerMode: text("trigger_mode").default("auto").notNull(),
  stackable: boolean("stackable").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  criteria: jsonb("criteria").$type<Record<string, unknown>>().default({}).notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const studentDiscounts = pgTable("student_discounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  studentId: uuid("student_id").references(() => students.id).notNull(),
  discountRuleId: uuid("discount_rule_id").references(() => discountRules.id).notNull(),
  reason: text("reason").notNull(),
  supportingFileId: uuid("supporting_file_id"),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  status: approvalStatusEnum("status").default("draft").notNull()
});

export const invoiceDiscountLines = pgTable(
  "invoice_discount_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    invoiceId: uuid("invoice_id")
      .references(() => invoices.id, { onDelete: "cascade" })
      .notNull(),
    discountRuleId: uuid("discount_rule_id").references(() => discountRules.id),
    studentDiscountId: uuid("student_discount_id").references(() => studentDiscounts.id),
    name: text("name").notNull(),
    discountType: text("discount_type").notNull(),
    source: text("source").notNull(),
    stackable: boolean("stackable").default(false).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    eligibilityReason: text("eligibility_reason")
  },
  (table) => ({
    tenantInvoiceIdx: index("invoice_discount_lines_tenant_invoice_idx").on(
      table.tenantId,
      table.invoiceId
    )
  })
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
  kind: paymentKindEnum("kind").default("payment").notNull(),
  refundedPaymentId: uuid("refunded_payment_id").references((): AnyPgColumn => payments.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  referenceNumber: text("reference_number"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  proofFileId: uuid("proof_file_id"),
  verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  overrideReason: text("override_reason"),
  notes: text("notes")
});

export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  paymentId: uuid("payment_id").references(() => payments.id).notNull(),
  receiptNumber: text("receipt_number").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  pdfFileId: uuid("pdf_file_id")
});

export const salaryComponents = pgTable("salary_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  componentType: text("component_type").notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const salaryRecords = pgTable("salary_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  staffId: uuid("staff_id").references(() => staff.id).notNull(),
  salaryMonth: text("salary_month").notNull(),
  grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull(),
  deductionAmount: numeric("deduction_amount", { precision: 14, scale: 2 }).default("0").notNull(),
  netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull(),
  status: approvalStatusEnum("status").default("draft").notNull(),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  paidAt: timestamp("paid_at", { withTimezone: true })
});

export const payComponents = pgTable(
  "pay_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: payComponentKindEnum("kind").notNull(),
    calculation: payComponentCalculationEnum("calculation").default("fixed").notNull(),
    defaultAmount: numeric("default_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    status: recordStatusEnum("status").default("active").notNull()
  },
  (table) => ({
    tenantCodeUnique: uniqueIndex("pay_components_tenant_code_unique").on(table.tenantId, table.code)
  })
);

export const benefitPackages = pgTable("benefit_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  description: text("description"),
  iconKey: text("icon_key"),
  monthlyValue: numeric("monthly_value", { precision: 14, scale: 2 }).default("0").notNull(),
  eligibilityScope: benefitEligibilityScopeEnum("eligibility_scope").default("all_staff").notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const staffBenefitEnrollments = pgTable(
  "staff_benefit_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    staffId: uuid("staff_id")
      .references(() => staff.id)
      .notNull(),
    packageId: uuid("package_id")
      .references(() => benefitPackages.id)
      .notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to")
  },
  (table) => ({
    tenantStaffPackageUnique: uniqueIndex("staff_benefit_enrollments_tenant_staff_package_unique").on(
      table.tenantId,
      table.staffId,
      table.packageId
    )
  })
);

export const incentivePrograms = pgTable("incentive_programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  description: text("description"),
  cadence: incentiveCadenceEnum("cadence").notNull(),
  awardType: incentiveAwardTypeEnum("award_type").notNull(),
  awardAmount: numeric("award_amount", { precision: 14, scale: 2 }),
  capAmount: numeric("cap_amount", { precision: 14, scale: 2 }),
  termId: uuid("term_id").references(() => terms.id),
  academicYearId: uuid("academic_year_id").references(() => academicYears.id),
  status: recordStatusEnum("status").default("active").notNull()
});

export const staffIncentiveEligibility = pgTable(
  "staff_incentive_eligibility",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    staffId: uuid("staff_id")
      .references(() => staff.id)
      .notNull(),
    programId: uuid("program_id")
      .references(() => incentivePrograms.id)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastAwardedAt: timestamp("last_awarded_at", { withTimezone: true })
  },
  (table) => ({
    tenantStaffProgramUnique: uniqueIndex("staff_incentive_eligibility_tenant_staff_program_unique").on(
      table.tenantId,
      table.staffId,
      table.programId
    )
  })
);

export const staffCompensationProfiles = pgTable(
  "staff_compensation_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    staffId: uuid("staff_id")
      .references(() => staff.id)
      .notNull(),
    baseSalary: numeric("base_salary", { precision: 14, scale: 2 }).default("0").notNull(),
    currency: text("currency").default("MMK").notNull()
  },
  (table) => ({
    tenantStaffUnique: uniqueIndex("staff_compensation_profiles_tenant_staff_unique").on(
      table.tenantId,
      table.staffId
    )
  })
);

export const staffCompensationComponents = pgTable(
  "staff_compensation_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    profileId: uuid("profile_id")
      .references(() => staffCompensationProfiles.id, { onDelete: "cascade" })
      .notNull(),
    componentId: uuid("component_id")
      .references(() => payComponents.id)
      .notNull(),
    amountOverride: numeric("amount_override", { precision: 14, scale: 2 })
  },
  (table) => ({
    profileComponentUnique: uniqueIndex("staff_compensation_components_profile_component_unique").on(
      table.profileId,
      table.componentId
    )
  })
);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    status: payrollRunStatusEnum("status").default("draft").notNull(),
    totalNet: numeric("total_net", { precision: 14, scale: 2 }).default("0").notNull(),
    totalPaid: numeric("total_paid", { precision: 14, scale: 2 }).default("0").notNull(),
    totalPending: numeric("total_pending", { precision: 14, scale: 2 }).default("0").notNull(),
    totalBonuses: numeric("total_bonuses", { precision: 14, scale: 2 }).default("0").notNull()
  },
  (table) => ({
    tenantPeriodUnique: uniqueIndex("payroll_runs_tenant_period_unique").on(
      table.tenantId,
      table.periodYear,
      table.periodMonth
    )
  })
);

export const payrollRecords = pgTable(
  "payroll_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantFields,
    runId: uuid("run_id")
      .references(() => payrollRuns.id, { onDelete: "cascade" })
      .notNull(),
    staffId: uuid("staff_id")
      .references(() => staff.id)
      .notNull(),
    departmentName: text("department_name"),
    baseAmount: numeric("base_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    allowancesAmount: numeric("allowances_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    bonusesAmount: numeric("bonuses_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    deductionsAmount: numeric("deductions_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    status: payrollRecordStatusEnum("status").default("draft").notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: text("payment_method"),
    paymentRef: text("payment_ref"),
    payslipStorageKey: text("payslip_storage_key"),
    payslipGeneratedAt: timestamp("payslip_generated_at", { withTimezone: true })
  },
  (table) => ({
    tenantRunStaffUnique: uniqueIndex("payroll_records_tenant_run_staff_unique").on(
      table.tenantId,
      table.runId,
      table.staffId
    )
  })
);

export const payrollLineItems = pgTable("payroll_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  recordId: uuid("record_id")
    .references(() => payrollRecords.id, { onDelete: "cascade" })
    .notNull(),
  sourceType: payrollLineSourceTypeEnum("source_type").notNull(),
  sourceId: uuid("source_id"),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull()
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  key: text("key").notNull(),
  language: languageEnum("language").default("en").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const notificationJobs = pgTable("notification_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  jobType: text("job_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  status: text("status").default("queued").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true })
});

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  notificationJobId: uuid("notification_job_id").references(() => notificationJobs.id),
  recipient: text("recipient").notNull(),
  channel: text("channel").default("email").notNull(),
  status: text("status").notNull(),
  providerMessageId: text("provider_message_id"),
  error: text("error")
});

export const documentRequirements = pgTable("document_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  name: text("name").notNull(),
  appliesTo: text("applies_to").default("student").notNull(),
  required: boolean("required").default(false).notNull(),
  expires: boolean("expires").default(false).notNull(),
  status: recordStatusEnum("status").default("active").notNull()
});

export const studentDocuments = pgTable("student_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ...tenantFields,
  studentId: uuid("student_id").references(() => students.id).notNull(),
  documentRequirementId: uuid("document_requirement_id").references(() => documentRequirements.id),
  fileId: uuid("file_id").notNull(),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  expiresOn: date("expires_on"),
  verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true })
});
