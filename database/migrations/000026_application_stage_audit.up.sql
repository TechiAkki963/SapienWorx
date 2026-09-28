BEGIN;

CREATE TABLE application_stage_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  actor_recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  previous_stage application_stage NOT NULL,
  new_stage application_stage NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_stage_audit_changed CHECK (previous_stage <> new_stage)
);
CREATE INDEX ix_application_stage_audit_application_changed
  ON application_stage_audit (application_id, changed_at DESC);

COMMIT;
