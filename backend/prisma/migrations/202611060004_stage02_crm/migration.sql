-- Stage 02 – CRM and Customer 360. Apply AFTER Stage 01 migrations.
CREATE TABLE crm_persons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 full_name varchar(240) NOT NULL,normalized_name varchar(240) NOT NULL,
 date_of_birth date,gender varchar(24),school_name varchar(240),school_grade varchar(40),address text,
 status varchar(32) NOT NULL DEFAULT 'PROSPECT' CHECK(status IN ('PROSPECT','CUSTOMER','STUDENT','ARCHIVED')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),UNIQUE(tenant_id,id)
);
CREATE INDEX ix_crm_person_name ON crm_persons(tenant_id,normalized_name);
CREATE TABLE crm_person_branches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 person_id uuid NOT NULL,branch_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,person_id,branch_id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES crm_persons(tenant_id,id),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id)
);
CREATE INDEX ix_crm_person_branch ON crm_person_branches(tenant_id,branch_id);
CREATE TABLE crm_person_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 person_id uuid NOT NULL,kind varchar(16) NOT NULL CHECK(kind IN ('PHONE','EMAIL')),
 raw_value varchar(240) NOT NULL,normalized_value varchar(240) NOT NULL,is_primary boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES crm_persons(tenant_id,id)
);
CREATE INDEX ix_crm_contact_search ON crm_person_contacts(tenant_id,kind,normalized_value);
CREATE TABLE crm_students (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 person_id uuid NOT NULL,student_code varchar(60),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,person_id),UNIQUE(tenant_id,student_code),
 FOREIGN KEY(tenant_id,person_id) REFERENCES crm_persons(tenant_id,id)
);
CREATE TABLE crm_student_guardians (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 student_id uuid NOT NULL,guardian_person_id uuid NOT NULL,relation_type varchar(40) NOT NULL,is_primary boolean NOT NULL DEFAULT false,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,student_id,guardian_person_id),
 FOREIGN KEY(tenant_id,student_id) REFERENCES crm_students(tenant_id,id),
 FOREIGN KEY(tenant_id,guardian_person_id) REFERENCES crm_persons(tenant_id,id)
);
CREATE UNIQUE INDEX uq_crm_student_primary_guardian ON crm_student_guardians(tenant_id,student_id) WHERE is_primary;
CREATE TABLE crm_marketing_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 code varchar(70) NOT NULL,name varchar(180) NOT NULL,category varchar(40) NOT NULL,
 is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,code),
 CHECK(category IN ('EVENT','SCHOOL','PAGE','ZALO_OA','GOOGLE_ADS','REFERRAL','COLLABORATOR','WALK_IN','OTHER'))
);
CREATE TABLE crm_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 code varchar(80) NOT NULL,name varchar(200) NOT NULL,source_id uuid,start_at timestamptz,end_at timestamptz,
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,code),CHECK(end_at IS NULL OR start_at IS NULL OR end_at>start_at),
 FOREIGN KEY(tenant_id,source_id) REFERENCES crm_marketing_sources(tenant_id,id)
);
CREATE TABLE crm_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 person_id uuid NOT NULL,branch_id uuid NOT NULL,source_id uuid NOT NULL,campaign_id uuid,
 assigned_membership_id uuid,contact_name varchar(240),contact_phone varchar(40),contact_phone_normalized varchar(40),
 status varchar(32) NOT NULL DEFAULT 'NEW',qualified_at timestamptz,next_followup_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),UNIQUE(tenant_id,id),
 CHECK(status IN ('NEW','CONTACTING','QUALIFIED','APPOINTMENT','CONVERTED','CLOSED_LOST')),
 CHECK((contact_phone_normalized IS NULL AND qualified_at IS NULL) OR (contact_phone_normalized IS NOT NULL)),
 CHECK(status<>'QUALIFIED' OR (contact_phone_normalized IS NOT NULL AND qualified_at IS NOT NULL)),
 FOREIGN KEY(tenant_id,person_id) REFERENCES crm_persons(tenant_id,id),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),
 FOREIGN KEY(tenant_id,source_id) REFERENCES crm_marketing_sources(tenant_id,id),
 FOREIGN KEY(tenant_id,campaign_id) REFERENCES crm_campaigns(tenant_id,id),
 FOREIGN KEY(tenant_id,assigned_membership_id) REFERENCES tenant_memberships(tenant_id,id)
);
CREATE INDEX ix_crm_lead_branch_status ON crm_leads(tenant_id,branch_id,status,created_at DESC);
CREATE INDEX ix_crm_lead_phone ON crm_leads(tenant_id,contact_phone_normalized);
CREATE TABLE crm_lead_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 lead_id uuid NOT NULL,event_type varchar(45) NOT NULL,from_status varchar(32),to_status varchar(32),
 actor_user_id uuid REFERENCES platform_users(id),metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES crm_leads(tenant_id,id)
);
CREATE INDEX ix_crm_lead_events ON crm_lead_events(tenant_id,lead_id,occurred_at);
CREATE TABLE crm_lead_touches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 lead_id uuid NOT NULL,source_id uuid NOT NULL,campaign_id uuid,touch_type varchar(40) NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES crm_leads(tenant_id,id),
 FOREIGN KEY(tenant_id,source_id) REFERENCES crm_marketing_sources(tenant_id,id),
 FOREIGN KEY(tenant_id,campaign_id) REFERENCES crm_campaigns(tenant_id,id)
);
CREATE INDEX ix_crm_lead_touches ON crm_lead_touches(tenant_id,lead_id,occurred_at);
CREATE TABLE crm_lead_activities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 lead_id uuid NOT NULL,actor_user_id uuid NOT NULL REFERENCES platform_users(id),kind varchar(35) NOT NULL,
 note text NOT NULL,outcome varchar(60),followup_at timestamptz,occurred_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),CHECK(kind IN ('CALL','MESSAGE','NOTE','MEETING','FOLLOWUP')),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES crm_leads(tenant_id,id)
);
CREATE INDEX ix_crm_lead_activities ON crm_lead_activities(tenant_id,lead_id,occurred_at);
CREATE TABLE crm_checkins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 person_id uuid NOT NULL,student_id uuid,lead_id uuid,branch_id uuid NOT NULL,source_id uuid NOT NULL,
 status varchar(25) NOT NULL DEFAULT 'DRAFT',purpose varchar(160),
 checked_in_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 received_by_user_id uuid NOT NULL REFERENCES platform_users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),CHECK(status IN ('DRAFT','COMPLETED','CANCELLED')),
 FOREIGN KEY(tenant_id,person_id) REFERENCES crm_persons(tenant_id,id),
 FOREIGN KEY(tenant_id,student_id) REFERENCES crm_students(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES crm_leads(tenant_id,id),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),
 FOREIGN KEY(tenant_id,source_id) REFERENCES crm_marketing_sources(tenant_id,id)
);
CREATE INDEX ix_crm_checkin_date ON crm_checkins(tenant_id,branch_id,checked_in_at DESC);
CREATE TABLE crm_intake_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 branch_id uuid NOT NULL,lead_id uuid,token_hash char(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,redeemed_at timestamptz,created_by_user_id uuid NOT NULL REFERENCES platform_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,branch_id) REFERENCES branches(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES crm_leads(tenant_id,id)
);
CREATE INDEX ix_crm_intake_expiry ON crm_intake_invites(tenant_id,expires_at);
CREATE TABLE crm_intake_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),
 invite_id uuid NOT NULL,full_name varchar(240) NOT NULL,guardian_name varchar(240),guardian_phone varchar(40),
 date_of_birth date,school_name varchar(240),school_grade varchar(40),
 status varchar(30) NOT NULL DEFAULT 'RECEIVED',consented_at timestamptz NOT NULL,reviewed_at timestamptz,reviewed_by_user_id uuid REFERENCES platform_users(id),
 checkin_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,invite_id),
 CHECK(status IN ('RECEIVED','CONFIRMED','REJECTED')),
 CHECK((status='CONFIRMED')=(checkin_id IS NOT NULL)),
 FOREIGN KEY(tenant_id,invite_id) REFERENCES crm_intake_invites(tenant_id,id),
 FOREIGN KEY(tenant_id,checkin_id) REFERENCES crm_checkins(tenant_id,id)
);
CREATE INDEX ix_crm_intake_pending ON crm_intake_submissions(tenant_id,status,created_at DESC);
-- Campaign must belong to the same attribution source when a source is defined.
CREATE OR REPLACE FUNCTION crm_validate_lead_campaign() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.campaign_id IS NOT NULL AND EXISTS (
   SELECT 1 FROM crm_campaigns c
   WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.campaign_id AND c.source_id IS NOT NULL AND c.source_id<>NEW.source_id
 ) THEN RAISE EXCEPTION 'Lead source does not match campaign source'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_lead_campaign_check BEFORE INSERT OR UPDATE ON crm_leads FOR EACH ROW EXECUTE FUNCTION crm_validate_lead_campaign();
