BEGIN;

CREATE TYPE outreach_sequence_status AS ENUM ('draft','active','archived');
CREATE TYPE outreach_campaign_status AS ENUM ('draft','running','paused','completed','cancelled');
CREATE TYPE outreach_enrollment_status AS ENUM ('pending','active','completed','stopped','failed');

CREATE TABLE outreach_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  status outreach_sequence_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_sequences_name_not_blank CHECK (length(trim(name)) > 0)
);
CREATE INDEX idx_outreach_sequences_recruiter_updated
  ON outreach_sequences(recruiter_id, updated_at DESC);

CREATE TABLE outreach_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  step_order integer NOT NULL CHECK (step_order >= 1 AND step_order <= 12),
  delay_hours integer NOT NULL DEFAULT 0 CHECK (delay_hours >= 0 AND delay_hours <= 720),
  template_id uuid NOT NULL REFERENCES message_templates(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_sequence_steps_unique_order UNIQUE(sequence_id, step_order)
);
CREATE INDEX idx_outreach_sequence_steps_sequence_order
  ON outreach_sequence_steps(sequence_id, step_order);

CREATE TABLE outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE RESTRICT,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  name varchar(160) NOT NULL,
  status outreach_campaign_status NOT NULL DEFAULT 'draft',
  total_recipients integer NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  sent_count integer NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  launched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_campaigns_name_not_blank CHECK (length(trim(name)) > 0)
);
CREATE INDEX idx_outreach_campaigns_recruiter_updated
  ON outreach_campaigns(recruiter_id, updated_at DESC);
CREATE INDEX idx_outreach_campaigns_running
  ON outreach_campaigns(status, updated_at DESC)
  WHERE status='running';

CREATE TABLE outreach_send_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  enrollment_id uuid,
  recipient_count integer NOT NULL DEFAULT 1 CHECK (recipient_count >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outreach_send_ledger_recruiter_created
  ON outreach_send_ledger(recruiter_id, created_at DESC);
CREATE INDEX idx_outreach_send_ledger_company_created
  ON outreach_send_ledger(company_id, created_at DESC);

CREATE TABLE outreach_campaign_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES chat_threads(id) ON DELETE SET NULL,
  status outreach_enrollment_status NOT NULL DEFAULT 'pending',
  next_step_order integer NOT NULL DEFAULT 1 CHECK (next_step_order >= 1 AND next_step_order <= 13),
  next_run_at timestamptz,
  last_sent_at timestamptz,
  stop_reason varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_campaign_enrollments_unique_candidate UNIQUE(campaign_id, candidate_id)
);
ALTER TABLE outreach_send_ledger
  ADD CONSTRAINT outreach_send_ledger_enrollment_fk
  FOREIGN KEY (enrollment_id) REFERENCES outreach_campaign_enrollments(id) ON DELETE CASCADE;

CREATE INDEX idx_outreach_campaign_enrollments_due
  ON outreach_campaign_enrollments(next_run_at, id)
  WHERE status IN ('pending','active') AND next_run_at IS NOT NULL;

CREATE OR REPLACE FUNCTION touch_outreach_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at=now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_outreach_sequences_touch
BEFORE UPDATE ON outreach_sequences FOR EACH ROW EXECUTE FUNCTION touch_outreach_updated_at();

CREATE TRIGGER trg_outreach_campaigns_touch
BEFORE UPDATE ON outreach_campaigns FOR EACH ROW EXECUTE FUNCTION touch_outreach_updated_at();

CREATE TRIGGER trg_outreach_enrollments_touch
BEFORE UPDATE ON outreach_campaign_enrollments FOR EACH ROW EXECUTE FUNCTION touch_outreach_updated_at();

COMMIT;
