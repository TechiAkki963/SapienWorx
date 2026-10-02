BEGIN;

CREATE TABLE outreach_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_sequences_name_not_blank CHECK (length(trim(name)) > 0)
);
CREATE INDEX idx_outreach_sequences_recruiter_updated ON outreach_sequences(recruiter_id, updated_at DESC);

CREATE TABLE outreach_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 1),
  delay_days integer NOT NULL DEFAULT 0 CHECK ((position = 1 AND delay_days = 0) OR (position > 1 AND delay_days >= 14)),
  subject_template varchar(255) NOT NULL,
  body_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_sequence_steps_subject_not_blank CHECK (length(trim(subject_template)) > 0),
  CONSTRAINT outreach_sequence_steps_body_not_blank CHECK (length(trim(body_template)) > 0),
  CONSTRAINT outreach_sequence_steps_unique_position UNIQUE(sequence_id, position)
);
CREATE INDEX idx_outreach_sequence_steps_sequence ON outreach_sequence_steps(sequence_id, position);

CREATE TABLE outreach_sequence_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_ids uuid[] NOT NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  requested_count integer NOT NULL,
  sent_count integer NOT NULL,
  skipped_count integer NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('sent','partial','skipped')),
  launched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outreach_sequence_launches_recruiter ON outreach_sequence_launches(recruiter_id, launched_at DESC);

CREATE OR REPLACE FUNCTION touch_outreach_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at=now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_outreach_sequence_touch BEFORE UPDATE ON outreach_sequences FOR EACH ROW EXECUTE FUNCTION touch_outreach_sequence();
CREATE TRIGGER trg_outreach_sequence_step_touch BEFORE UPDATE ON outreach_sequence_steps FOR EACH ROW EXECUTE FUNCTION touch_outreach_sequence();

COMMIT;
