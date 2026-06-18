WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY starts_on DESC, created_at DESC) AS rn
  FROM "academic_years"
  WHERE "status" = 'active'
)
UPDATE "academic_years" AS ay
SET "status" = 'archived', "updated_at" = NOW()
FROM ranked AS r
WHERE ay.id = r.id AND r.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_one_active_per_tenant" ON "academic_years" USING btree ("tenant_id") WHERE "status" = 'active';
