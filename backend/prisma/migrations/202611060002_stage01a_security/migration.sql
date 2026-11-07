-- Stage 01A grants and catalog. Provision DB roles out-of-band before applying.
-- app_runtime is the tenant-only role already provisioned by stage 01.
-- identity_reader: login, NOINHERIT/NOBYPASSRLS, SELECT on global identity directory.
-- platform_operator: login, NOINHERIT/NOBYPASSRLS; privileged app role subject to operator allowlist in backend.
GRANT USAGE ON SCHEMA public TO identity_reader, platform_operator;
GRANT SELECT ON tenants,platform_users TO identity_reader;
GRANT SELECT,INSERT,UPDATE ON tenants,platform_users TO platform_operator;
GRANT SELECT ON permissions TO platform_operator;
GRANT SELECT,INSERT ON roles,role_permissions,tenant_memberships,membership_roles,audit_logs TO platform_operator;
GRANT USAGE ON SCHEMA app_private TO platform_operator;
GRANT EXECUTE ON FUNCTION app_private.current_tenant_id() TO platform_operator;
REVOKE CREATE ON SCHEMA public FROM identity_reader,platform_operator;
-- Global permissions catalog seeded by privileged migrator, NOT by application runtime.
INSERT INTO permissions(code,resource,action) VALUES
 ('tenant.read','tenant','read'),('tenant.manage','tenant','manage'),
 ('org.branch.read','org.branch','read'),('org.branch.manage','org.branch','manage'),
 ('org.membership.read','org.membership','read'),('org.membership.manage','org.membership','manage'),
 ('iam.role.read','iam.role','read'),('iam.role.manage','iam.role','manage'),
 ('iam.permission.read','iam.permission','read'),('iam.permission.assign','iam.permission','assign'),
 ('audit.read','audit','read')
ON CONFLICT(code) DO NOTHING;
-- Ensure platform operator RLS remains on; only tenant-scoped context can access tenant data.
