ALTER TABLE "staff" ADD COLUMN "promotion_title" text;

CREATE TABLE "teaching_sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "teaching_sector_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sector_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "teaching_sectors" ADD CONSTRAINT "teaching_sectors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "teaching_sector_grades" ADD CONSTRAINT "teaching_sector_grades_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "teaching_sector_grades" ADD CONSTRAINT "teaching_sector_grades_sector_id_teaching_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."teaching_sectors"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teaching_sector_grades" ADD CONSTRAINT "teaching_sector_grades_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "teaching_sectors_tenant_name_unique" ON "teaching_sectors" USING btree ("tenant_id","name");
CREATE UNIQUE INDEX "teaching_sector_grades_sector_grade_unique" ON "teaching_sector_grades" USING btree ("tenant_id","sector_id","grade_id");
CREATE INDEX "teaching_sectors_tenant_idx" ON "teaching_sectors" USING btree ("tenant_id");
