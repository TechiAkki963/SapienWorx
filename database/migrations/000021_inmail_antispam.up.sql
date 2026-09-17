BEGIN;

CREATE TABLE inmail_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  source varchar(32) NOT NULL DEFAULT 'single',
  CONSTRAINT inmail_delivery_source_valid CHECK (source IN ('single','bulk'))
);

CREATE INDEX ix_inmail_delivery_cooldown
  ON inmail_delivery_log(recruiter_id, candidate_id, sent_at DESC);
CREATE INDEX ix_inmail_delivery_candidate
  ON inmail_delivery_log(candidate_id, sent_at DESC);

COMMIT;
