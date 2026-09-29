BEGIN;

DROP INDEX IF EXISTS ix_job_change_audit_bulk_operation;

ALTER TABLE job_change_audit
  DROP COLUMN IF EXISTS bulk_operation_id;

COMMIT;
