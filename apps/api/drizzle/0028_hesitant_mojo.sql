ALTER TABLE "students" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "archived_by" uuid;