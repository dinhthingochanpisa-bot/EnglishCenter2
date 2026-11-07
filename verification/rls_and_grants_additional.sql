-- Run as app_runtime, after migrations 001-003 and synthetic seed, with ON_ERROR_STOP=1.
-- Explicitly verifies global identity tables are inaccessible to tenant runtime.
BEGIN;
DO $$BEGIN
  BEGIN
    PERFORM id FROM platform_users LIMIT 1;
    RAISE EXCEPTION 'SECURITY FAIL: app_runtime can SELECT global platform_users';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM id FROM tenants LIMIT 1;
    RAISE EXCEPTION 'SECURITY FAIL: app_runtime can SELECT global tenants';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END$$;
ROLLBACK;
-- Audits may be inserted with matching context but not changed/deleted by runtime.
BEGIN;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$BEGIN
  BEGIN
    UPDATE audit_logs SET action='tampered' WHERE false;
    RAISE EXCEPTION 'SECURITY FAIL: app_runtime can UPDATE audit_logs';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM audit_logs WHERE false;
    RAISE EXCEPTION 'SECURITY FAIL: app_runtime can DELETE audit_logs';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END$$;
ROLLBACK;
-- A valid tenant context MUST NOT let a user join a foreign tenant branch.
BEGIN;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$BEGIN
  IF EXISTS (SELECT 1 FROM branches WHERE tenant_id='22222222-2222-4222-8222-222222222222')
  THEN RAISE EXCEPTION 'SECURITY FAIL: tenant B rows leak under A context'; END IF;
END$$;
ROLLBACK;
