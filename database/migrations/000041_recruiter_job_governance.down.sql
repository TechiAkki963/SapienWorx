BEGIN;

DROP TRIGGER IF EXISTS trg_job_change_audit_no_delete ON job_change_audit;
DROP TRIGGER IF EXISTS trg_job_change_audit_no_update ON job_change_audit;
DROP FUNCTION IF EXISTS prevent_job_change_audit_mutation();
DROP TABLE IF EXISTS job_change_audit;

DROP INDEX IF EXISTS ix_jobs_assigned_recruiter_status;
DROP INDEX IF EXISTS ix_jobs_visibility_status;

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_visibility_valid,
  DROP COLUMN IF EXISTS assigned_recruiter_id,
  DROP COLUMN IF EXISTS internal_notes,
  DROP COLUMN IF EXISTS visibility,
  DROP COLUMN IF EXISTS referral_enabled,
  DROP COLUMN IF EXISTS screening_questions;

COMMIT;
