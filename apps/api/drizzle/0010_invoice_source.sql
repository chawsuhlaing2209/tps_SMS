CREATE TYPE "public"."invoice_source" AS ENUM('enrollment', 'recurring', 'ad_hoc');
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source" "invoice_source" DEFAULT 'ad_hoc' NOT NULL;
--> statement-breakpoint
UPDATE "invoices"
SET "source" = 'enrollment'
WHERE "enrollment_id" IS NOT NULL;
