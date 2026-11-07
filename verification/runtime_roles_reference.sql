-- Run once via DBA / infra provisioning, with a privileged role (NOT Prisma migration runtime).
-- Replace demo passwords by secret-manager credentials. Do not embed real credentials in repo.
-- CREATE ROLE app_runtime LOGIN PASSWORD 'set-via-secret-manager' NOBYPASSRLS;
-- CREATE ROLE app_migrator LOGIN PASSWORD 'set-via-secret-manager' NOBYPASSRLS;
-- Database owner/migrator creates schema. Runtime must NOT own tables.
-- The following grants are templates executed after provisioning role app_runtime.
GRANT USAGE ON SCHEMA public, app_private TO app_runtime;
GRANT EXECUTE ON FUNCTION app_private.current_tenant_id() TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON
 branches,tenant_memberships,roles,role_permissions,membership_roles,
 membership_branch_scopes,tenant_settings,tenant_subscriptions,support_grants
 TO app_runtime;
GRANT SELECT, INSERT ON audit_logs TO app_runtime;
-- Global catalog: only published codes/plans; row-sensitive global tables require scoped API.
GRANT SELECT ON permissions,subscription_plans TO app_runtime;
-- NO SELECT on platform_users or tenants by default; onboarding/auth via tightly scoped privileged service.
-- No BYPASSRLS, no SUPERUSER, no CREATE on public, no unrestricted SECURITY DEFINER.
REVOKE CREATE ON SCHEMA public FROM app_runtime;
