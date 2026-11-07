-- Stage 01A remediation: runtime role grants referenced in setup but absent from applied migrations.
-- DBA MUST provision app_runtime, identity_reader, platform_operator before migrations.
-- Migration must run as schema owner; runtime role MUST NOT own tenant tables.
GRANT USAGE ON SCHEMA public, app_private TO app_runtime;
GRANT EXECUTE ON FUNCTION app_private.current_tenant_id() TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  branches, tenant_memberships, roles, role_permissions, membership_roles,
  membership_branch_scopes, tenant_settings, tenant_subscriptions, support_grants
TO app_runtime;
GRANT SELECT, INSERT ON audit_logs TO app_runtime;
GRANT SELECT ON permissions, subscription_plans TO app_runtime;
REVOKE CREATE ON SCHEMA public FROM app_runtime;
-- DO NOT grant platform_users or tenants to app_runtime.
