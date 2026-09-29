BEGIN;

ALTER TABLE job_change_audit
  ADD COLUMN bulk_operation_id uuid;

CREATE INDEX ix_job_change_audit_bulk_operation
  ON job_change_audit (bulk_operation_id, changed_at DESC)
  WHERE bulk_operation_id IS NOT NULL;

COMMIT;
