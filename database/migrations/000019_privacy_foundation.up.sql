BEGIN;

CREATE TABLE privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purpose varchar(120) NOT NULL,
  policy_version varchar(80) NOT NULL,
  granted boolean NOT NULL,
  source varchar(80) NOT NULL DEFAULT 'web_signup',
  user_agent varchar(512),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  CONSTRAINT privacy_consents_purpose_not_blank CHECK (btrim(purpose) <> ''),
  CONSTRAINT privacy_consents_policy_not_blank CHECK (btrim(policy_version) <> ''),
  CONSTRAINT privacy_consents_withdrawal_valid CHECK (withdrawn_at IS NULL OR granted = true)
);
CREATE INDEX ix_privacy_consents_user_purpose ON privacy_consents(user_id, purpose, recorded_at DESC);

CREATE TABLE privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_type varchar(40) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'received',
  jurisdiction varchar(24) NOT NULL DEFAULT 'global',
  due_at timestamptz NOT NULL,
  result_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_request_type_valid CHECK (request_type IN ('access','export','rectification','erasure','restriction','objection')),
  CONSTRAINT privacy_request_status_valid CHECK (status IN ('received','in_progress','awaiting_review','fulfilled','rejected','cancelled')),
  CONSTRAINT privacy_request_completion_valid CHECK ((status='fulfilled' AND completed_at IS NOT NULL) OR (status<>'fulfilled'))
);
CREATE INDEX ix_privacy_requests_user_created ON privacy_requests(user_id, created_at DESC);
CREATE INDEX ix_privacy_requests_status_due ON privacy_requests(status, due_at);
CREATE UNIQUE INDEX ux_privacy_requests_active_user_type
  ON privacy_requests(user_id, request_type)
  WHERE status IN ('received','in_progress','awaiting_review');
CREATE TRIGGER trg_privacy_requests_updated_at BEFORE UPDATE ON privacy_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_fulfilment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES privacy_requests(id) ON DELETE CASCADE,
  job_type varchar(80) NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  run_after timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_fulfilment_status_valid CHECK (status IN ('pending','running','succeeded','failed','awaiting_review')),
  CONSTRAINT privacy_fulfilment_attempts_nonnegative CHECK (attempts >= 0),
  CONSTRAINT ux_privacy_fulfilment_idempotency UNIQUE(idempotency_key)
);
CREATE INDEX ix_privacy_fulfilment_jobs_queue ON privacy_fulfilment_jobs(status, run_after, created_at);
CREATE INDEX ix_privacy_fulfilment_jobs_request ON privacy_fulfilment_jobs(request_id, created_at);
CREATE TRIGGER trg_privacy_fulfilment_jobs_updated_at BEFORE UPDATE ON privacy_fulfilment_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
