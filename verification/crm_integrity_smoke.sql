-- Owner-role constraint tests, independent of API validation/RLS. Synthetic writes roll back.
BEGIN;
DO $$
DECLARE
 t uuid := '11111111-1111-4111-8111-111111111111';
 other_t uuid := '22222222-2222-4222-8222-222222222222';
 p uuid; b uuid; actor uuid; l uuid; source uuid; other_source uuid; campaign uuid;
 blocked boolean;
BEGIN
 IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'crm\_%' ESCAPE '\'
  AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity))
 THEN RAISE EXCEPTION 'CRM table missing RLS/FORCE RLS'; END IF;
 SELECT id,branch_id,source_id INTO l,b,source FROM crm_leads WHERE tenant_id=t LIMIT 1;
 SELECT user_id INTO actor FROM tenant_memberships WHERE tenant_id=t LIMIT 1;
 IF l IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Demo fixtures missing'; END IF;
 INSERT INTO crm_persons(tenant_id,full_name,normalized_name)
 VALUES(t,'Synthetic rollback constraint fixture','synthetic rollback constraint fixture') RETURNING id INTO p;
 blocked:=false;
 BEGIN
  INSERT INTO crm_person_contacts(tenant_id,person_id,kind,raw_value,normalized_value)
  VALUES(other_t,p,'EMAIL','synthetic@example.test','synthetic@example.test');
 EXCEPTION WHEN foreign_key_violation THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'CRM composite FK accepted foreign-tenant person'; END IF;
 blocked:=false;
 BEGIN
  INSERT INTO crm_checkins(tenant_id,person_id,lead_id,branch_id,source_id,received_by_user_id)
  VALUES(t,p,l,b,source,actor);
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'checkin lead does not match person and branch' THEN RAISE; END IF;
  blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'CRM check-in trigger accepted wrong Person'; END IF;
 INSERT INTO crm_marketing_sources(tenant_id,code,name,category)
 VALUES(t,'ROLLBACK_'||gen_random_uuid(),'Synthetic rollback source','EVENT') RETURNING id INTO other_source;
 INSERT INTO crm_campaigns(tenant_id,code,name,source_id)
 VALUES(t,'ROLLBACK_'||gen_random_uuid(),'Synthetic rollback campaign',source) RETURNING id INTO campaign;
 blocked:=false;
 BEGIN
  INSERT INTO crm_leads(tenant_id,person_id,branch_id,source_id,campaign_id)
  VALUES(t,p,b,other_source,campaign);
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Lead source does not match campaign source' THEN RAISE; END IF;
  blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Campaign trigger accepted inconsistent source'; END IF;
END $$;
ROLLBACK;
