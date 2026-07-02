-- Grant the new leave.manage permission to existing tenant roles that manage HR.
UPDATE "roles"
SET "permissions" = "permissions" || '["leave.manage"]'::jsonb
WHERE "key" IN ('school_owner', 'principal', 'hr_staff')
  AND NOT "permissions" @> '["leave.manage"]'::jsonb;
