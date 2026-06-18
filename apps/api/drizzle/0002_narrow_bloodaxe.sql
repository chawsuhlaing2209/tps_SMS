CREATE TABLE "grade_chief_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grade_chief_assignments" ADD CONSTRAINT "grade_chief_assignments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_chief_assignments" ADD CONSTRAINT "grade_chief_assignments_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_chief_assignments" ADD CONSTRAINT "grade_chief_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grade_chief_assignments_year_grade_unique" ON "grade_chief_assignments" USING btree ("tenant_id","academic_year_id","grade_id");--> statement-breakpoint
DELETE FROM "classroom_subject_teachers" AS newer
USING "classroom_subject_teachers" AS older
WHERE newer.tenant_id = older.tenant_id
  AND newer.classroom_id = older.classroom_id
  AND newer.subject_id = older.subject_id
  AND newer.created_at > older.created_at;--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_subject_teachers_classroom_subject_unique" ON "classroom_subject_teachers" USING btree ("tenant_id","classroom_id","subject_id");