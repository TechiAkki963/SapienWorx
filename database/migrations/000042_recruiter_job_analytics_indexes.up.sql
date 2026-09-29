BEGIN;

CREATE INDEX ix_applications_job_applied
  ON applications (job_id, applied_at);

CREATE INDEX ix_application_stage_audit_application_stage_changed
  ON application_stage_audit (application_id, new_stage, changed_at);

COMMIT;
