BEGIN;

DROP INDEX IF EXISTS ix_jobs_required_skills_gin;
ALTER TABLE jobs DROP COLUMN IF EXISTS required_skills;

COMMIT;
