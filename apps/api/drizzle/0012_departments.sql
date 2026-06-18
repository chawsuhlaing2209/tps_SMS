CREATE TABLE IF NOT EXISTS "departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "departments_tenant_name_unique" ON "departments" ("tenant_id", "name");

ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "department_id" uuid REFERENCES "departments"("id");
