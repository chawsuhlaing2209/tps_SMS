ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "created_by" uuid;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
