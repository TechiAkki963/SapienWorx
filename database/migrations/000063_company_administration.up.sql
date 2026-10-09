BEGIN;
CREATE TABLE company_memberships (
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
 role varchar(24) NOT NULL CHECK(role IN('primary_admin','sub_admin','recruiter','collaborator')),
 status varchar(24) NOT NULL DEFAULT 'active' CHECK(status IN('active','inactive','inactive_plan')),
 scope jsonb NOT NULL DEFAULT '{"all":true}' CHECK(jsonb_typeof(scope)='object'),
 talent_seat boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,user_id), UNIQUE(user_id),
 CHECK(role<>'primary_admin' OR status='active')
);
CREATE UNIQUE INDEX ix_company_single_owner ON company_memberships(company_id) WHERE role='primary_admin';
CREATE TABLE company_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 email varchar(320) NOT NULL CHECK(email=lower(email)),
 full_name varchar(160) NOT NULL,
 role varchar(24) NOT NULL CHECK(role IN('primary_admin','sub_admin','recruiter','collaborator')),
 scope jsonb NOT NULL DEFAULT '{"all":true}' CHECK(jsonb_typeof(scope)='object'),
 talent_seat boolean NOT NULL DEFAULT false,
 token_hash bytea NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 accepted_by uuid REFERENCES users(id) ON DELETE RESTRICT,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at>created_at), CHECK((accepted_by IS NULL)=(accepted_at IS NULL))
);
CREATE INDEX ix_company_pending_invites ON company_invitations(company_id,expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE company_platform_approval_uses (
 approval_id uuid PRIMARY KEY REFERENCES admin_approval_requests(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE company_setup (
 company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE RESTRICT,
 profile jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(profile)='object'),
 structure jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(structure)='object'),
 hiring jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(hiring)='object'),
 privacy jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(privacy)='object'),
 completed_steps text[] NOT NULL DEFAULT '{}',
 completed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE company_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action varchar(100) NOT NULL,
 target_id uuid,
 details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_company_audit_date ON company_audit_events(company_id,created_at DESC);
CREATE FUNCTION prevent_company_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Company audit events are append-only'; END; $$;
CREATE TRIGGER trg_company_audit_immutable BEFORE UPDATE OR DELETE ON company_audit_events FOR EACH ROW EXECUTE FUNCTION prevent_company_audit_mutation();
COMMENT ON TABLE company_memberships IS 'Company roles are distinct from platform JWT roles. No owner is inferred or backfilled for existing tenants.';
ALTER TABLE recruiter_saved_searches ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE recruiter_talent_pools ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE message_templates ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE outreach_sequences ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE outreach_campaigns ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chat_threads ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
COMMIT;
