BEGIN;

CREATE TYPE company_verification_review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE company_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recruiter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name varchar(200) NOT NULL,
  registration_doc_url text,
  status company_verification_review_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_verifications_company_name_not_blank CHECK (btrim(company_name) <> ''),
  CONSTRAINT company_verifications_review_state CHECK (
    (status = 'pending' AND reviewed_at IS NULL)
    OR (status IN ('approved','rejected') AND reviewed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX ux_company_verifications_pending_recruiter
  ON company_verifications (recruiter_user_id)
  WHERE status = 'pending';
CREATE INDEX ix_company_verifications_status_created
  ON company_verifications (status, created_at DESC);
CREATE INDEX ix_company_verifications_company
  ON company_verifications (company_id, created_at DESC);
CREATE INDEX ix_company_verifications_reviewed_by
  ON company_verifications (reviewed_by, reviewed_at DESC)
  WHERE reviewed_by IS NOT NULL;

CREATE TABLE admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action_type varchar(120) NOT NULL,
  target_entity_type varchar(80),
  target_entity_id uuid,
  ip_address inet,
  request_id varchar(80),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_logs_action_not_blank CHECK (btrim(action_type) <> ''),
  CONSTRAINT admin_audit_logs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX ix_admin_audit_logs_admin_created
  ON admin_audit_logs (admin_id, created_at DESC);
CREATE INDEX ix_admin_audit_logs_target_created
  ON admin_audit_logs (target_entity_type, target_entity_id, created_at DESC);
CREATE INDEX ix_admin_audit_logs_action_created
  ON admin_audit_logs (action_type, created_at DESC);
CREATE INDEX ix_admin_audit_logs_created
  ON admin_audit_logs (created_at DESC);
CREATE INDEX ix_admin_audit_logs_metadata_gin
  ON admin_audit_logs USING gin (metadata);

-- Audit records are security evidence and must not be mutated in-place by the application.
CREATE OR REPLACE FUNCTION prevent_admin_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin audit logs are append-only';
END;
$$;

CREATE TRIGGER trg_admin_audit_logs_no_update
BEFORE UPDATE ON admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();

CREATE TRIGGER trg_admin_audit_logs_no_delete
BEFORE DELETE ON admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();

CREATE TABLE platform_metrics_daily (
  metric_date date PRIMARY KEY,
  total_active_users bigint NOT NULL DEFAULT 0,
  active_jobs bigint NOT NULL DEFAULT 0,
  total_candidates bigint NOT NULL DEFAULT 0,
  jobs_posted_today bigint NOT NULL DEFAULT 0,
  sns_sms_sent bigint NOT NULL DEFAULT 0,
  sns_billing_cycle_start date,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_metrics_nonnegative CHECK (
    total_active_users >= 0
    AND active_jobs >= 0
    AND total_candidates >= 0
    AND jobs_posted_today >= 0
    AND sns_sms_sent >= 0
  )
);

CREATE INDEX ix_platform_metrics_computed_at
  ON platform_metrics_daily (computed_at DESC);

CREATE TRIGGER trg_company_verifications_updated_at
BEFORE UPDATE ON company_verifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
