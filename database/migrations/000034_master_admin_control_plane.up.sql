BEGIN;

CREATE TABLE admin_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL CHECK (length(btrim(action_type)) BETWEEN 3 AND 120),
  target_type text NOT NULL CHECK (length(btrim(target_type)) BETWEEN 2 AND 80),
  target_id uuid,
  requested_by uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000),
  approval_reference text NOT NULL CHECK (length(btrim(approval_reference)) BETWEEN 5 AND 200),
  required_approvals smallint NOT NULL DEFAULT 2 CHECK (required_approvals BETWEEN 2 AND 5),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  expires_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_admin_approval_requests_status_created ON admin_approval_requests(status,created_at DESC);

CREATE TABLE admin_approval_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES admin_approval_requests(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id),
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(approval_id,reviewer_id)
);
CREATE INDEX ix_admin_approval_decisions_approval ON admin_approval_decisions(approval_id,decided_at);

CREATE TABLE admin_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type text NOT NULL CHECK (case_type IN ('moderation','privacy','security','organization','operations')),
  subject_type text NOT NULL CHECK (subject_type IN ('user','job','message','privacy_request','organization','incident','system','release')),
  subject_id uuid,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 240),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','awaiting_review','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  assigned_to uuid REFERENCES users(id),
  opened_by uuid NOT NULL REFERENCES users(id),
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 4000),
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX ix_admin_cases_queue ON admin_cases(status,priority,updated_at DESC);
CREATE INDEX ix_admin_cases_assignee ON admin_cases(assigned_to,status);

CREATE TABLE admin_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES admin_cases(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK (event_type IN ('opened','assigned','note','status_changed','reviewed','escalated','hold_added','hold_released')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 4000),
  from_status text,
  to_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_admin_case_events_case ON admin_case_events(case_id,created_at DESC);

CREATE TABLE organization_governance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  review_type text NOT NULL CHECK (review_type IN ('restriction','invitation','reassignment','merge_review')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied','cancelled')),
  requested_by uuid NOT NULL REFERENCES users(id),
  assigned_to uuid REFERENCES users(id),
  approval_id uuid REFERENCES admin_approval_requests(id),
  source_user_id uuid REFERENCES users(id),
  target_user_id uuid REFERENCES users(id),
  duplicate_company_id uuid REFERENCES companies(id),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX ix_org_governance_reviews_queue ON organization_governance_reviews(status,review_type,created_at DESC);

CREATE TABLE admin_telemetry_events (
  id bigserial PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('inmail','ses','notification','websocket','cv_parser')),
  source text NOT NULL CHECK (length(btrim(source)) BETWEEN 2 AND 100),
  operation text NOT NULL CHECK (length(btrim(operation)) BETWEEN 2 AND 100),
  status text NOT NULL CHECK (status IN ('ok','retrying','failed','backlogged','degraded','unconnected')),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  backlog_count integer CHECK (backlog_count IS NULL OR backlog_count >= 0),
  reference_id text CHECK (reference_id IS NULL OR length(reference_id) <= 200),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (metadata ?| ARRAY['content','body','message','message_text','cv','cv_text','resume','resume_text','email_body','attachment']))
);
CREATE INDEX ix_admin_telemetry_events_category_time ON admin_telemetry_events(category,occurred_at DESC);
CREATE INDEX ix_admin_telemetry_events_status_time ON admin_telemetry_events(status,occurred_at DESC);

CREATE TABLE admin_operation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_type text NOT NULL CHECK (evidence_type IN ('service_health','database_health','alert','release','migration','backup','restore_test')),
  environment text NOT NULL CHECK (length(btrim(environment)) BETWEEN 2 AND 40),
  component text NOT NULL CHECK (length(btrim(component)) BETWEEN 2 AND 120),
  status text NOT NULL CHECK (status IN ('healthy','warning','critical','failed','passed','pending','unconnected','unknown')),
  owner text NOT NULL DEFAULT '' CHECK (length(owner) <= 200),
  reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 500),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (details ?| ARRAY['password','secret','token','private_key','message_body','cv_text','resume_text']))
);
CREATE INDEX ix_admin_operation_evidence_type_time ON admin_operation_evidence(evidence_type,observed_at DESC);

CREATE TABLE admin_cost_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'aws' CHECK (provider IN ('aws')),
  currency char(3) NOT NULL DEFAULT 'USD',
  period_start date NOT NULL,
  period_end date NOT NULL,
  actual_cost numeric(14,4) NOT NULL CHECK (actual_cost >= 0),
  forecast_cost numeric(14,4) CHECK (forecast_cost IS NULL OR forecast_cost >= 0),
  budget_amount numeric(14,4) CHECK (budget_amount IS NULL OR budget_amount >= 0),
  source_reference text NOT NULL DEFAULT '' CHECK (length(source_reference) <= 500),
  observed_at timestamptz NOT NULL,
  recorded_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);
CREATE INDEX ix_admin_cost_snapshots_period ON admin_cost_snapshots(period_end DESC,observed_at DESC);

CREATE TABLE knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 240),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','published','archived')),
  current_revision integer NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 240),
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 1000),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 100000),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(article_id,revision)
);

CREATE TABLE admin_operational_settings (
  setting_key text PRIMARY KEY CHECK (setting_key ~ '^[a-z0-9][a-z0-9._-]{2,99}$'),
  value jsonb NOT NULL,
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  high_risk boolean NOT NULL DEFAULT false,
  approval_id uuid REFERENCES admin_approval_requests(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (value ?| ARRAY['password','secret','token','private_key','encryption_key']))
);

CREATE TABLE admin_release_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_reference text NOT NULL CHECK (length(btrim(release_reference)) BETWEEN 5 AND 240),
  environment text NOT NULL CHECK (length(btrim(environment)) BETWEEN 2 AND 40),
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-fA-F]{7,64}$'),
  migration_reference text NOT NULL DEFAULT '' CHECK (length(migration_reference) <= 1000),
  status text NOT NULL DEFAULT 'reviewing' CHECK (status IN ('reviewing','approved_for_rollout','deployed','accepted','rejected','rolled_back')),
  approval_id uuid REFERENCES admin_approval_requests(id),
  backup_evidence_id uuid REFERENCES admin_operation_evidence(id),
  restore_test_evidence_id uuid REFERENCES admin_operation_evidence(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  accepted_by uuid REFERENCES users(id),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
CREATE INDEX ix_admin_release_acceptance_created ON admin_release_acceptance(created_at DESC);

COMMIT;
