BEGIN;

ALTER TABLE jobs
  ADD COLUMN required_skills text[] NOT NULL DEFAULT '{}';

CREATE INDEX ix_jobs_required_skills_gin
  ON jobs USING gin (required_skills);

COMMIT;
