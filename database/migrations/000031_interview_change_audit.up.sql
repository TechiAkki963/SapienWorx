BEGIN;

CREATE TABLE interview_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  actor_recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('reschedule', 'cancel', 'complete')),
  previous_status text NOT NULL,
  new_status text NOT NULL,
  previous_scheduled_at timestamptz NOT NULL,
  new_scheduled_at timestamptz NOT NULL,
  previous_duration_minutes integer NOT NULL,
  new_duration_minutes integer NOT NULL,
  previous_round_label text NOT NULL,
  new_round_label text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_interview_change_audit_interview_changed
  ON interview_change_audit (interview_id, changed_at DESC);

COMMIT;
