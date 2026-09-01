ALTER TABLE jobs
    ADD COLUMN employment_type VARCHAR(24) NOT NULL DEFAULT 'FULL_TIME',
    ADD COLUMN workplace_model VARCHAR(16) NOT NULL DEFAULT 'ON_SITE';

UPDATE jobs
SET workplace_model = CASE
    WHEN LOWER(location) LIKE '%remote%' THEN 'REMOTE'
    WHEN LOWER(location) LIKE '%hybrid%' THEN 'HYBRID'
    ELSE 'ON_SITE'
END;

CREATE TABLE candidate_saved_jobs (
    id UUID PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_internal_id UUID NOT NULL REFERENCES jobs(internal_id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_candidate_saved_job UNIQUE (candidate_id, job_internal_id)
);

CREATE INDEX idx_candidate_saved_jobs_candidate_saved_at
    ON candidate_saved_jobs(candidate_id, saved_at DESC);
