CREATE TABLE "invoice_discount_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "discount_rule_id" uuid,
  "student_discount_id" uuid,
  "name" text NOT NULL,
  "discount_type" text NOT NULL,
  "source" text NOT NULL,
  "stackable" boolean DEFAULT false NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "eligibility_reason" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "invoice_discount_lines" ADD CONSTRAINT "invoice_discount_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "invoice_discount_lines" ADD CONSTRAINT "invoice_discount_lines_discount_rule_id_discount_rules_id_fk" FOREIGN KEY ("discount_rule_id") REFERENCES "public"."discount_rules"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "invoice_discount_lines" ADD CONSTRAINT "invoice_discount_lines_student_discount_id_student_discounts_id_fk" FOREIGN KEY ("student_discount_id") REFERENCES "public"."student_discounts"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "invoice_discount_lines_tenant_invoice_idx" ON "invoice_discount_lines" USING btree ("tenant_id","invoice_id");
