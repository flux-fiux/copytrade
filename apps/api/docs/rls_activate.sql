-- ============================================================================
-- RLS ACTIVATION (privileged, run once by a DB owner / admin)
-- ----------------------------------------------------------------------------
-- Prereq: alembic migration 20260625_0600_tenant_rls is applied (RLS enabled +
-- policies created). This script creates the dedicated NON-BYPASSRLS role the
-- API connects as, grants it CRUD, and FORCEs RLS. Until this runs and the API
-- DATABASE_URL points at app_tenant with RLS_ENABLED=true, isolation is NOT yet
-- enforced (postgres/service_role bypass RLS by design).
--
-- Run with:  psql "$ADMIN_DATABASE_URL" -f docs/rls_activate.sql
-- Replace REPLACE_WITH_STRONG_PASSWORD before running.
-- ============================================================================

-- 1) Dedicated application role (subject to RLS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD' NOBYPASSRLS;
  END IF;
END$$;

-- 2) Fail-closed default: unscoped connections resolve to the nil tenant -> 0 rows.
ALTER ROLE app_tenant SET app.current_tenant = '00000000-0000-0000-0000-000000000000';

-- 3) Privileges (CRUD on existing + future tables/sequences).
GRANT USAGE ON SCHEMA public TO app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tenant;

-- 4) FORCE RLS so the policy applies even to a table owner (defense in depth).
--    ohlcv (global market data) is intentionally left without RLS.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','mt4_accounts','signals','trade_history','signal_subscriptions',
    'copy_trades','leaderboard_scores','subscription_plans','payments','notifications','tenants'
  ] LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END$$;

-- 5) After this: set the API's DATABASE_URL to the app_tenant role and
--    RLS_ENABLED=true. Keep background workers (Celery) on the postgres/
--    service_role connection — they run cross-tenant with explicit tenant_id
--    filters and must bypass RLS.
