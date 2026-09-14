BEGIN;

DROP INDEX IF EXISTS ix_candidate_profiles_headline_trgm;
DROP INDEX IF EXISTS ix_candidate_profiles_full_name_trgm;
DROP INDEX IF EXISTS ix_applications_job_updated;
DROP INDEX IF EXISTS ix_companies_display_name_trgm;
DROP INDEX IF EXISTS ix_jobs_state_trgm;
DROP INDEX IF EXISTS ix_jobs_city_trgm;
DROP INDEX IF EXISTS ix_jobs_description_trgm;
DROP INDEX IF EXISTS ix_jobs_title_trgm;
DROP INDEX IF EXISTS ix_jobs_active_feed;

-- pg_trgm is intentionally retained because other indexes/features may depend on it.
COMMIT;
