BEGIN;

-- Required for indexed substring searches used by candidate/recruiter facets.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Candidate job search: active-feed ordering and common substring facets.
CREATE INDEX ix_jobs_active_feed
  ON jobs (status, published_at DESC, created_at DESC);
CREATE INDEX ix_jobs_title_trgm
  ON jobs USING gin (title gin_trgm_ops);
CREATE INDEX ix_jobs_description_trgm
  ON jobs USING gin (description gin_trgm_ops);
CREATE INDEX ix_jobs_city_trgm
  ON jobs USING gin (city gin_trgm_ops);
CREATE INDEX ix_jobs_state_trgm
  ON jobs USING gin (state gin_trgm_ops);
CREATE INDEX ix_companies_display_name_trgm
  ON companies USING gin (display_name gin_trgm_ops);

-- Recruiter pipeline: company jobs fan into applications ordered by latest activity.
CREATE INDEX ix_applications_job_updated
  ON applications (job_id, updated_at DESC);
CREATE INDEX ix_candidate_profiles_full_name_trgm
  ON candidate_profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX ix_candidate_profiles_headline_trgm
  ON candidate_profiles USING gin (headline gin_trgm_ops);

COMMIT;
