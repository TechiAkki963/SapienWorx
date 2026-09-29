BEGIN;

ALTER TABLE jobs
  ADD COLUMN screening_questions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN referral_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN visibility varchar(16) NOT NULL DEFAULT 'public',
  ADD COLUMN internal_notes text,
  ADD COLUMN assigned_recruiter_id uuid REFERENCES recruiter_profiles(user_id) ON DELETE SET NULL,
  ADD CONSTRAINT jobs_visibility_valid CHECK (visibility IN ('public','private'));

UPDATE jobs
SET assigned_recruiter_id=created_by_recruiter_id
WHERE assigned_recruiter_id IS NULL;

CREATE INDEX ix_jobs_visibility_status ON jobs (visibility,status,published_at DESC);
CREATE INDEX ix_jobs_assigned_recruiter_status ON jobs (assigned_recruiter_id,status)
  WHERE assigned_recruiter_id IS NOT NULL;

CREATE TABLE job_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  actor_recruiter_id uuid NOT NULL REFERENCES recruiter_profiles(user_id) ON DELETE RESTRICT,
  action varchar(64) NOT NULL,
  previous_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_change_audit_action_not_blank CHECK (btrim(action) <> ''),
  CONSTRAINT job_change_audit_previous_object CHECK (jsonb_typeof(previous_state)='object'),
  CONSTRAINT job_change_audit_new_object CHECK (jsonb_typeof(new_state)='object')
);

CREATE INDEX ix_job_change_audit_job_changed ON job_change_audit (job_id,changed_at DESC);
CREATE INDEX ix_job_change_audit_actor_changed ON job_change_audit (actor_recruiter_id,changed_at DESC);

CREATE FUNCTION prevent_job_change_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'job change audit records are append-only';
END;
$$;

CREATE TRIGGER trg_job_change_audit_no_update
BEFORE UPDATE ON job_change_audit
FOR EACH ROW EXECUTE FUNCTION prevent_job_change_audit_mutation();

CREATE TRIGGER trg_job_change_audit_no_delete
BEFORE DELETE ON job_change_audit
FOR EACH ROW EXECUTE FUNCTION prevent_job_change_audit_mutation();

COMMIT;
