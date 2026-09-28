BEGIN;

DROP TRIGGER trg_jobs_job_reference_immutable ON jobs;
DROP FUNCTION prevent_job_reference_change();
ALTER TABLE jobs DROP COLUMN job_reference;
DROP FUNCTION next_job_reference();
DROP SEQUENCE job_reference_seq;

COMMIT;