-- Reject connecting a checkin to the wrong student/person or lead/branch even within one tenant.
CREATE OR REPLACE FUNCTION crm_validate_checkin_links() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.student_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM crm_students s WHERE s.tenant_id=NEW.tenant_id AND s.id=NEW.student_id AND s.person_id=NEW.person_id
 ) THEN RAISE EXCEPTION 'checkin student does not match person'; END IF;
 IF NEW.lead_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM crm_leads l WHERE l.tenant_id=NEW.tenant_id AND l.id=NEW.lead_id AND l.person_id=NEW.person_id AND l.branch_id=NEW.branch_id
 ) THEN RAISE EXCEPTION 'checkin lead does not match person and branch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER crm_checkin_links BEFORE INSERT OR UPDATE ON crm_checkins FOR EACH ROW EXECUTE FUNCTION crm_validate_checkin_links();
-- Tenant isolation: fail closed without transaction-local tenant_id, including public QR submission path.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['crm_persons','crm_person_branches','crm_person_contacts','crm_students',
 'crm_student_guardians','crm_marketing_sources','crm_campaigns','crm_leads','crm_lead_events',
 'crm_lead_touches','crm_lead_activities','crm_checkins','crm_intake_invites','crm_intake_submissions'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = app_private.current_tenant_id()) WITH CHECK (tenant_id = app_private.current_tenant_id())',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO app_runtime',t);
 END LOOP;
