BEGIN;

CREATE TYPE privacy_request_type AS ENUM ('access','export','correction','erasure','restriction','objection');
CREATE TYPE privacy_request_status AS ENUM ('received','identity_verified','in_progress','blocked','ready','completed','rejected');
CREATE TYPE privacy_job_status AS ENUM ('queued','running','completed','failed','blocked');

CREATE TABLE privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope varchar(80) NOT NULL,
  notice_version varchar(40) NOT NULL,
  lawful_basis varchar(80) NOT NULL,
  granted boolean NOT NULL,
  source varchar(80) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  CONSTRAINT privacy_consents_scope_not_blank CHECK (btrim(scope) <> ''),
  CONSTRAINT privacy_consents_notice_not_blank CHECK (btrim(notice_version) <> '')
);
CREATE INDEX ix_privacy_consents_user_recorded ON privacy_consents(user_id, recorded_at DESC);

CREATE TABLE privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_type privacy_request_type NOT NULL,
  status privacy_request_status NOT NULL DEFAULT 'received',
  reason text,
  due_at timestamptz NOT NULL,
  identity_verified_at timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_privacy_requests_user_created ON privacy_requests(user_id, created_at DESC);
CREATE INDEX ix_privacy_requests_status_due ON privacy_requests(status, due_at);
CREATE UNIQUE INDEX ux_privacy_requests_active_duplicate
  ON privacy_requests(user_id, request_type)
  WHERE status NOT IN ('completed','rejected');
CREATE TRIGGER trg_privacy_requests_updated_at BEFORE UPDATE ON privacy_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_fulfilment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES privacy_requests(id) ON DELETE CASCADE,
  job_type varchar(60) NOT NULL,
  status privacy_job_status NOT NULL DEFAULT 'queued',
  idempotency_key varchar(160) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  required_collectors text[] NOT NULL DEFAULT '{}'::text[],
  completed_collectors text[] NOT NULL DEFAULT '{}'::text[],
  result_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_jobs_attempts_nonnegative CHECK (attempts >= 0),
  CONSTRAINT privacy_jobs_key_not_blank CHECK (btrim(idempotency_key) <> '')
);
CREATE UNIQUE INDEX ux_privacy_jobs_request_type ON privacy_fulfilment_jobs(request_id, job_type);
CREATE UNIQUE INDEX ux_privacy_jobs_idempotency ON privacy_fulfilment_jobs(idempotency_key);
CREATE INDEX ix_privacy_jobs_status_created ON privacy_fulfilment_jobs(status, created_at);
CREATE TRIGGER trg_privacy_jobs_updated_at BEFORE UPDATE ON privacy_fulfilment_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE privacy_erasure_reviews (
  request_id uuid PRIMARY KEY REFERENCES privacy_requests(id) ON DELETE CASCADE,
  retention_reviewed_at timestamptz,
  retention_reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  execution_authorized_at timestamptz,
  execution_authorized_by uuid REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE privacy_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES privacy_requests(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type varchar(100) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_audit_event_not_blank CHECK (btrim(event_type) <> '')
);
CREATE INDEX ix_privacy_audit_request_created ON privacy_audit_events(request_id, created_at DESC);

COMMIT;