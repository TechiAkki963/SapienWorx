BEGIN;

-- Phase 2 candidate discovery uses the existing jobs model plus the Phase 1
-- workforce mappings. These indexes keep structured facets and taxonomy joins
-- efficient without duplicating workforce concepts into the jobs table.
CREATE INDEX ix_jobs_active_discovery_facets
  ON jobs (employment_type, work_mode, published_at DESC)
  WHERE status='active';

CREATE INDEX ix_jobs_role_category_trgm
  ON jobs USING gin (role_category gin_trgm_ops)
  WHERE role_category IS NOT NULL;

CREATE INDEX ix_workforce_job_mapping_entity_source
  ON workforce.term_mappings (entity_id, source_id)
  WHERE source_type='job_required_skill' AND entity_id IS NOT NULL;

COMMIT;
