ALTER TABLE "staff" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "archived_by" uuid;