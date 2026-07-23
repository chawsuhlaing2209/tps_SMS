-- RLS backstop (DEPLOYMENT.md invariant I4).
-- Creates the least-privilege application role (sms_app) and enables
-- row-level security with per-tenant policies on every tenant-owned table.
-- The migration/owner role keeps bypassing RLS (no FORCE), so migrations,
-- seeds, and backups are unaffected.
--
-- Excluded from RLS (identity plumbing queried before any tenant context
-- exists; still protected by application-layer scoping and guards):
--   users, sessions, account_activation_tokens, password_reset_tokens,
--   roles (nullable tenant_id: global role templates), tenant_settings
--   (pre-auth branding for login pages and system emails).
--
-- Dev password is 'sms_app'. Staging/production MUST override it right after
-- migrating:  ALTER ROLE sms_app WITH PASSWORD '<strong secret>';
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sms_app') THEN
    CREATE ROLE sms_app LOGIN PASSWORD 'sms_app';
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO sms_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sms_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sms_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sms_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sms_app;
--> statement-breakpoint
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND tb.table_type = 'BASE TABLE'
      AND c.table_name NOT IN (
        'users',
        'sessions',
        'account_activation_tokens',
        'password_reset_tokens',
        'roles',
        'tenant_settings'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.table_name);

    IF NOT EXISTS (
      SELECT FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.table_name
        AND policyname = 'tenant_isolation'
    ) THEN
      -- text comparison: never errors on empty/absent settings; the planner
      -- still uses the app's own tenant_id = $1 predicate for index access.
      EXECUTE format(
        $p$CREATE POLICY tenant_isolation ON public.%I
           FOR ALL
           USING (tenant_id::text = current_setting('app.tenant_id', true))
           WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true))$p$,
        t.table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t.table_name
        AND policyname = 'platform_bypass'
    ) THEN
      EXECUTE format(
        $p$CREATE POLICY platform_bypass ON public.%I
           FOR ALL
           USING (current_setting('app.bypass_rls', true) = 'on')
           WITH CHECK (current_setting('app.bypass_rls', true) = 'on')$p$,
        t.table_name
      );
    END IF;
  END LOOP;
END $$;
