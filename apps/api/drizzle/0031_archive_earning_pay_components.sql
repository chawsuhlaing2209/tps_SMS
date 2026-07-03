-- MVP-1: pay components become deductions-only. Archive existing earning-type
-- components (payroll history and compensation profiles keep referencing them).
UPDATE "pay_components" SET "status" = 'archived' WHERE "kind" = 'earning' AND "status" <> 'archived';
