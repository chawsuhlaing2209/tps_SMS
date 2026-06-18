ALTER TABLE "discount_rules" ADD COLUMN IF NOT EXISTS "criteria" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "billing_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "enrollment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
