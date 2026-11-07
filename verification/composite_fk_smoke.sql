-- Execute with migrator/test owner role; transaction is rolled back.
-- Directly tests composite FK even when RLS is bypassed by migration role.
BEGIN;
DO $$
DECLARE mid uuid; other_branch uuid;
BEGIN
 SELECT id INTO mid FROM tenant_memberships WHERE tenant_id='11111111-1111-4111-8111-111111111111' LIMIT 1;
 SELECT id INTO other_branch FROM branches WHERE tenant_id='22222222-2222-4222-8222-222222222222' LIMIT 1;
 BEGIN
  INSERT INTO membership_branch_scopes(tenant_id,membership_id,branch_id,valid_from)
  VALUES('11111111-1111-4111-8111-111111111111',mid,other_branch,now());
  RAISE EXCEPTION 'COMPOSITE FK FAILURE: cross tenant branch linked';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $$;
ROLLBACK;
