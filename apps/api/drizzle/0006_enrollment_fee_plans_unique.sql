DELETE FROM "enrollment_fee_plans" AS a
USING "enrollment_fee_plans" AS b
WHERE a.id > b.id
  AND a.tenant_id = b.tenant_id
  AND a.academic_year_id = b.academic_year_id
  AND a.grade_id = b.grade_id
  AND a.fee_item_id = b.fee_item_id;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enrollment_fee_plans_year_grade_fee_item_unique" ON "enrollment_fee_plans" USING btree ("tenant_id","academic_year_id","grade_id","fee_item_id");
