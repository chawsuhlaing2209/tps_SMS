ALTER TABLE "tenant_settings" ADD COLUMN "school_type" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "motto" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "principal_name" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "registration_number" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "established_year" integer;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "logo_mime_type" text;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "date_format" text DEFAULT 'DD/MM/YYYY' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "time_format" text DEFAULT '12h' NOT NULL;