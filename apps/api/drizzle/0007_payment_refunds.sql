DO $$ BEGIN
 CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'refund');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "kind" "payment_kind" DEFAULT 'payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_payment_id_payments_id_fk" FOREIGN KEY ("refunded_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
UPDATE "payments" SET "paid_at" = COALESCE("verified_at", "created_at") WHERE "paid_at" IS NULL;
