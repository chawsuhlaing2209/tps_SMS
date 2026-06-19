CREATE TABLE IF NOT EXISTS "school_operating_hour_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "label" text,
  "starts_at" text NOT NULL,
  "ends_at" text NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "school_operating_hour_blocks_tenant_idx"
  ON "school_operating_hour_blocks" ("tenant_id");

CREATE TABLE IF NOT EXISTS "school_schedule_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "short_break_starts_at" text,
  "short_break_ends_at" text,
  "lunch_break_starts_at" text,
  "lunch_break_ends_at" text,
  "period_duration_minutes" integer DEFAULT 45 NOT NULL,
  "working_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_schedule_settings_tenant_unique"
  ON "school_schedule_settings" ("tenant_id");

ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "operating_hour_block_id" uuid;
ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "period_type" text DEFAULT 'lesson' NOT NULL;
ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "is_break" boolean DEFAULT false NOT NULL;

DO $$ BEGIN
  ALTER TABLE "timetable_periods"
    ADD CONSTRAINT "timetable_periods_operating_hour_block_id_fkey"
    FOREIGN KEY ("operating_hour_block_id")
    REFERENCES "school_operating_hour_blocks"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
