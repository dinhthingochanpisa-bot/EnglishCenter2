-- Run with app_runtime against disposable Stage 02 demo database.
-- Requires crm demo seed first and app_runtime role to be authenticated.
BEGIN;
SELECT set_config('app.tenant_id','11111111-1111-4111-8111-111111111111',true);
DO $$ DECLARE own int; other int; blocked boolean:=false; BEGIN
 SELECT count(*) INTO own FROM crm_persons WHERE tenant_id='11111111-1111-4111-8111-111111111111';
 SELECT count(*) INTO other FROM crm_persons WHERE tenant_id='22222222-2222-4222-8222-222222222222';
 IF own<1 THEN RAISE EXCEPTION 'Tenant A seed missing'; END IF;
 IF other<>0 THEN RAISE EXCEPTION 'Tenant B person leaked into Tenant A context'; END IF;
 BEGIN
  INSERT INTO crm_persons(tenant_id,full_name,normalized_name)
   VALUES('22222222-2222-4222-8222-222222222222','CrossTenant','crosstenant');
 EXCEPTION WHEN insufficient_privilege OR check_violation THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-tenant write was not rejected'; END IF;
END $$;
ROLLBACK;
BEGIN;
-- Missing tenant context must not return any customer data.
DO $$ BEGIN
 IF (SELECT count(*) FROM crm_persons)<>0 THEN RAISE EXCEPTION 'Unset RLS context should return zero rows'; END IF;
END $$;
ROLLBACK;
