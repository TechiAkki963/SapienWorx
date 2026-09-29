BEGIN;

DROP INDEX IF EXISTS ix_application_stage_audit_application_stage_changed;
DROP INDEX IF EXISTS ix_applications_job_applied;

COMMIT;
