CREATE TABLE IF NOT EXISTS "payment_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "frequency" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "record_status" DEFAULT 'active' NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_plan_installments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "plan_id" uuid NOT NULL,
  "label" text NOT NULL,
  "due_date" text NOT NULL,
  "installment_count" integer,
  "sort_order" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payment_plan_installments" ADD CONSTRAINT "payment_plan_installments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payment_plan_installments" ADD CONSTRAINT "payment_plan_installments_plan_id_payment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_plan_installments_plan_sort_unique" ON "payment_plan_installments" USING btree ("plan_id","sort_order");
