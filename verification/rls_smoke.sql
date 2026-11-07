-- Execute as app_runtime with GRANTs; use psql -v ON_ERROR_STOP=1.
-- Requires demo seed executed via migrator. Expected A sees A branch, never B.
BEGIN;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM branches) <> 1 THEN RAISE EXCEPTION 'RLS failed: expected 1 branch in tenant A'; END IF;
 IF EXISTS (SELECT 1 FROM branches WHERE tenant_id='22222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'tenant B leaked to A'; END IF;
END $$;
ROLLBACK;
BEGIN;
SELECT set_config('app.tenant_id','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM branches) <> 1 THEN RAISE EXCEPTION 'RLS failed: expected 1 branch in tenant B'; END IF;
END $$;
ROLLBACK;
-- No tenant context in a fresh transaction must expose zero rows.
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM branches) THEN RAISE EXCEPTION 'Missing context leaked branches'; END IF;
END $$;
ROLLBACK;
-- WRITE guard must reject cross-tenant insert.
BEGIN;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 BEGIN
  INSERT INTO branches(tenant_id,code,name) VALUES ('22222222-2222-4222-8222-222222222222','ILLEGAL','Cross-tenant');
  RAISE EXCEPTION 'RLS WRITE FAILURE: cross tenant insert succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
ROLLBACK;
