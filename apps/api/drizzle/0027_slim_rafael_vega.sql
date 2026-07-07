-- Enrollment cancellation / withdrawal tracking.
-- NOTE: drizzle-kit generated a large catch-up diff here because the migration
-- snapshot had drifted behind the live schema (tables like payroll_records and
-- invoice_discount_lines already exist in the database). Re-running those CREATE
-- statements would fail, so this migration is trimmed to only the genuinely new
-- columns; the regenerated snapshot (meta/0027_snapshot.json) now reflects the
-- true current schema, reconciling future `db:generate` runs.
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "refund_mode" text;
