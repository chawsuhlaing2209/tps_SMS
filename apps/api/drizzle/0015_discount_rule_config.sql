-- Structured discount rule configuration
ALTER TABLE "discount_rules" ADD COLUMN "trigger_mode" text DEFAULT 'auto' NOT NULL;
ALTER TABLE "discount_rules" ADD COLUMN "stackable" boolean DEFAULT false NOT NULL;
ALTER TABLE "discount_rules" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;

UPDATE "discount_rules"
SET "trigger_mode" = 'auto'
WHERE "discount_type" IN ('sibling', 'early_payment');

UPDATE "discount_rules"
SET "trigger_mode" = 'request'
WHERE "discount_type" IN ('scholarship', 'staff', 'staff_child');

UPDATE "discount_rules"
SET "stackable" = true
WHERE "discount_type" IN ('sibling', 'early_payment');
