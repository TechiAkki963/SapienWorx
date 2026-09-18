\set ON_ERROR_STOP on

-- SapienWorx currently implements faceted free-text search with pg_trgm GIN
-- indexes, not a tsvector index. This audit verifies those actual indexes exist
-- and emits the representative query plan for review in a production-like DB.
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'ix_jobs_title_trgm',
    'ix_jobs_description_trgm',
    'ix_jobs_city_trgm',
    'ix_jobs_state_trgm',
    'ix_companies_display_name_trgm',
    'ix_jobs_active_feed'
  )
ORDER BY indexname;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT j.id, c.display_name, j.title
FROM jobs j
JOIN companies c ON c.id = j.company_id
WHERE j.status = 'active'
  AND (j.application_deadline IS NULL OR j.application_deadline >= current_date)
  AND (
    j.title ILIKE '%java%'
    OR j.description ILIKE '%java%'
    OR c.display_name ILIKE '%java%'
  )
  AND (
    COALESCE(j.city, '') ILIKE '%Mumbai%'
    OR COALESCE(j.state, '') ILIKE '%Mumbai%'
  )
  AND j.work_mode::text = 'hybrid'
  AND j.min_experience_months <= 36
  AND (j.max_experience_months IS NULL OR j.max_experience_months >= 36)
ORDER BY j.published_at DESC NULLS LAST, j.created_at DESC
LIMIT 20;

-- Review rule for a representative, sufficiently populated data set:
-- the plan should use the relevant Bitmap Index Scan / Bitmap Heap Scan or
-- another demonstrably efficient indexed plan. A Seq Scan on a large jobs table
-- is an audit failure and should trigger ANALYZE/index/query-shape investigation.
