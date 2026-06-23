CREATE TYPE "public"."pay_component_kind" AS ENUM('earning', 'deduction');
--> statement-breakpoint
CREATE TYPE "public"."pay_component_calculation" AS ENUM('fixed', 'percent_of_basic');
--> statement-breakpoint
CREATE TYPE "public"."benefit_eligibility_scope" AS ENUM('all_staff', 'teachers', 'non_teaching');
--> statement-breakpoint
CREATE TYPE "public"."incentive_cadence" AS ENUM('per_payroll', 'term', 'annual', 'one_time');
--> statement-breakpoint
CREATE TYPE "public"."incentive_award_type" AS ENUM('fixed', 'percent_of_basic', 'manual');
--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'processing', 'approved', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."payroll_record_status" AS ENUM('draft', 'pending', 'paid');
--> statement-breakpoint
CREATE TYPE "public"."payroll_line_source_type" AS ENUM('component', 'package', 'incentive', 'deduction', 'adjustment');
--> statement-breakpoint
CREATE TABLE "pay_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" "pay_component_kind" NOT NULL,
	"calculation" "pay_component_calculation" DEFAULT 'fixed' NOT NULL,
	"default_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "record_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefit_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_key" text,
	"monthly_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"eligibility_scope" "benefit_eligibility_scope" DEFAULT 'all_staff' NOT NULL,
	"status" "record_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_benefit_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staff_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date
);
--> statement-breakpoint
CREATE TABLE "incentive_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cadence" "incentive_cadence" NOT NULL,
	"award_type" "incentive_award_type" NOT NULL,
	"award_amount" numeric(14, 2),
	"cap_amount" numeric(14, 2),
	"term_id" uuid,
	"academic_year_id" uuid,
	"status" "record_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_incentive_eligibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staff_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_awarded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff_compensation_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staff_id" uuid NOT NULL,
	"base_salary" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'MMK' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_compensation_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"amount_override" numeric(14, 2)
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"total_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_pending" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_bonuses" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"department_name" text,
	"base_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"allowances_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"bonuses_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"deductions_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "payroll_record_status" DEFAULT 'draft' NOT NULL,
	"approved_by_user_id" uuid,
	"paid_at" timestamp with time zone,
	"payment_method" text,
	"payment_ref" text,
	"payslip_storage_key" text,
	"payslip_generated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payroll_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_id" uuid NOT NULL,
	"source_type" "payroll_line_source_type" NOT NULL,
	"source_id" uuid,
	"label" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_benefit_enrollments" ADD CONSTRAINT "staff_benefit_enrollments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_benefit_enrollments" ADD CONSTRAINT "staff_benefit_enrollments_package_id_benefit_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."benefit_packages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incentive_programs" ADD CONSTRAINT "incentive_programs_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "incentive_programs" ADD CONSTRAINT "incentive_programs_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_incentive_eligibility" ADD CONSTRAINT "staff_incentive_eligibility_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_incentive_eligibility" ADD CONSTRAINT "staff_incentive_eligibility_program_id_incentive_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."incentive_programs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_compensation_profiles" ADD CONSTRAINT "staff_compensation_profiles_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_compensation_components" ADD CONSTRAINT "staff_compensation_components_profile_id_staff_compensation_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."staff_compensation_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_compensation_components" ADD CONSTRAINT "staff_compensation_components_component_id_pay_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."pay_components"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_record_id_payroll_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."payroll_records"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "pay_components_tenant_code_unique" ON "pay_components" ("tenant_id", "code");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_benefit_enrollments_tenant_staff_package_unique" ON "staff_benefit_enrollments" ("tenant_id", "staff_id", "package_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_incentive_eligibility_tenant_staff_program_unique" ON "staff_incentive_eligibility" ("tenant_id", "staff_id", "program_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_compensation_profiles_tenant_staff_unique" ON "staff_compensation_profiles" ("tenant_id", "staff_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_compensation_components_profile_component_unique" ON "staff_compensation_components" ("profile_id", "component_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_tenant_period_unique" ON "payroll_runs" ("tenant_id", "period_year", "period_month");
--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_records_tenant_run_staff_unique" ON "payroll_records" ("tenant_id", "run_id", "staff_id");
--> statement-breakpoint
INSERT INTO "pay_components" (
	"id", "tenant_id", "created_by", "updated_by", "created_at", "updated_at",
	"code", "name", "kind", "calculation", "default_amount", "status"
)
SELECT
	sc.id,
	sc.tenant_id,
	sc.created_by,
	sc.updated_by,
	sc.created_at,
	sc.updated_at,
	lower(replace(regexp_replace(sc.name, '[^a-zA-Z0-9 ]', '', 'g'), ' ', '_')) || '_' || left(sc.id::text, 8),
	sc.name,
	CASE
		WHEN sc.component_type = 'deduction' THEN 'deduction'::"pay_component_kind"
		ELSE 'earning'::"pay_component_kind"
	END,
	'fixed'::"pay_component_calculation",
	'0'::numeric,
	sc.status
FROM "salary_components" sc
ON CONFLICT DO NOTHING;
