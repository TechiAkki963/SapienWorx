BEGIN;

DROP INDEX IF EXISTS ix_jobs_education_requirements_gin;
ALTER TABLE jobs DROP COLUMN IF EXISTS education_requirements;

COMMIT;
