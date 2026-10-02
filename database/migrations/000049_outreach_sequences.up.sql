BEGIN;

CREATE TYPE outreach_sequence_status AS ENUM ('draft','active','archived');
CREATE TYPE outreach_campaign_status AS ENUM ('launching','active','paused','completed','cancelled','failed');
CREATE TYPE outreach_member_status AS ENUM ('active','replied','completed','skipped','cancelled','failed');

CREATE TABLE outreach_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  description varchar(500) NOT NULL DEFAULT '',
  status outreach_sequence_status NOT NULL DEFAULT 'draft',
  stop_on_reply boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_sequences_name_not_blank CHECK (length(trim(name)) > 0)
);
CREATE INDEX ix_outreach_sequences_recruiter_updated
  ON outreach_sequences(recruiter_id, updated_at DESC);

CREATE TABLE outreach_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  step_order smallint NOT NULL CHECK (step_order BETWEEN 1 AND 5),
  delay_hours integer NOT NULL CHECK (delay_hours BETWEEN 0 AND 720),
  subject_template varchar(255) NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_sequence_steps_order_unique UNIQUE(sequence_id, step_order),
  CONSTRAINT outreach_sequence_steps_subject_not_blank CHECK (length(trim(subject_template)) > 0),
  CONSTRAINT outreach_sequence_steps_body_not_blank CHECK (length(trim(body_template)) > 0)
);
CREATE INDEX ix_outreach_sequence_steps_sequence
  ON outreach_sequence_steps(sequence_id, step_order);

CREATE TABLE outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE RESTRICT,
  launch_key varchar(128) NOT NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  status outreach_campaign_status NOT NULL DEFAULT 'launching',
  stop_on_reply boolean NOT NULL DEFAULT true,
  requested_count integer NOT NULL DEFAULT 0 CHECK (requested_count >= 0),
  enrolled_count integer NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT outreach_campaigns_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT outreach_campaigns_launch_key_unique UNIQUE(recruiter_id, launch_key)
);
CREATE INDEX ix_outreach_campaigns_recruiter_updated
  ON outreach_campaigns(recruiter_id, updated_at DESC);

CREATE TABLE outreach_campaign_steps (
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  step_order smallint NOT NULL CHECK (step_order BETWEEN 1 AND 5),
  delay_hours integer NOT NULL CHECK (delay_hours BETWEEN 0 AND 720),
  subject_template varchar(255) NOT NULL,
  body_template text NOT NULL,
  PRIMARY KEY(campaign_id, step_order)
);

CREATE TABLE outreach_campaign_members (
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES chat_threads(id) ON DELETE SET NULL,
  status outreach_member_status NOT NULL DEFAULT 'active',
  current_step smallint NOT NULL DEFAULT 0 CHECK (current_step BETWEEN 0 AND 5),
  next_run_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error varchar(240),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(campaign_id, candidate_id)
);
CREATE INDEX ix_outreach_campaign_members_due
  ON outreach_campaign_members(next_run_at, campaign_id)
  WHERE status='active' AND next_run_at IS NOT NULL;
CREATE INDEX ix_outreach_campaign_members_candidate
  ON outreach_campaign_members(candidate_id, updated_at DESC);

CREATE TABLE outreach_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_order smallint NOT NULL CHECK (step_order BETWEEN 1 AND 5),
  thread_id uuid REFERENCES chat_threads(id) ON DELETE SET NULL,
  message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  idempotency_key varchar(128) NOT NULL,
  status varchar(16) NOT NULL CHECK (status IN ('sent','skipped','failed')),
  error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_delivery_log_step_unique UNIQUE(campaign_id,candidate_id,step_order),
  CONSTRAINT outreach_delivery_log_idempotency_unique UNIQUE(idempotency_key)
);
CREATE INDEX ix_outreach_delivery_campaign_created
  ON outreach_delivery_log(campaign_id, created_at DESC);

COMMIT;
