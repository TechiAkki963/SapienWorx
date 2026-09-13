BEGIN;

ALTER TABLE jobs
  ADD COLUMN education_requirements text[] NOT NULL DEFAULT '{}';

CREATE INDEX ix_jobs_education_requirements_gin
  ON jobs USING gin (education_requirements);

COMMIT;
