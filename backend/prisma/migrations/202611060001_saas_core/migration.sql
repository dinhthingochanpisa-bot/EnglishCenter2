-- Stage 01 SQL reviewed baseline; PostgreSQL 15+; run as migrator, NOT app_runtime.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE tenants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(64) NOT NULL UNIQUE,
 legal_name text NOT NULL, display_name text NOT NULL,
 status varchar(32) NOT NULL DEFAULT 'ONBOARDING' CHECK(status IN ('ONBOARDING','ACTIVE','SUSPENDED','CLOSED')),
 timezone varchar(80) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh', base_currency char(3) NOT NULL DEFAULT 'VND',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth_subject text NOT NULL UNIQUE,
 email text, display_name text NOT NULL, status varchar(32) NOT NULL DEFAULT 'ACTIVE'
 CHECK(status IN ('ACTIVE','DISABLED','INVITED')), mfa_enforced boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subscription_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_code varchar(80) NOT NULL UNIQUE,
 name text NOT NULL, features jsonb NOT NULL DEFAULT '{}'::jsonb,
 limits jsonb NOT NULL DEFAULT '{}'::jsonb, status varchar(32) NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE permissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(140) NOT NULL UNIQUE,
 resource varchar(80) NOT NULL, action varchar(80) NOT NULL
);
CREATE TABLE branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 code varchar(64) NOT NULL, name text NOT NULL, timezone varchar(80), is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version > 0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,code)
);
CREATE TABLE tenant_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE RESTRICT,
 employee_code varchar(64), status varchar(32) NOT NULL DEFAULT 'INVITED'
 CHECK(status IN ('INVITED','ACTIVE','SUSPENDED','LEFT')),
 joined_at timestamptz, left_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version > 0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,user_id), CHECK(left_at IS NULL OR joined_at IS NULL OR left_at >= joined_at)
);
CREATE TABLE roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 code varchar(80) NOT NULL, name text NOT NULL, system_role boolean NOT NULL DEFAULT false,
 scope_type varchar(40) NOT NULL DEFAULT 'ASSIGNED_BRANCHES'
 CHECK(scope_type IN ('SELF','OWNED_OR_ASSIGNED','ASSIGNED_STUDENTS','ASSIGNED_CLASSES','ASSIGNED_BRANCHES','TENANT')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version > 0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,code)
);
CREATE TABLE role_permissions (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 role_id uuid NOT NULL, permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
 PRIMARY KEY(tenant_id,role_id,permission_id),
 FOREIGN KEY(tenant_id,role_id) REFERENCES roles(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE membership_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 membership_id uuid NOT NULL, role_id uuid NOT NULL,
 valid_from timestamptz NOT NULL, valid_to timestamptz,
 UNIQUE(tenant_id,id), CHECK(valid_to IS NULL OR valid_to>valid_from),
 FOREIGN KEY(tenant_id,membership_id) REFERENCES tenant_memberships(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,role_id) REFERENCES roles(tenant_id,id) ON DELETE CASCADE,
 EXCLUDE USING gist (tenant_id WITH =, membership_id WITH =, role_id WITH =,
 tstzrange(valid_from,COALESCE(valid_to,'infinity'::timestamptz),'[)') WITH &&)
);
CREATE TABLE membership_branch_scopes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 membership_id uuid NOT NULL, branch_id uuid NOT NULL,
 valid_from timestamptz NOT NULL, valid_to timestamptz,
 UNIQUE(tenant_id,id), CHECK(valid_to IS NULL OR valid_to>valid_from),
 FOREIGN KEY(tenant_id,membership_id) REFERENCES tenant_memberships(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id) ON DELETE RESTRICT,
 EXCLUDE USING gist (tenant_id WITH =,membership_id WITH =,branch_id WITH =,
 tstzrange(valid_from,COALESCE(valid_to,'infinity'::timestamptz),'[)') WITH &&)
);
CREATE TABLE tenant_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 key varchar(140) NOT NULL, value jsonb NOT NULL, version integer NOT NULL CHECK(version>0),
 effective_from timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,key,version)
);
CREATE TABLE tenant_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
 status varchar(32) NOT NULL CHECK(status IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
 started_at timestamptz NOT NULL,ended_at timestamptz,billing_cycle varchar(32),provider_ref text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
 UNIQUE(tenant_id,id),CHECK(ended_at IS NULL OR ended_at>started_at)
);
CREATE UNIQUE INDEX uq_tenant_current_subscription ON tenant_subscriptions(tenant_id)
 WHERE status IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED') AND ended_at IS NULL;
CREATE TABLE support_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 platform_operator_user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE RESTRICT,
 approved_by_user_id uuid NOT NULL REFERENCES platform_users(id) ON DELETE RESTRICT,
 reason text NOT NULL,valid_from timestamptz NOT NULL,valid_to timestamptz NOT NULL,revoked_at timestamptz,
 ticket_ref text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
 UNIQUE(tenant_id,id), CHECK(valid_to>valid_from),
 CHECK(approved_by_user_id<>platform_operator_user_id)
);
CREATE TABLE audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
 actor_user_id uuid REFERENCES platform_users(id) ON DELETE RESTRICT,
 action varchar(140) NOT NULL,resource_type varchar(100) NOT NULL,resource_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),before_data jsonb,after_data jsonb,
 reason text,request_id uuid,ip_hash text, UNIQUE(tenant_id,id)
);
CREATE INDEX ix_branches_tenant_active ON branches(tenant_id,is_active);
CREATE INDEX ix_memberships_tenant_status ON tenant_memberships(tenant_id,status);
CREATE INDEX ix_membership_roles_active ON membership_roles(tenant_id,membership_id,valid_from);
CREATE INDEX ix_branch_scopes_active ON membership_branch_scopes(tenant_id,membership_id,valid_from);
CREATE INDEX ix_subscriptions_tenant_status ON tenant_subscriptions(tenant_id,status);
CREATE INDEX ix_support_grants_tenant_expiry ON support_grants(tenant_id,valid_to);
CREATE INDEX ix_audit_by_time ON audit_logs(tenant_id,occurred_at DESC);
CREATE INDEX ix_audit_by_resource ON audit_logs(tenant_id,resource_type,resource_id);

CREATE FUNCTION forbid_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_logs are append-only'; END; $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

-- IMPORTANT: RLS policies intentionally use transaction-local, validated tenant context.
-- The application MUST NOT accept tenant_id from a request body as authority.
-- Connection with unset context will see ZERO tenant rows.
CREATE SCHEMA IF NOT EXISTS app_private;
CREATE FUNCTION app_private.current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.tenant_id',true),'')::uuid $$;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'branches','tenant_memberships','roles','role_permissions','membership_roles',
  'membership_branch_scopes','tenant_settings','tenant_subscriptions','support_grants','audit_logs'
 ] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = app_private.current_tenant_id()) WITH CHECK (tenant_id = app_private.current_tenant_id())',t);
 END LOOP;
END $$;
-- Global tables: tenants, platform_users, subscription_plans, permissions are PLATFORM data.
-- Do NOT expose their general SELECT to tenant app role. Use scoped service methods / SECURITY DEFINER functions only after review.