END $$;
-- Define permissions in migration; grant them only through explicit role policies.
INSERT INTO permissions(code,resource,action) VALUES
 ('crm.person.read','crm.person','read'),('crm.person.create','crm.person','create'),('crm.person.update','crm.person','update'),
 ('crm.lead.read','crm.lead','read'),('crm.lead.create','crm.lead','create'),('crm.lead.update','crm.lead','update'),
 ('crm.lead.assign','crm.lead','assign'),('crm.source.read','crm.source','read'),('crm.source.manage','crm.source','manage'),
 ('crm.activity.write','crm.activity','write'),('crm.checkin.read','crm.checkin','read'),('crm.checkin.create','crm.checkin','create'),
 ('crm.checkin.update','crm.checkin','update'),('crm.intake.read','crm.intake','read'),('crm.intake.manage','crm.intake','manage'),
 ('pii.read_sensitive','pii','read_sensitive')
ON CONFLICT(code) DO NOTHING;

-- Tenant admins receive CRM permissions; sensitive PII reveal requires explicit opt-in role grant.
INSERT INTO role_permissions(tenant_id,role_id,permission_id)
SELECT r.tenant_id,r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='TENANT_ADMIN' AND p.code IN (
 'crm.person.read','crm.person.create','crm.person.update','crm.lead.read','crm.lead.create',
 'crm.lead.update','crm.lead.assign','crm.source.read','crm.source.manage',
 'crm.activity.write','crm.checkin.read','crm.checkin.create','crm.checkin.update',
 'crm.intake.read','crm.intake.manage')
ON CONFLICT DO NOTHING;
