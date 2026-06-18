CREATE TABLE "enrollment_fee_plan_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"plan_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollment_fee_plan_grades" ADD CONSTRAINT "enrollment_fee_plan_grades_plan_id_enrollment_fee_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."enrollment_fee_plans"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "enrollment_fee_plan_grades" ADD CONSTRAINT "enrollment_fee_plan_grades_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "enrollment_fee_plan_grades" ("tenant_id", "created_at", "updated_at", "created_by", "updated_by", "plan_id", "grade_id")
SELECT "tenant_id", "created_at", "updated_at", "created_by", "updated_by", "id", "grade_id"
FROM "enrollment_fee_plans";
--> statement-breakpoint
WITH "keepers" AS (
	SELECT
		"tenant_id",
		"academic_year_id",
		"fee_item_id",
		"amount",
		(MIN("id"::text))::uuid AS "keep_id"
	FROM "enrollment_fee_plans"
	GROUP BY "tenant_id", "academic_year_id", "fee_item_id", "amount"
),
"dupes" AS (
	SELECT "p"."id" AS "drop_id", "k"."keep_id"
	FROM "enrollment_fee_plans" AS "p"
	INNER JOIN "keepers" AS "k"
		ON "k"."tenant_id" = "p"."tenant_id"
		AND "k"."academic_year_id" = "p"."academic_year_id"
		AND "k"."fee_item_id" = "p"."fee_item_id"
		AND "k"."amount" = "p"."amount"
	WHERE "p"."id" <> "k"."keep_id"
)
UPDATE "enrollment_fee_plan_grades" AS "g"
SET "plan_id" = "d"."keep_id"
FROM "dupes" AS "d"
WHERE "g"."plan_id" = "d"."drop_id";
--> statement-breakpoint
DELETE FROM "enrollment_fee_plan_grades" AS "a"
USING "enrollment_fee_plan_grades" AS "b"
WHERE "a"."id" > "b"."id"
	AND "a"."plan_id" = "b"."plan_id"
	AND "a"."grade_id" = "b"."grade_id";
--> statement-breakpoint
WITH "keepers" AS (
	SELECT
		"tenant_id",
		"academic_year_id",
		"fee_item_id",
		"amount",
		(MIN("id"::text))::uuid AS "keep_id"
	FROM "enrollment_fee_plans"
	GROUP BY "tenant_id", "academic_year_id", "fee_item_id", "amount"
),
"dupes" AS (
	SELECT "p"."id" AS "drop_id"
	FROM "enrollment_fee_plans" AS "p"
	INNER JOIN "keepers" AS "k"
		ON "k"."tenant_id" = "p"."tenant_id"
		AND "k"."academic_year_id" = "p"."academic_year_id"
		AND "k"."fee_item_id" = "p"."fee_item_id"
		AND "k"."amount" = "p"."amount"
	WHERE "p"."id" <> "k"."keep_id"
)
DELETE FROM "enrollment_fee_plans" AS "p"
USING "dupes" AS "d"
WHERE "p"."id" = "d"."drop_id";
--> statement-breakpoint
DROP INDEX IF EXISTS "enrollment_fee_plans_year_grade_fee_item_unique";
--> statement-breakpoint
ALTER TABLE "enrollment_fee_plans" DROP COLUMN "grade_id";
--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_fee_plan_grades_plan_grade_unique" ON "enrollment_fee_plan_grades" USING btree ("plan_id","grade_id");
